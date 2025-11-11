##############################################################
# Race Statistics Tracker
# Tracks: distance, lap times, total time, overtakes, crashes
##############################################################

import ac
import acsys
import os
import json
import sys
import traceback

try:
    import math
    from datetime import datetime
except Exception as e:
    ac.log("Race Stats ERROR importing math/datetime: " + str(e))

appWindow = 0

# Data structure to hold statistics for each car
car_stats = {}

# Previous frame data for comparison
prev_positions = {}
prev_lap_counts = {}
prev_g_forces = {}

# Session info
session_start_time = 0
total_cars = 0
session_active = False
session_total_time = 0.0

# Crash detection threshold (G-force)
CRASH_G_FORCE_THRESHOLD = 4.0

# Crash penalty parameters
CRASH_PENALTY_PERCENT_PER_G = 0.01        # 0.01% penalty per G-force (0.1% per 10G)
MAX_CRASH_PENALTY_PER_CRASH = 100.0       # Cap each crash at 100G (1% max penalty per crash)

class CarStats:
    def __init__(self, car_id, driver_name, car_name):
        self.car_id = car_id
        self.driver_name = driver_name
        self.car_name = car_name
        self.distance_covered = 0.0  # in meters
        self.lap_times = []  # list of lap times in seconds
        self.total_time = 0.0  # individual driver racing time in seconds
        self.overtakes_made = 0
        self.times_overtaken = 0
        self.crash_intensities = []  # list of G-force values for each crash
        self.current_lap_time = 0.0
        self.lap_count = 0
        self.last_position = 0
        self.final_position = 999  # Final race position (999 = DNF/not finished)
        self.last_spline_pos = 0.0
        self.last_update_time = 0.0

    def to_dict(self, position=0, total_cars=1, track_length_m=0, race_laps=1, best_total_time=0.0):
        # Calculate total_time as sum of all completed lap times (convert ms to seconds)
        self.total_time = sum(self.lap_times) / 1000.0

        # Calculate average speed
        avg_speed_ms = (self.distance_covered / self.total_time) if self.total_time > 0 else 0.0
        avg_speed_kmh = avg_speed_ms * 3.6
        avg_speed_mph = avg_speed_ms * 2.23694

        # Calculate score: base_score × position_factor × speed_factor
        laps_completed = len(self.lap_times)
        partial_lap = 0.0

        # If driver didn't complete all race laps, add the partial lap completion
        if laps_completed < race_laps:
            partial_lap = self.last_spline_pos  # 0-1 representing percentage of current lap

        # Base score: (track_length × (laps_completed + partial_lap)) / race_laps
        if race_laps > 0:
            base_score = (track_length_m * (laps_completed + partial_lap)) / race_laps
        else:
            base_score = 0.0

        # Position factor: (total_cars - position + 1) / total_cars
        # 1st place gets 1.0x, last place gets (1/total_cars)x
        if total_cars > 0 and position > 0:
            position_factor = (total_cars - position + 1) / float(total_cars)
        else:
            position_factor = 1.0

        # Speed factor: best_total_time / driver_total_time
        # Fastest driver gets 1.0x, slower drivers get proportionally less
        if self.total_time > 0 and best_total_time > 0:
            speed_factor = best_total_time / self.total_time
        else:
            speed_factor = 1.0

        # Crash penalty factor
        # Cap each crash at MAX_CRASH_PENALTY_PER_CRASH (100G) for penalty calculation
        capped_crash_intensities = [min(g, MAX_CRASH_PENALTY_PER_CRASH) for g in self.crash_intensities]
        capped_crash_intensity = sum(capped_crash_intensities)

        # Crash multiplier (0.01% per G = 0.1% per 10G, max 1% per crash)
        # 10g crash = 0.999x multiplier (0.1% penalty)
        # 100g crash = 0.99x multiplier (1% penalty)
        # 700g crash = 0.99x multiplier (1% penalty, capped)
        crash_factor = 1.0 - (capped_crash_intensity * CRASH_PENALTY_PERCENT_PER_G / 100.0)

        # Final score = base × position × speed × crash
        total_score = base_score * position_factor * speed_factor * crash_factor

        # Calculate crash penalty percentage for display
        crash_penalty_percent = capped_crash_intensity * CRASH_PENALTY_PERCENT_PER_G

        return {
            'position': position,
            'car_name': self.car_name,
            'total_score': math.ceil(total_score * 100),
            'score_breakdown': {
                'base_score': round(base_score, 2),
                'position_factor': round(position_factor, 3),
                'speed_factor': round(speed_factor, 3),
                'crash_factor': round(crash_factor, 3),
                'crash_penalty_percent': round(crash_penalty_percent, 2)
            },
            'laps_completed': laps_completed,
            'partial_lap_completion': round(partial_lap, 3),
            'total_time_seconds': round(self.total_time, 3),
            'total_time_formatted': format_time(self.total_time),
            'distance_covered_km': round(self.distance_covered / 1000, 2),
            'distance_covered_miles': round(self.distance_covered / 1609.34, 2),
            'average_speed_kmh': round(avg_speed_kmh, 2),
            'average_speed_mph': round(avg_speed_mph, 2),
            'lap_times': [round(lt / 1000.0, 3) for lt in self.lap_times],
            'best_lap': round(min(self.lap_times) / 1000.0, 3) if self.lap_times else 0.0,
            'average_lap': round(sum(self.lap_times) / len(self.lap_times) / 1000.0, 3) if self.lap_times else 0.0,
            'overtakes_made': self.overtakes_made,
            'times_overtaken': self.times_overtaken,
            'crashes': {
                'total_crashes': len(self.crash_intensities),
                'crash_intensities_g': [round(g, 2) for g in self.crash_intensities],
                'worst_crash_g': round(max(self.crash_intensities), 2) if self.crash_intensities else 0.0,
                'average_crash_g': round(sum(self.crash_intensities) / len(self.crash_intensities), 2) if self.crash_intensities else 0.0,
                'total_crash_intensity': round(sum(self.crash_intensities), 2)
            },
            'net_positions_gained': self.overtakes_made - self.times_overtaken
        }


