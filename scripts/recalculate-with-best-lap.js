const fs = require('fs');
const path = require('path');

// Path to championship directory
const champDir = path.join(__dirname, '..', 'app', 'data', 'championship', 'Test Drive Tour', 'Season 01');

// Get all race files
const raceFiles = fs.readdirSync(champDir).filter(f => f.endsWith('.json') && f.startsWith('stats_'));

console.log(`Found ${raceFiles.length} race files to recalculate\n`);

const CRASH_PENALTY_PERCENT_PER_G = 0.01;
const MAX_CRASH_PENALTY_PER_CRASH = 100.0;

raceFiles.forEach(raceFile => {
  const filePath = path.join(champDir, raceFile);
  const raceData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const drivers = raceData.driver_statistics;
  const sessionInfo = raceData.session_info;
  const raceLaps = sessionInfo.race_laps;
  const trackLength = sessionInfo.track_length_meters;
  const totalCars = sessionInfo.total_cars;

  // Calculate best lap time across all drivers and identify who has it
  let bestLapTime = 0.0;
  let fastestLapDriver = null;
  Object.entries(drivers).forEach(([name, stats]) => {
    if (stats.lap_times.length > 0) {
      const driverBestLap = Math.min(...stats.lap_times);
      if (bestLapTime === 0.0 || driverBestLap < bestLapTime) {
        bestLapTime = driverBestLap;
        fastestLapDriver = name;
      }
    }
  });

  console.log(`Processing: ${raceFile}`);
  console.log(`  Race laps: ${raceLaps}, Best lap: ${bestLapTime.toFixed(3)}s`);

  // Update session info
  sessionInfo.best_lap_time_seconds = parseFloat(bestLapTime.toFixed(3));
  delete sessionInfo.best_total_time_seconds; // Remove old field

  let changedScores = 0;

  Object.entries(drivers).forEach(([name, stats]) => {
    const position = stats.position;
    const lapsCompleted = stats.laps_completed;
    const partialLap = stats.partial_lap_completion;

    // Base score
    const baseScore = (trackLength * (lapsCompleted + partialLap)) / raceLaps;

    // Position factor
    const positionFactor = (totalCars - position + 1) / totalCars;

    // Speed factor (based on best lap time)
    let speedFactor = 1.0;
    if (lapsCompleted > 0 && bestLapTime > 0) {
      const driverBestLap = Math.min(...stats.lap_times);
      speedFactor = bestLapTime / driverBestLap;
      // Cap at 1.0 - fastest driver gets 1.0, slower drivers get less
      if (speedFactor > 1.0) {
        speedFactor = 1.0;
      }
    } else {
      // Driver completed no laps, penalty
      speedFactor = 0.5;
    }

    // Crash factor
    const cappedCrashIntensities = stats.crashes.crash_intensities_g.map(g => Math.min(g, MAX_CRASH_PENALTY_PER_CRASH));
    const cappedCrashIntensity = cappedCrashIntensities.reduce((a, b) => a + b, 0);
    const crashFactor = 1.0 - (cappedCrashIntensity * CRASH_PENALTY_PERCENT_PER_G / 100.0);
    const crashPenaltyPercent = cappedCrashIntensity * CRASH_PENALTY_PERCENT_PER_G;

    // Total score
    let totalScore = baseScore * positionFactor * speedFactor * crashFactor;

    // Fastest lap bonus: 5% bonus if driver has fastest lap
    const hasFastestLap = (name === fastestLapDriver);
    const fastestLapBonus = hasFastestLap ? totalScore * 0.05 : 0.0;
    if (hasFastestLap) {
      totalScore = totalScore * 1.05;
    }
    totalScore = Math.ceil(totalScore);

    // Check if changed
    if (stats.total_score !== totalScore) {
      changedScores++;
    }

    // Update the driver's data
    stats.total_score = totalScore;
    stats.score_breakdown.speed_factor = parseFloat(speedFactor.toFixed(3));
    stats.score_breakdown.base_score = parseFloat(baseScore.toFixed(2));
    stats.score_breakdown.position_factor = parseFloat(positionFactor.toFixed(3));
    stats.score_breakdown.crash_factor = parseFloat(crashFactor.toFixed(3));
    stats.score_breakdown.crash_penalty_percent = parseFloat(crashPenaltyPercent.toFixed(2));
    stats.score_breakdown.fastest_lap_bonus = hasFastestLap ? parseFloat(fastestLapBonus.toFixed(2)) : 0.0;
  });

  // Write back to file
  fs.writeFileSync(filePath, JSON.stringify(raceData, null, 2), 'utf8');
  console.log(`  ✓ Updated ${changedScores} driver scores\n`);
});

console.log('✅ All races recalculated with best lap-based speed factor!');
