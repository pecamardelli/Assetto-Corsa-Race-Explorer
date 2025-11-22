const fs = require('fs');
const path = require('path');

// Path to Monaco race file
const monacoFile = path.join(__dirname, '..', 'app', 'data', 'championship', 'Test Drive Tour', 'Season 01', 'stats_monaco_1966_session_race_20251121_035320.json');

// Read the race data
console.log('Reading Monaco race file...');
const raceData = JSON.parse(fs.readFileSync(monacoFile, 'utf8'));

const drivers = raceData.driver_statistics;
const sessionInfo = raceData.session_info;

// Find the maximum laps completed (race winner's laps)
const raceLaps = Math.max(...Object.values(drivers).map(d => d.laps_completed));
console.log(`Race laps: ${raceLaps}`);

// Calculate best total time (only from drivers who completed all laps)
let bestTotalTime = 0.0;
const finishers = [];

Object.entries(drivers).forEach(([name, stats]) => {
  if (stats.laps_completed === raceLaps) {
    finishers.push(name);
    const totalTime = stats.total_time_seconds;
    if (bestTotalTime === 0.0 || totalTime < bestTotalTime) {
      bestTotalTime = totalTime;
    }
  }
});

console.log(`\nFinishers (${raceLaps} laps): ${finishers.length}`);
console.log(`Best total time: ${bestTotalTime.toFixed(3)}s`);
console.log(`Previous best total time: ${sessionInfo.best_total_time_seconds}s`);

// Recalculate scores for all drivers
console.log('\n=== RECALCULATING SCORES ===\n');

const trackLength = sessionInfo.track_length_meters;
const totalCars = sessionInfo.total_cars;
const CRASH_PENALTY_PERCENT_PER_G = sessionInfo.crash_penalty_config.penalty_percent_per_g;
const MAX_CRASH_PENALTY_PER_CRASH = sessionInfo.crash_penalty_config.max_penalty_per_crash_g;

const results = [];

Object.entries(drivers).forEach(([name, stats]) => {
  const position = stats.position;
  const lapsCompleted = stats.laps_completed;
  const partialLap = stats.partial_lap_completion;
  const totalTime = stats.total_time_seconds;

  // Base score
  const baseScore = (trackLength * (lapsCompleted + partialLap)) / raceLaps;

  // Position factor
  const positionFactor = (totalCars - position + 1) / totalCars;

  // Speed factor (NEW CALCULATION)
  let speedFactor = 1.0;
  if (totalTime > 0 && bestTotalTime > 0) {
    speedFactor = bestTotalTime / totalTime;
  }

  // Crash factor
  const cappedCrashIntensities = stats.crashes.crash_intensities_g.map(g => Math.min(g, MAX_CRASH_PENALTY_PER_CRASH));
  const cappedCrashIntensity = cappedCrashIntensities.reduce((a, b) => a + b, 0);
  const crashFactor = 1.0 - (cappedCrashIntensity * CRASH_PENALTY_PERCENT_PER_G / 100.0);
  const crashPenaltyPercent = cappedCrashIntensity * CRASH_PENALTY_PERCENT_PER_G;

  // Total score
  let totalScore = baseScore * positionFactor * speedFactor * crashFactor;

  // Fastest lap bonus: 5% bonus if driver has fastest lap
  const hasFastestLap = (speedFactor === 1.0 && lapsCompleted > 0);
  const fastestLapBonus = hasFastestLap ? totalScore * 0.05 : 0.0;
  if (hasFastestLap) {
    totalScore = totalScore * 1.05;
  }
  totalScore = Math.ceil(totalScore);

  // Store old values for comparison
  const oldScore = stats.total_score;
  const oldSpeedFactor = stats.score_breakdown.speed_factor;

  results.push({
    name,
    position,
    lapsCompleted,
    oldScore,
    newScore: totalScore,
    scoreDiff: totalScore - oldScore,
    oldSpeedFactor: oldSpeedFactor.toFixed(3),
    newSpeedFactor: speedFactor.toFixed(3),
    positionFactor: positionFactor.toFixed(3),
    crashFactor: crashFactor.toFixed(3),
    totalTime: totalTime.toFixed(3),
  });

  // Update the driver's data
  stats.total_score = totalScore;
  stats.score_breakdown.speed_factor = parseFloat(speedFactor.toFixed(3));
  stats.score_breakdown.base_score = parseFloat(baseScore.toFixed(2));
  stats.score_breakdown.position_factor = parseFloat(positionFactor.toFixed(3));
  stats.score_breakdown.crash_factor = parseFloat(crashFactor.toFixed(3));
  stats.score_breakdown.crash_penalty_percent = parseFloat(crashPenaltyPercent.toFixed(2));
  stats.score_breakdown.fastest_lap_bonus = hasFastestLap ? parseFloat(fastestLapBonus.toFixed(2)) : 0.0;
});

// Sort by position
results.sort((a, b) => a.position - b.position);

// Display results
console.log('Pos | Driver                  | Laps | Old Score | New Score | Diff   | Old SF | New SF | Pos F | Crash F');
console.log('----+-------------------------+------+-----------+-----------+--------+--------+--------+-------+--------');
results.forEach(r => {
  console.log(
    `${r.position.toString().padStart(3)} | ` +
    `${r.name.padEnd(23)} | ` +
    `${r.lapsCompleted.toString().padStart(4)} | ` +
    `${r.oldScore.toString().padStart(9)} | ` +
    `${r.newScore.toString().padStart(9)} | ` +
    `${(r.scoreDiff >= 0 ? '+' : '') + r.scoreDiff.toString().padStart(5)} | ` +
    `${r.oldSpeedFactor.padStart(6)} | ` +
    `${r.newSpeedFactor.padStart(6)} | ` +
    `${r.positionFactor.padStart(5)} | ` +
    `${r.crashFactor.padStart(7)}`
  );
});

// Update session info
sessionInfo.best_total_time_seconds = parseFloat(bestTotalTime.toFixed(3));

// Write back to file
console.log('\n=== SAVING UPDATED FILE ===\n');
fs.writeFileSync(monacoFile, JSON.stringify(raceData, null, 2), 'utf8');
console.log('✓ Monaco race file updated successfully!');

// Summary
const avgScoreIncrease = results.reduce((sum, r) => sum + r.scoreDiff, 0) / results.length;
console.log(`\nAverage score increase: ${avgScoreIncrease.toFixed(2)}`);
console.log(`Finishers: ${finishers.length}/${totalCars}`);
