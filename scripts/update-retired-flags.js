#!/usr/bin/env node

/**
 * Set the `retired` flag on race results already on disk.
 *
 * A driver whose race time is under the winner's stopped before the end, so they
 * did not finish. This is the same rule racestats.py now applies when it saves a
 * session; this script is for races recorded before that.
 *
 * Being lapped does not trigger it. AC lets a car finish the lap it is on when the
 * leader takes the flag, so a driver who was still running banks that final lap
 * after the winner's finish and lands above the winner's total.
 *
 * Usage:
 *   node scripts/update-retired-flags.js                  # every race, dry run
 *   node scripts/update-retired-flags.js --write          # every race, applied
 *   node scripts/update-retired-flags.js "Le Mans" --write  # only matching paths
 *
 * Only race sessions are touched: practice and qualifying have no winner covering
 * a distance to measure anyone against.
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const write = args.includes("--write");
const filter = args.find((arg) => !arg.startsWith("--"));

const dataDir = path.join(__dirname, "..", "app", "data");

function collectJsonFiles(dir) {
  const found = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...collectJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      found.push(full);
    }
  }

  return found;
}

function isRace(data, file) {
  const declared = data.session_type || data.session_info?.session_type;
  if (declared) return declared === "race";

  // Older files carry the session only in their name.
  return path.basename(file).includes("_session_race_");
}

let filesChanged = 0;
let driversChanged = 0;

const candidates = collectJsonFiles(dataDir).filter(
  (file) => !filter || file.includes(filter),
);

for (const file of candidates) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    continue; // not a result file
  }

  const drivers = data.driver_statistics;
  if (!drivers || !isRace(data, file)) continue;

  const entries = Object.entries(drivers);
  const winner = entries.find(([, s]) => s.position === 1);
  if (!winner) continue;

  const winnerTime = winner[1].total_time_seconds;
  if (typeof winnerTime !== "number") continue;

  const changes = [];

  for (const [name, stats] of entries) {
    const time = stats.total_time_seconds;
    if (typeof time !== "number") continue;

    const retired = time < winnerTime;
    if (stats.retired === retired) continue;

    changes.push(`${name}: ${stats.retired} -> ${retired} (${stats.laps_completed} laps, ${time.toFixed(1)}s)`);
    stats.retired = retired;
  }

  if (changes.length === 0) continue;

  filesChanged += 1;
  driversChanged += changes.length;

  console.log(`\n${path.relative(dataDir, file)}  (winner ${winner[0]}, ${winnerTime.toFixed(1)}s)`);
  for (const change of changes) console.log(`  ${change}`);

  if (write) fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

console.log(
  `\n${driversChanged} driver(s) across ${filesChanged} race(s) ` +
    (write ? "updated." : "would change. Re-run with --write to apply."),
);
