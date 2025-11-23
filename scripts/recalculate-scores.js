/**
 * Recalculate all race scores with updated base score formula
 *
 * New formula: base_score = track_length_m × laps_completed
 * Old formula: base_score = (track_length_m × (laps_completed + partial_lap)) / race_laps
 */

const fs = require('fs');
const path = require('path');

// Crash penalty parameters (matching racestats.py)
const CRASH_PENALTY_PERCENT_PER_G = 0.01;
const MAX_CRASH_PENALTY_PER_CRASH = 100.0;

/**
 * Calculate score using the NEW formula
 */
function calculateNewScore(driverStats, sessionInfo, bestLapTime, hasFastestLap) {
    const lapsCompleted = driverStats.laps_completed;
    const trackLength = sessionInfo.track_length_meters;
    const totalCars = sessionInfo.total_cars;
    const position = driverStats.position;
    const raceLaps = sessionInfo.race_laps;

    // Base score: track_length × laps_completed (NEW FORMULA)
    // Only count fully completed laps for base score
    const baseScore = trackLength * lapsCompleted;

    // Position factor: (total_cars - position + 1) / total_cars
    const positionFactor = totalCars > 0 && position > 0
        ? (totalCars - position + 1) / totalCars
        : 1.0;

    // Speed factor: based on best lap time
    let speedFactor;
    if (lapsCompleted > 0 && bestLapTime > 0) {
        const driverBestLap = driverStats.best_lap;
        speedFactor = bestLapTime / driverBestLap;
        // Cap at 1.0 - fastest driver gets 1.0, slower drivers get less
        if (speedFactor > 1.0) {
            speedFactor = 1.0;
        }
    } else {
        // Driver completed no laps, penalty
        speedFactor = 0.5;
    }

    // Crash penalty factor
    const crashIntensities = driverStats.crashes?.crash_intensities_g || [];
    const cappedCrashIntensities = crashIntensities.map(g => Math.min(g, MAX_CRASH_PENALTY_PER_CRASH));
    const cappedCrashIntensity = cappedCrashIntensities.reduce((sum, g) => sum + g, 0);

    const crashFactor = 1.0 - (cappedCrashIntensity * CRASH_PENALTY_PERCENT_PER_G / 100.0);
    const crashPenaltyPercent = cappedCrashIntensity * CRASH_PENALTY_PERCENT_PER_G;

    // Final score = base × position × speed × crash
    let totalScore = baseScore * positionFactor * speedFactor * crashFactor;

    // Fastest lap bonus: 5% bonus if driver has fastest lap
    let fastestLapBonus = 0.0;
    if (hasFastestLap) {
        fastestLapBonus = totalScore * 0.05;
        totalScore = totalScore * 1.05;
    }

    return {
        totalScore: Math.ceil(totalScore),
        scoreBreakdown: {
            base_score: Math.round(baseScore * 100) / 100,
            position_factor: Math.round(positionFactor * 1000) / 1000,
            speed_factor: Math.round(speedFactor * 1000) / 1000,
            crash_factor: Math.round(crashFactor * 1000) / 1000,
            crash_penalty_percent: Math.round(crashPenaltyPercent * 100) / 100,
            fastest_lap_bonus: hasFastestLap ? Math.round(fastestLapBonus * 100) / 100 : 0.0
        }
    };
}

/**
 * Process a single stats file
 */
function processStatsFile(filePath) {
    console.log(`Processing: ${filePath}`);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!data.session_info || !data.driver_statistics) {
        console.log(`  Skipping: Invalid file format`);
        return;
    }

    const sessionInfo = data.session_info;
    const driverStats = data.driver_statistics;

    // Find the best lap time and fastest driver
    let bestLapTime = 0.0;
    let fastestDriver = null;

    for (const [driverName, stats] of Object.entries(driverStats)) {
        if (stats.laps_completed > 0 && stats.best_lap > 0) {
            if (bestLapTime === 0.0 || stats.best_lap < bestLapTime) {
                bestLapTime = stats.best_lap;
                fastestDriver = driverName;
            }
        }
    }

    // Recalculate scores for each driver
    let scoresChanged = 0;
    for (const [driverName, stats] of Object.entries(driverStats)) {
        const hasFastestLap = (driverName === fastestDriver);
        const newScoreData = calculateNewScore(stats, sessionInfo, bestLapTime, hasFastestLap);

        const oldScore = stats.total_score;
        const newScore = newScoreData.totalScore;

        if (oldScore !== newScore) {
            scoresChanged++;
            console.log(`  ${driverName}: ${oldScore} → ${newScore} (${newScore > oldScore ? '+' : ''}${newScore - oldScore})`);
        }

        // Update the stats
        stats.total_score = newScore;
        stats.score_breakdown = newScoreData.scoreBreakdown;
    }

    if (scoresChanged > 0) {
        // Write the updated data back to the file
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`  ✓ Updated ${scoresChanged} driver(s) in ${path.basename(filePath)}`);
    } else {
        console.log(`  No changes needed`);
    }
}

/**
 * Recursively find all stats files
 */
function findStatsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findStatsFiles(filePath, fileList);
        } else if (file.includes('stats') && file.endsWith('.json')) {
            fileList.push(filePath);
        }
    }

    return fileList;
}

/**
 * Main function
 */
function main() {
    console.log('Recalculating race scores with new base score formula...\n');

    // Find all stats files
    const championshipDir = path.resolve(__dirname, '..', 'app', 'data', 'championship');
    const statsFiles = findStatsFiles(championshipDir);

    console.log(`Found ${statsFiles.length} stats files\n`);

    // Process each file
    let totalProcessed = 0;
    for (const fullPath of statsFiles) {
        try {
            processStatsFile(fullPath);
            totalProcessed++;
        } catch (error) {
            console.error(`Error processing ${fullPath}:`, error.message);
        }
        console.log('');
    }

    console.log(`\nCompleted! Processed ${totalProcessed} files.`);
}

main();
