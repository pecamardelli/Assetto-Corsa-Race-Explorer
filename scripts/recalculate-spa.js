const fs = require('fs');
const path = require('path');

// Path to Spa race file
const spaFile = path.join(__dirname, '..', 'app', 'data', 'championship', '57d34e04-9557-437a-a139-1ac6c30f28c7', 'stats_rj_spa_34_66-34_session_race_20251121_165148.json');

// Read the race data
console.log('Reading Spa race file...');
const raceData = JSON.parse(fs.readFileSync(spaFile, 'utf8'));

const drivers = raceData.driver_statistics;
const sessionInfo = raceData.session_info;

// Race info
const raceLaps = sessionInfo.race_laps;
const trackLength = sessionInfo.track_length_meters;
const totalCars = sessionInfo.total_cars;
const bestTotalTime = sessionInfo.best_total_time_seconds;
const bestAvgLap = bestTotalTime / raceLaps;

console.log(`\nRace: ${raceLaps} laps`);
console.log(`Best total time: ${bestTotalTime.toFixed(3)}s`);
console.log(`Best average lap: ${bestAvgLap.toFixed(3)}s`);

const CRASH_PENALTY_PERCENT_PER_G = sessionInfo.crash_penalty_config.penalty_percent_per_g;
const MAX_CRASH_PENALTY_PER_CRASH = sessionInfo.crash_penalty_config.max_penalty_per_crash_g;

// Recalculate scores for all drivers
console.log('\n=== RECALCULATING SCORES WITH NEW SPEED FACTOR LOGIC ===\n');

const results = [];

Object.entries(drivers).forEach(([name, stats]) => {
  const position = stats.position;
  const lapsCompleted = stats.laps_completed;
  const partialLap = stats.partial_lap_completion;
  const totalTime = stats.total_time_seconds;
  const isDNF = lapsCompleted < raceLaps;

  // Base score calculation
  // For race finishers: full track length (they completed the race)
  // For DNFs: distance covered (actual distance traveled)
  let baseScore;
  if (isDNF) {
    // DNF: score based on actual distance covered
    baseScore = trackLength * (lapsCompleted + partialLap);
  } else {
    // Race finisher: full track length score
    baseScore = trackLength;
  }

  // Position factor
  const positionFactor = (totalCars - position + 1) / totalCars;

  // Speed factor (NEW CALCULATION - based on average lap times for DNFs)
  let speedFactor = 1.0;
  if (lapsCompleted === raceLaps && totalTime > 0 && bestTotalTime > 0) {
    // Driver finished the race, compare total race times
    speedFactor = bestTotalTime / totalTime;
  } else if (lapsCompleted > 0 && bestTotalTime > 0) {
    // Driver DNF'd but completed some laps, compare average lap times
    const driverAvgLap = totalTime / lapsCompleted;
    speedFactor = bestAvgLap / driverAvgLap;
  } else {
    // Driver completed no laps, penalty for not completing a single lap
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
  const hasFastestLap = (lapsCompleted === raceLaps && speedFactor === 1.0);
  const fastestLapBonus = hasFastestLap ? totalScore * 0.05 : 0.0;
  if (hasFastestLap) {
    totalScore = totalScore * 1.05;
  }
  totalScore = Math.ceil(totalScore);

  // Store old values for comparison
  const oldScore = stats.total_score;
  const oldSpeedFactor = stats.score_breakdown.speed_factor;

  const driverAvgLap = lapsCompleted > 0 ? totalTime / lapsCompleted : 0;

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
    totalTime: totalTime.toFixed(1),
    avgLap: driverAvgLap.toFixed(1),
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

// Sort by new score descending
results.sort((a, b) => b.newScore - a.newScore);

// Display results
console.log('Pos | Laps | Old Score | New Score | Diff     | Old SF | New SF | Avg Lap | Driver');
console.log('----+------+-----------+-----------+----------+--------+--------+---------+------------------------');
results.forEach(r => {
  const diff = r.scoreDiff >= 0 ? '+' + r.scoreDiff : r.scoreDiff.toString();
  console.log(
    `${r.position.toString().padStart(3)} | ` +
    `${r.lapsCompleted.toString().padStart(4)} | ` +
    `${r.oldScore.toString().padStart(9)} | ` +
    `${r.newScore.toString().padStart(9)} | ` +
    `${diff.padStart(8)} | ` +
    `${r.oldSpeedFactor.padStart(6)} | ` +
    `${r.newSpeedFactor.padStart(6)} | ` +
    `${r.avgLap.padStart(7)} | ` +
    `${r.name}`
  );
});

// Write back to file
console.log('\n=== SAVING UPDATED FILE ===\n');
fs.writeFileSync(spaFile, JSON.stringify(raceData, null, 2), 'utf8');
console.log('✓ Spa race file updated successfully!');

// Summary
const avgScoreChange = results.reduce((sum, r) => sum + r.scoreDiff, 0) / results.length;
const increasedScores = results.filter(r => r.scoreDiff > 0).length;
const decreasedScores = results.filter(r => r.scoreDiff < 0).length;

console.log(`\nAverage score change: ${avgScoreChange.toFixed(2)}`);
console.log(`Scores increased: ${increasedScores}`);
console.log(`Scores decreased: ${decreasedScores}`);
console.log(`\nRace finishers (${raceLaps} laps): ${results.filter(r => r.lapsCompleted === raceLaps).length}`);
console.log(`Best average lap time: ${bestAvgLap.toFixed(3)}s`);
