/**
 * Script to add 'retired' flags to existing race data
 *
 * This script analyzes historical race data and reconstructs the 'retired' flag
 * for each driver based on their distance covered vs expected distance.
 *
 * Retirement detection logic:
 * - A driver is considered retired if:
 *   1. They didn't complete all race laps, AND
 *   2. Their actual distance covered is less than 85% of expected distance
 *      (Expected distance = track_length × (laps_completed + partial_lap_completion))
 *
 * The 85% threshold accounts for measurement variations while reliably detecting
 * drivers who stopped significantly short of where they should be.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const RETIREMENT_RATIO_THRESHOLD = 0.85;
const DATA_DIR = path.join(__dirname, '..', 'app', 'data');

/**
 * Recursively find all JSON files in a directory
 */
function findJsonFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findJsonFiles(filePath, fileList);
    } else if (file.endsWith('.json') && file.includes('session_race')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Determine if a driver retired based on their statistics
 */
function isRetired(stats, raceLaps, trackLengthKm) {
  const laps = stats.laps_completed || 0;
  const partial = stats.partial_lap_completion || 0;
  const actualKm = stats.distance_covered_km || 0;

  // If driver completed all laps, they didn't retire
  if (laps >= raceLaps) {
    return false;
  }

  // Calculate expected distance
  const expectedKm = trackLengthKm * (laps + partial);

  // Avoid division by zero
  if (expectedKm === 0) {
    return false;
  }

  // Calculate ratio of actual to expected distance
  const ratio = actualKm / expectedKm;

  // Driver retired if they covered significantly less distance than expected
  return ratio < RETIREMENT_RATIO_THRESHOLD;
}

/**
 * Process a single race file and add retired flags
 */
function processRaceFile(filePath) {
  try {
    // Read the file
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Skip if not a race session or missing required data
    if (!data.session_info || !data.driver_statistics) {
      return { skipped: true, reason: 'Missing session_info or driver_statistics' };
    }

    const raceLaps = data.session_info.race_laps || 0;
    const trackLengthKm = data.session_info.track_length_km || 0;

    if (raceLaps === 0 || trackLengthKm === 0) {
      return { skipped: true, reason: 'Invalid race_laps or track_length_km' };
    }

    let updatedCount = 0;
    let retiredCount = 0;

    // Process each driver
    for (const [driverName, stats] of Object.entries(data.driver_statistics)) {
      // Check if retired flag already exists
      if (stats.hasOwnProperty('retired')) {
        continue; // Skip if already has the flag
      }

      // Determine retirement status
      const retired = isRetired(stats, raceLaps, trackLengthKm);
      stats.retired = retired;
      updatedCount++;

      if (retired) {
        retiredCount++;
      }
    }

    // Only write back if we made changes
    if (updatedCount > 0) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return {
        updated: true,
        driversUpdated: updatedCount,
        retirements: retiredCount,
        file: path.basename(filePath)
      };
    }

    return { skipped: true, reason: 'All drivers already have retired flag' };

  } catch (error) {
    return {
      error: true,
      message: error.message,
      file: path.basename(filePath)
    };
  }
}

/**
 * Main function
 */
function main() {
  console.log('='.repeat(80));
  console.log('Adding "retired" flags to existing race data');
  console.log('='.repeat(80));
  console.log();

  // Find all race files
  console.log('Searching for race data files...');
  const raceFiles = findJsonFiles(DATA_DIR);
  console.log(`Found ${raceFiles.length} race session files`);
  console.log();

  // Process each file
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalRetirements = 0;

  console.log('Processing files...');
  console.log();

  raceFiles.forEach((filePath, index) => {
    const result = processRaceFile(filePath);

    if (result.updated) {
      totalUpdated++;
      totalRetirements += result.retirements;
      console.log(`✓ [${index + 1}/${raceFiles.length}] ${result.file}`);
      console.log(`  Updated ${result.driversUpdated} drivers, ${result.retirements} retirements detected`);
    } else if (result.error) {
      totalErrors++;
      console.log(`✗ [${index + 1}/${raceFiles.length}] ${result.file}`);
      console.log(`  Error: ${result.message}`);
    } else if (result.skipped) {
      totalSkipped++;
      // Don't print skipped files to keep output clean
    }
  });

  // Summary
  console.log();
  console.log('='.repeat(80));
  console.log('Summary:');
  console.log('='.repeat(80));
  console.log(`Total files processed: ${raceFiles.length}`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log();
  console.log(`Total retirements detected: ${totalRetirements}`);
  console.log();
  console.log('Done!');
}

// Run the script
main();