def format_time(seconds):
    """Convert seconds to HH:MM:SS.mmm format with milliseconds"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    milliseconds = int((seconds % 1) * 1000)

    if hours > 0:
        return "{0:02d}:{1:02d}:{2:02d}.{3:03d}".format(hours, minutes, secs, milliseconds)
    else:
        return "{0:02d}:{1:02d}.{2:03d}".format(minutes, secs, milliseconds)

def acMain(ac_version):
    global appWindow
    try:
        ac.log("Race Stats: acMain called, version: " + str(ac_version))

        appWindow = ac.newApp("RaceStats")
        ac.setSize(appWindow, 250, 100)
        ac.setTitle(appWindow, "Race Statistics")

        # Add status label
        label = ac.addLabel(appWindow, "Tracking race statistics...\n\nData will be saved automatically\nwhen session ends.")
        ac.setPosition(label, 10, 25)

        ac.console("Race Stats: Initialized")
        ac.log("Race Stats: App started successfully")

        return "RaceStats"
    except Exception as e:
        ac.log("Race Stats ERROR in acMain: " + str(e))
        ac.log("Race Stats TRACEBACK: " + traceback.format_exc())
        return "RaceStats"

def acUpdate(deltaT):
    """Called every frame - track all statistics"""
    global car_stats, prev_positions, prev_lap_counts, total_cars, session_active, session_start_time, prev_g_forces, session_total_time

    try:
        # Initialize on first update
        if not session_active:
            session_active = True
            total_cars = ac.getCarsCount()

            # Initialize car stats
            for i in range(total_cars):
                driver_name = ac.getDriverName(i)
                car_name = ac.getCarName(i)
                car_stats[i] = CarStats(i, driver_name, car_name)
                prev_positions[i] = ac.getCarLeaderboardPosition(i)
                prev_lap_counts[i] = 0
                prev_g_forces[i] = [0.0, 0.0, 0.0]

            ac.log("Race Stats: Tracking {0} cars".format(total_cars))
            ac.console("Race Stats: Tracking {0} cars".format(total_cars))

        # Update statistics for each car
        for car_id in range(total_cars):
            if car_id not in car_stats:
                continue

            stats = car_stats[car_id]

            # Get current position
            current_position = ac.getCarLeaderboardPosition(car_id)

            # Detect overtakes
            if car_id in prev_positions:
                prev_pos = prev_positions[car_id]

                # If position improved (number decreased), this car overtook someone
                if current_position < prev_pos and prev_pos > 0 and current_position > 0:
                    stats.overtakes_made += (prev_pos - current_position)
                    ac.log("Race Stats: {0} overtook! Position {1} -> {2}".format(stats.driver_name, prev_pos, current_position))

                # If position worsened (number increased), this car was overtaken
                elif current_position > prev_pos and prev_pos > 0 and current_position > 0:
                    stats.times_overtaken += (current_position - prev_pos)
                    ac.log("Race Stats: {0} was overtaken. Position {1} -> {2}".format(stats.driver_name, prev_pos, current_position))

            prev_positions[car_id] = current_position

            # Track lap times
            current_lap_count = ac.getCarState(car_id, acsys.CS.LapCount)
            current_lap_time = ac.getCarState(car_id, acsys.CS.LapTime)

            # New lap completed
            if current_lap_count > prev_lap_counts.get(car_id, 0):
                if stats.current_lap_time > 0:
                    stats.lap_times.append(stats.current_lap_time)
                    ac.log("Race Stats: {0} completed lap in {1:.3f}s".format(stats.driver_name, stats.current_lap_time))

            stats.current_lap_time = current_lap_time
            stats.lap_count = current_lap_count
            prev_lap_counts[car_id] = current_lap_count

            # Track distance covered
            # Get track length
            track_length = ac.getTrackLength(0)  # in meters

            # Get current position on track (normalized 0-1)
            current_spline = ac.getCarState(car_id, acsys.CS.NormalizedSplinePosition)

            # Calculate distance traveled this frame
            if stats.last_spline_pos > 0:
                spline_diff = current_spline - stats.last_spline_pos

                # Handle lap transition (spline goes from ~1.0 to ~0.0)
                if spline_diff < -0.5:
                    spline_diff += 1.0
                elif spline_diff > 0.5:
                    spline_diff -= 1.0

                distance_this_frame = spline_diff * track_length

                # Only add positive distance (moving forward)
                if distance_this_frame > 0:
                    stats.distance_covered += distance_this_frame

            stats.last_spline_pos = current_spline

            # Crash detection using G-forces
            try:
                # Get acceleration values (G-forces)
                g_values = ac.getCarState(car_id, acsys.CS.AccG)
                g_x = g_values[0]  # lateral
                g_y = g_values[1]  # vertical
                g_z = g_values[2]  # longitudinal

                # Calculate total G-force magnitude
                total_g = math.sqrt(g_x**2 + g_y**2 + g_z**2)

                # Get previous G-force
                if car_id in prev_g_forces:
                    prev_total_g = math.sqrt(sum(g**2 for g in prev_g_forces[car_id]))

                    # Detect sudden impact (rapid G-force change)
                    g_change = abs(total_g - prev_total_g)

                    # If G-force spike is above threshold, record crash with intensity
                    if g_change > CRASH_G_FORCE_THRESHOLD:
                        stats.crash_intensities.append(g_change)
                        ac.log("Race Stats: {0} CRASH detected! G-force spike: {1:.2f}g (Total crashes: {2})".format(
                            stats.driver_name, g_change, len(stats.crash_intensities)))

                prev_g_forces[car_id] = [g_x, g_y, g_z]

            except:
                # G-force data might not be available for all cars
                pass

        # Track total session time
        session_total_time += deltaT

    except Exception as e:
        ac.log("Race Stats ERROR in acUpdate: " + str(e))
        ac.log("Race Stats TRACEBACK: " + traceback.format_exc())

def acShutdown():
    """Called when session ends - save all statistics"""
    global car_stats, session_total_time

    ac.log("Race Stats: Session ending, saving statistics...")

    try:
        # Get track length (actual length from game data)
        track_length_m = ac.getTrackLength(0)

        # Find the maximum laps completed (this is the race lap count)
        race_laps = max([len(stats.lap_times) for stats in car_stats.values()]) if car_stats else 1

        # Calculate best total time (fastest driver who completed laps)
        best_total_time = 0.0
        for stats in car_stats.values():
            if len(stats.lap_times) > 0:
                total_time = sum(stats.lap_times) / 1000.0
                if best_total_time == 0.0 or total_time < best_total_time:
                    best_total_time = total_time

        # Prepare data for export
        session_data = {
            'session_info': {
                'date': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'track': ac.getTrackName(0),
                'track_config': ac.getTrackConfiguration(0),
                'track_length_meters': round(track_length_m, 2),
                'track_length_km': round(track_length_m / 1000, 3),
                'track_length_miles': round(track_length_m / 1609.34, 3),
                'total_cars': len(car_stats),
                'race_laps': race_laps,
                'session_duration_seconds': round(session_total_time, 2),
                'session_duration_formatted': format_time(session_total_time),
                'scoring_formula': 'score = base_score × position_factor × speed_factor × crash_factor',
                'best_total_time_seconds': round(best_total_time, 3),
                'crash_penalty_config': {
                    'penalty_percent_per_g': CRASH_PENALTY_PERCENT_PER_G,
                    'max_penalty_per_crash_g': MAX_CRASH_PENALTY_PER_CRASH
                }
            },
            'driver_statistics': {}
        }

        # Capture final race position for each driver
        for car_id, stats in car_stats.items():
            try:
                stats.final_position = ac.getCarLeaderboardPosition(car_id)
            except:
                stats.final_position = 999  # DNF or position unavailable

        # Sort drivers by final race position (ascending - 1st place first)
        sorted_drivers = sorted(car_stats.items(), key=lambda x: x[1].final_position)

        # Add statistics for each driver in sorted order using their actual race position
        total_cars_count = len(car_stats)
        for car_id, stats in sorted_drivers:
            session_data['driver_statistics'][stats.driver_name] = stats.to_dict(stats.final_position, total_cars_count, track_length_m, race_laps, best_total_time)

        # Determine output directory
        documents_path = os.path.expanduser("~\\Documents")
        base_dir = os.path.join(documents_path, "Assetto Corsa", "out", "race_statistics")

        # Create directory if it doesn't exist
        if not os.path.exists(base_dir):
            os.makedirs(base_dir)

        # Create timestamp and track name
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        track_name = ac.getTrackName(0).replace('/', '_').replace('\\', '_')
        track_config = ac.getTrackConfiguration(0)
        if track_config:
            track_full = "{0}-{1}".format(track_name, track_config)
        else:
            track_full = track_name

        # Filename: stats_{track}_{timestamp}.json
        filename = "stats_{0}_{1}.json".format(track_full, timestamp)
        filepath = os.path.join(base_dir, filename)

        ac.console("Race Stats: Saving statistics")
        ac.log("Race Stats: Saving session statistics")

        # Save to JSON file
        with open(filepath, 'w') as f:
            json.dump(session_data, f, indent=2)

        ac.console("Race Stats: Saved to {0}".format(filename))
        ac.log("Race Stats: Statistics saved to {0}".format(filepath))

        # Log summary to console
        ac.log("=" * 50)
        ac.log("RACE STATISTICS SUMMARY")
        ac.log("=" * 50)
        ac.log("Track: {0} ({1} km)".format(
            session_data['session_info']['track'],
            session_data['session_info']['track_length_km']))
        ac.log("Session Duration: {0}".format(session_data['session_info']['session_duration_formatted']))
        ac.log("Best Total Time: {0}".format(format_time(session_data['session_info']['best_total_time_seconds'])))
        ac.log("=" * 50)
        for driver_name, driver_stats in session_data['driver_statistics'].items():
            ac.log("\nP{0} - {1}:".format(driver_stats['position'], driver_name))
            ac.log("  SCORE: {0:.2f} points".format(driver_stats['total_score']))
            ac.log("    Base: {0:.2f} × Position: {1:.3f} × Speed: {2:.3f} × Crash: {3:.3f}".format(
                driver_stats['score_breakdown']['base_score'],
                driver_stats['score_breakdown']['position_factor'],
                driver_stats['score_breakdown']['speed_factor'],
                driver_stats['score_breakdown']['crash_factor']))
            ac.log("    (Crash penalty: -{0:.2f}%)".format(driver_stats['score_breakdown']['crash_penalty_percent']))
            ac.log("  Total Time: {0}".format(driver_stats['total_time_formatted']))
            ac.log("  Laps Completed: {0} + {1:.1%} partial".format(
                driver_stats['laps_completed'],
                driver_stats['partial_lap_completion']))
            ac.log("  Distance: {0} km".format(driver_stats['distance_covered_km']))
            ac.log("  Avg Speed: {0} km/h".format(driver_stats['average_speed_kmh']))
            ac.log("  Best Lap: {0}s".format(driver_stats['best_lap']))
            ac.log("  Overtakes: {0}".format(driver_stats['overtakes_made']))
            ac.log("  Overtaken: {0}".format(driver_stats['times_overtaken']))
            ac.log("  Crashes: {0} (Worst: {1}g, Total Intensity: {2}g)".format(
                driver_stats['crashes']['total_crashes'],
                driver_stats['crashes']['worst_crash_g'],
                driver_stats['crashes']['total_crash_intensity']))

    except Exception as e:
        ac.console("Race Stats ERROR: {0}".format(str(e)))
        ac.log("Race Stats ERROR: {0}".format(str(e)))
        ac.log("Race Stats TRACEBACK: " + traceback.format_exc())
