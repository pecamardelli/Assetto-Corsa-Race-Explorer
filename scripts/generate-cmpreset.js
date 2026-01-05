#!/usr/bin/env node

/**
 * Generate Content Manager Race Grid Preset from Championship JSON
 *
 * Usage:
 *   1. Edit the configuration constants at the top of this file:
 *      - QUALIFYING_JSON_PATH: Path to qualifying results JSON
 *      - CHAMPIONSHIP_FILE: Path to championship .champ file
 *      - TRACK_NAME, SESSION_NUMBER, etc.
 *
 *   2. Run: node generate-cmpreset.js
 *
 * The script will generate a .cmpreset file with the grid sorted by qualifying positions.
 */

const fs = require("fs");
const path = require("path");

// ============================================================================
// CONFIGURATION: Set these paths and options
// ============================================================================
const QUALIFYING_JSON_PATH =
  "app/data/championship/Test Drive Tour/season_07/stats_rj_lemans_1967-54_session_qualifying_20260105_010947.json";

const CHAMPIONSHIP_FILE =
  "app/data/championship/Test Drive Tour/season_07.champ";

const PLAYER_NAME = "Pablin"; // Your driver name - used to determine starting position from qualifying

const OUTPUT_FILE = null; // null = auto-generate path in AppData
const TRACK_NAME = "lemans";
const SESSION_NUMBER = "6";
const AI_LEVEL = 100.0;
const AI_LEVEL_MIN = 95.0;
const AI_AGGRESSION = 100.0;
// ============================================================================

// Country code to full name mapping
const COUNTRY_CODES = {
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Belgium",
  BRA: "Brazil",
  CAN: "Canada",
  CHE: "Switzerland",
  DEU: "Germany",
  ESP: "Spain",
  FIN: "Finland",
  FRA: "France",
  GBR: "Great Britain",
  GEO: "Georgia",
  HRV: "Croatia",
  IRL: "Ireland",
  ITA: "Italy",
  JOR: "Jordan",
  JPN: "Japan",
  KEN: "Kenya",
  NGA: "Nigeria",
  NLD: "Netherlands",
  PAN: "Panama",
  POL: "Poland",
  RUS: "Russia",
  SCT: "Scotland",
  SWE: "Sweden",
  USA: "USA",
  VEN: "Venezuela",
};

function loadChampionship(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    // Remove BOM if present
    const cleanData = data.replace(/^\uFEFF/, "");
    return JSON.parse(cleanData);
  } catch (error) {
    console.error(`Error loading championship file: ${error.message}`);
    process.exit(1);
  }
}

function loadQualifyingResults(qualyPath) {
  try {
    if (!qualyPath || !fs.existsSync(qualyPath)) {
      console.log("No qualifying results found, using championship order");
      return null;
    }

    const data = fs.readFileSync(qualyPath, "utf8");
    const cleanData = data.replace(/^\uFEFF/, "");
    return JSON.parse(cleanData);
  } catch (error) {
    console.warn(
      `Warning: Could not load qualifying results: ${error.message}`
    );
    return null;
  }
}

function generateQualifyingGrid(championship, trackName) {
  // Get all opponents excluding PLAYER and the actual player name
  const opponents = championship.opponents.filter(
    (opp) => opp.name !== "PLAYER" && opp.name !== PLAYER_NAME
  );

  // Load qualifying results if available
  const qualyResults = loadQualifyingResults(QUALIFYING_JSON_PATH);

  let sortedOpponents = [...opponents];

  if (qualyResults && qualyResults.driver_statistics) {
    console.log("Sorting grid by qualifying results...");

    // Create a map of driver name to qualifying position
    const qualyPositions = new Map();
    Object.entries(qualyResults.driver_statistics).forEach(
      ([driverName, stats]) => {
        qualyPositions.set(driverName, stats.position);
      }
    );

    // Sort opponents by qualifying position
    sortedOpponents.sort((a, b) => {
      const posA = qualyPositions.get(a.name) || 999;
      const posB = qualyPositions.get(b.name) || 999;
      return posA - posB;
    });

    console.log("Grid sorted by qualifying positions:");
    sortedOpponents.slice(0, 5).forEach((opp, i) => {
      const pos = qualyPositions.get(opp.name);
      console.log(`  ${i + 1}. ${opp.name} (P${pos})`);
    });
  } else {
    console.log("Using championship order (no qualifying results)");
  }

  // Build the grid arrays in qualifying order (excluding player)
  const carIds = [];
  const names = [];
  const nationalities = [];

  sortedOpponents.forEach((opp) => {
    carIds.push(opp.car);
    names.push(opp.name);

    const nationality = COUNTRY_CODES[opp.nation] || opp.nation;
    nationalities.push(nationality);
  });

  return { carIds, names, nationalities };
}

