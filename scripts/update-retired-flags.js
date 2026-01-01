const fs = require("fs");
const path = require("path");

// CONFIGURATION - Modify these variables
const RACE_FILE = "stats_rj_spa_34_66-66_session_race_20251231_025608.json";
const MIN_LAPS_THRESHOLD = 7;

// File path construction
const filePath = path.join(
  __dirname,
  "../app/data/championship/Test Drive Tour/season_06",
  RACE_FILE
);

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

const driverNames = Object.keys(data.driver_statistics);
console.log("Total drivers:", driverNames.length);
console.log(`Checking for drivers with < ${MIN_LAPS_THRESHOLD} laps...\n`);

let updatedCount = 0;
driverNames.forEach((name) => {
  const driver = data.driver_statistics[name];
  if (driver.laps_completed < MIN_LAPS_THRESHOLD && !driver.retired) {
    console.log(
      `Setting retired=true for ${name}: ${driver.laps_completed} laps`
    );
    driver.retired = true;
    updatedCount++;
  }
});

console.log(`\nUpdated ${updatedCount} drivers to retired=true`);

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log("File updated successfully!");
