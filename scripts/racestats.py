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

# Grace on the qualifying clock, in seconds. Our own timer starts a moment before
# AC's does, so it should never be the reason a session reads as unfinished.
QUALIFYING_TOLERANCE_SECONDS = 5.0

appWindow = 0

# Data structure to hold statistics for each car
car_stats = {}

# Previous frame data for comparison
prev_positions = {}
prev_lap_counts = {}
prev_g_forces = {}
last_crash_times = {}  # Track time of last crash for cooldown

# Session info
total_cars = 0
session_active = False
session_total_time = 0.0

# Multi-session tracking for race weekends
current_session_number = 0
previous_session_time = 0.0


# Crash detection threshold (G-force)
CRASH_G_FORCE_THRESHOLD = 50.0            # Only count crashes above 50G

# Crash penalty parameters
CRASH_PENALTY_PERCENT_PER_G = 0.01        # 0.01% penalty per G-force (0.1% per 10G)
MAX_CRASH_PENALTY_PER_CRASH = 100.0       # Cap each crash at 100G (1% max penalty per crash)

# Crash cooldown period
CRASH_COOLDOWN_SECONDS = 10.0             # Ignore additional crashes for 10 seconds after a crash

class CarStats:
    def __init__(self, car_id, driver_name, car_name):
        self.car_id = car_id
        self.driver_name = driver_name
        self.car_name = car_name
        self.lap_times = []  # list of lap times in seconds
        self.total_time = 0.0  # individual driver racing time in seconds
        self.overtakes_made = 0
        self.times_overtaken = 0
        self.crash_intensities = []  # list of G-force values for each crash
        self.current_lap_time = 0.0
        self.final_position = 999  # Final race position (999 = DNF/not finished)
        self.max_speed_ms = 0.0  # maximum speed in m/s

    def racing_time(self):
        """Seconds this driver spent racing: the sum of the laps they completed."""
        return sum(self.lap_times) / 1000.0

    def to_dict(self, position=0, total_cars=1, track_length_m=0, race_laps=1, best_lap_time=0.0, has_fastest_lap=False):
        # Calculate total_time as sum of all completed lap times (convert ms to seconds)
        self.total_time = self.racing_time()

        # Calculate score: base_score × position_factor × speed_factor
        laps_completed = len(self.lap_times)

        # Base score: track_length × laps_completed
        # Only count fully completed laps for base score
        base_score = track_length_m * laps_completed

        # Position factor: (total_cars - position + 1) / total_cars
        # 1st place gets 1.0x, last place gets (1/total_cars)x
        if total_cars > 0 and position > 0:
            position_factor = (total_cars - position + 1) / float(total_cars)
        else:
            position_factor = 1.0

        # Speed factor: based on best lap time
        # Fastest driver gets 1.0x, slower drivers get proportionally less
        # Drivers with no laps get 0.5x penalty
        if laps_completed > 0 and best_lap_time > 0:
            driver_best_lap = min(self.lap_times) / 1000.0
            speed_factor = best_lap_time / driver_best_lap
            # Cap at 1.0 - fastest driver gets 1.0, slower drivers get less
            if speed_factor > 1.0:
                speed_factor = 1.0
        else:
            # Driver completed no laps, penalty
            speed_factor = 0.5

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

        # Fastest lap bonus: 5% bonus if driver has fastest lap
        fastest_lap_bonus = 0.0
        if has_fastest_lap:
            fastest_lap_bonus = total_score * 0.05
            total_score = total_score * 1.05

        # Calculate crash penalty percentage for display
        crash_penalty_percent = capped_crash_intensity * CRASH_PENALTY_PERCENT_PER_G

        return {
            'position': position,
            'car_name': self.car_name,
            'total_score': math.ceil(total_score),
            'score_breakdown': {
                'base_score': round(base_score, 2),
                'position_factor': round(position_factor, 3),
                'speed_factor': round(speed_factor, 3),
                'crash_factor': round(crash_factor, 3),
                'crash_penalty_percent': round(crash_penalty_percent, 2),
                'fastest_lap_bonus': round(fastest_lap_bonus, 2) if has_fastest_lap else 0.0
            },
            'laps_completed': laps_completed,
            'total_time_seconds': round(self.total_time, 3),
            'total_time_formatted': format_time(self.total_time),
            'max_speed_kmh': round(self.max_speed_ms * 3.6, 2),
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
            'net_positions_gained': self.overtakes_made - self.times_overtaken,
            'retired': False
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

def read_launch_context():
    """
    Read the handshake file Race Explorer writes when it launches a session.

    It tells us which championship round this is and what kind of session was
    asked for, so the saved JSON is labelled at the source instead of being
    named by hand afterwards. Returns an empty dict when the session was started
    some other way (Content Manager, the vanilla launcher), which leaves the
    old behaviour untouched.
    """
    try:
        documents_path = os.path.expanduser("~\\Documents")
        context_path = os.path.join(
            documents_path, "Assetto Corsa", "out", "race_explorer_launch.json")

        if not os.path.exists(context_path):
            return {}

        with open(context_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        ac.log("Race Stats WARNING reading launch context: " + str(e))
        return {}

def resolve_session_type(launch_context):
    """
    Name the session being saved.

    The launch context lists a launch's sessions in the order AC will run them,
    so the session counter picks out the right one. Nothing else here can tell a
    qualifying apart from a race: AC's own session state lives in shared memory,
    which needs ctypes, and AC's embedded Python has no _ctypes module.
    """
    sessions = launch_context.get('sessions', [])
    if current_session_number < len(sessions):
        return sessions[current_session_number]

    return launch_context.get('session_type', '')


def session_ran_its_course(launch_context, session_type, leader_laps):
    """
    Whether this session reached its natural end rather than being walked out of.

    Measured against the targets Race Explorer recorded when it launched: a race
    ends when the leader completes the distance, a qualifying when its clock runs
    out. A session started outside Race Explorer has no targets to check, so it
    is never claimed as finished.
    """
    if session_type == 'race':
        target_laps = launch_context.get('laps', 0)
        return target_laps > 0 and leader_laps >= target_laps

    if session_type == 'qualifying':
        target_seconds = launch_context.get('qualifying_minutes', 0) * 60
        return (target_seconds > 0 and
                session_total_time >= target_seconds - QUALIFYING_TOLERANCE_SECONDS)

    # A free run has no end of its own to reach.
    return False


def save_current_session():
    """
    Save current session data to individual JSON file.

    Returns True when the session that was saved had run its course, which is what
    tells a genuine move to the next session apart from a restart of this one.
    """
    global car_stats, session_total_time

    if not car_stats:
        return False

    try:
        # Get track length
        track_length_m = ac.getTrackLength(0)

        # Find the maximum laps completed
        race_laps = max([len(stats.lap_times) for stats in car_stats.values()]) if car_stats else 1

        # Calculate best lap time across all drivers and identify who has it
        best_lap_time = 0.0
        fastest_lap_driver_id = None
        for car_id, stats in car_stats.items():
            if len(stats.lap_times) > 0:
                driver_best_lap = min(stats.lap_times) / 1000.0
                if best_lap_time == 0.0 or driver_best_lap < best_lap_time:
                    best_lap_time = driver_best_lap
                    fastest_lap_driver_id = car_id

        # Session context from Race Explorer, when it was the one that launched us
        launch_context = read_launch_context()
        session_type = resolve_session_type(launch_context)
        completed = session_ran_its_course(launch_context, session_type, race_laps)

        # Prepare session data
        session_data = {
            'session_info': {
                'session_type': session_type,
                'finished': completed,
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
                'scoring_formula': 'score = base_score × position_factor × speed_factor × crash_factor (× 1.05 if fastest lap)',
                'best_lap_time_seconds': round(best_lap_time, 3),
                'crash_penalty_config': {
                    'penalty_percent_per_g': CRASH_PENALTY_PERCENT_PER_G,
                    'max_penalty_per_crash_g': MAX_CRASH_PENALTY_PER_CRASH
                }
            },
            'driver_statistics': {}
        }

        # Carry the round this session belongs to, when Race Explorer supplied it
        for key in ('championship', 'season', 'round'):
            if key in launch_context:
                session_data['session_info'][key] = launch_context[key]

        # Capture final positions
        for car_id, stats in car_stats.items():
            try:
                stats.final_position = ac.getCarLeaderboardPosition(car_id)
            except:
                stats.final_position = 999

        # Sort drivers by position
        sorted_drivers = sorted(car_stats.items(), key=lambda x: x[1].final_position)

        # Anyone with less race time on the clock than the winner stopped before the
        # end, so they did not finish. Being lapped does not count: AC lets a car
        # finish the lap it is on when the leader takes the flag, so a driver still
        # running banks that last lap after the winner and lands above their total.
        # Races only -- no other session type has a winner to measure against.
        retired_below_seconds = 0.0
        if session_type == 'race' and sorted_drivers:
            retired_below_seconds = sorted_drivers[0][1].racing_time()

        # Add statistics for each driver
        total_cars_count = len(car_stats)
        for car_id, stats in sorted_drivers:
            has_fastest_lap = (car_id == fastest_lap_driver_id)
            driver = stats.to_dict(
                stats.final_position, total_cars_count, track_length_m, race_laps, best_lap_time, has_fastest_lap)
            driver['retired'] = stats.racing_time() < retired_below_seconds
            session_data['driver_statistics'][stats.driver_name] = driver

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

        # Filename: stats_{track}[_session_{type}]_{timestamp}.json
        # The session marker is what Race Explorer reads a file's type from, so it
        # goes in whenever we know it.
        session_type = session_data['session_info']['session_type']
        if session_type:
            filename = "stats_{0}_session_{1}_{2}.json".format(
                track_full, session_type, timestamp)
        else:
            filename = "stats_{0}_{1}.json".format(track_full, timestamp)
        filepath = os.path.join(base_dir, filename)

        # Save to JSON file
        with open(filepath, 'w') as f:
            json.dump(session_data, f, indent=2)

        return completed

    except Exception as e:
        ac.log("Race Stats ERROR in save_current_session: " + str(e))
        ac.log("Race Stats TRACEBACK: " + traceback.format_exc())
        return False

def acMain(ac_version):
    global appWindow
    try:
        appWindow = ac.newApp("RaceStats")
        ac.setSize(appWindow, 250, 100)
        ac.setTitle(appWindow, "Race Statistics")

        # Add status label
        label = ac.addLabel(appWindow, "Tracking race statistics...\n\nData will be saved automatically\nwhen session ends.")
        ac.setPosition(label, 10, 25)

        return "RaceStats"
    except Exception as e:
        ac.log("Race Stats ERROR in acMain: " + str(e))
        ac.log("Race Stats TRACEBACK: " + traceback.format_exc())
        return "RaceStats"

def acUpdate(deltaT):
    """Called every frame - track all statistics"""
    global car_stats, prev_positions, prev_lap_counts, total_cars, session_active, prev_g_forces, session_total_time
    global current_session_number, previous_session_time, last_crash_times

    try:
        # Detect session change by monitoring if lap counts reset or session time goes backwards
        session_changed = False
        if session_active and total_cars > 0:
            # Check if session time has reset (new session started)
            # If session time is significantly less than previous check, a new session started
            if session_total_time > 10.0 and previous_session_time > 10.0:
                # Also check if any car's lap count reset to 0 while previously having laps
                lap_count_reset = False
                for car_id in range(total_cars):
                    current_lap = ac.getCarState(car_id, acsys.CS.LapCount)
                    if car_id in prev_lap_counts and prev_lap_counts[car_id] > 0 and current_lap == 0:
                        lap_count_reset = True
                        break

                if lap_count_reset:
                    session_changed = True

        # If session changed, save current session and reset
        if session_changed:
            # Lap counts reset both when AC moves on to the next session and when
            # the driver restarts this one. Only a session that finished can have
            # been moved on from, so only then does the session counter advance —
            # a restart keeps its place and stays correctly named.
            if save_current_session():
                current_session_number += 1

            # Reset for new session
            session_total_time = 0.0
            car_stats = {}
            prev_positions = {}
            prev_lap_counts = {}
            prev_g_forces = {}
            last_crash_times = {}
            session_active = False

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
                last_crash_times[i] = -999.0  # Initialize far in the past

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

                # If position worsened (number increased), this car was overtaken
                elif current_position > prev_pos and prev_pos > 0 and current_position > 0:
                    stats.times_overtaken += (current_position - prev_pos)

            prev_positions[car_id] = current_position

            # Track lap times
            current_lap_count = ac.getCarState(car_id, acsys.CS.LapCount)
            current_lap_time = ac.getCarState(car_id, acsys.CS.LapTime)

            # New lap completed
            if current_lap_count > prev_lap_counts.get(car_id, 0):
                if stats.current_lap_time > 0:
                    stats.lap_times.append(stats.current_lap_time)

            stats.current_lap_time = current_lap_time
            prev_lap_counts[car_id] = current_lap_count

            # Track maximum speed
            try:
                current_speed_ms = ac.getCarState(car_id, acsys.CS.SpeedMS)
                if current_speed_ms > stats.max_speed_ms:
                    stats.max_speed_ms = current_speed_ms
            except:
                # Speed data might not be available
                pass

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

                    # Check if enough time has passed since last crash (cooldown period)
                    time_since_last_crash = session_total_time - last_crash_times.get(car_id, -999.0)

                    # Only count crash if:
                    # 1. G-force spike is above threshold
                    # 2. At least CRASH_COOLDOWN_SECONDS have passed since last crash
                    if g_change > CRASH_G_FORCE_THRESHOLD and time_since_last_crash >= CRASH_COOLDOWN_SECONDS:
                        stats.crash_intensities.append(g_change)
                        last_crash_times[car_id] = session_total_time

                prev_g_forces[car_id] = [g_x, g_y, g_z]

            except:
                # G-force data might not be available for all cars
                pass

        # Track total session time
        session_total_time += deltaT
        previous_session_time = session_total_time

    except Exception as e:
        ac.log("Race Stats ERROR in acUpdate: " + str(e))
        ac.log("Race Stats TRACEBACK: " + traceback.format_exc())

def acShutdown():
    """Called when session ends - save final session statistics"""
    global car_stats

    try:
        # Save the current/final session
        if car_stats:
            save_current_session()

    except Exception as e:
        ac.log("Race Stats ERROR in acShutdown: " + str(e))
        ac.log("Race Stats TRACEBACK: " + traceback.format_exc())