function generateCMPreset(grid, playerPosition) {
  const preset = {
    ModeId: "custom",
    FilterValue: "",
    CarIds: grid.carIds,
    Names: grid.names,
    Nationalities: grid.nationalities,
    ShuffleCandidates: true,
    VarietyLimitation: 0,
    OpponentsNumber: grid.carIds.length,
    StartingPosition: playerPosition,
    AiLevel: AI_LEVEL,
    AiLevelMin: AI_LEVEL_MIN,
    AiLevelArrangeRandom: 0.1,
    AiLevelArrangeReverse: false,
    AiLevelArrangePowerRatio: false,
    AiAggression: AI_AGGRESSION,
    AiAggressionMin: AI_AGGRESSION,
    AiAggressionArrangeRandom: 0.1,
    AiAggressionArrangeReverse: false,
  };

  return preset;
}

function getDefaultOutputPath(championship) {
  // Convert championship name to snake_case
  const champName = championship.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const session = SESSION_NUMBER || "qualy";
  const track = TRACK_NAME || "grid";

  // Format: {championship_name}_session_{session_number}_{track_name}.cmpreset
  const fileName = `${champName}_session_${session}_${track}.cmpreset`;

  return path.join(
    process.env.LOCALAPPDATA,
    "AcTools Content Manager",
    "Presets",
    "Race Grids",
    fileName
  );
}

function main() {
  console.log("Loading championship file:", CHAMPIONSHIP_FILE);
  const championship = loadChampionship(CHAMPIONSHIP_FILE);

  console.log(`Championship: ${championship.name}`);
  console.log(
    `Opponents: ${championship.opponents.length - 1} (excluding PLAYER)`
  );

  const grid = generateQualifyingGrid(championship, TRACK_NAME);

  console.log(`Generated grid with ${grid.carIds.length} drivers`);

  // Determine player's starting position from qualifying
  const qualyResults = loadQualifyingResults(QUALIFYING_JSON_PATH);
  let playerPosition = 1; // Default to P1 if not found

  if (
    qualyResults &&
    qualyResults.driver_statistics &&
    qualyResults.driver_statistics[PLAYER_NAME]
  ) {
    playerPosition = qualyResults.driver_statistics[PLAYER_NAME].position;
    console.log(`Player "${PLAYER_NAME}" qualified in P${playerPosition}`);
  } else {
    console.warn(
      `Warning: Could not find player "${PLAYER_NAME}" in qualifying results, defaulting to P1`
    );
  }

  const preset = generateCMPreset(grid, playerPosition);

  // Determine output file
  const outputFile = OUTPUT_FILE || getDefaultOutputPath(championship);

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write preset (single line JSON like CM does)
  fs.writeFileSync(outputFile, JSON.stringify(preset));

  console.log(`\n✓ CM Preset saved to: ${outputFile}`);
  console.log(`  Starting Position: P${playerPosition}`);
  console.log(`\nGrid Preview (first 10):`);
  for (let i = 0; i < Math.min(10, grid.names.length); i++) {
    console.log(
      `  ${i + 1}. ${grid.names[i]} (${grid.nationalities[i]}) - ${
        grid.carIds[i]
      }`
    );
  }
  if (grid.names.length > 10) {
    console.log(`  ... and ${grid.names.length - 10} more`);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateQualifyingGrid, generateCMPreset, COUNTRY_CODES };
