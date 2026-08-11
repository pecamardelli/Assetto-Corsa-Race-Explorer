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
 * The flag is only ever set, never cleared. A driver above the winner's time has
 * not necessarily finished — lap times count the wall clock, so someone who
 * crashed and sat there can bank one enormous lap and land above the winner — so
 * an existing retirement is always left alone.
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

/**
 * Flip one driver's retired flag in the raw file text.
 *
 * Re-serialising the whole file would rewrite it top to bottom: these results were
 * written by Python, which keeps a trailing ".0" on whole floats where
 * JSON.stringify does not. Same data, but it churns every line of a file for the
 * sake of one field, so the value is patched where it sits instead.
 */
function setRetiredInText(text, driverName) {
  // Python wrote these with ensure_ascii on, so a name like "André Lefèbvre" sits
  // in the file as "André Lefèbvre". Try the literal key first, then the
  // escaped one.
  const escaped = [...driverName]
    .map((char) =>
      char.charCodeAt(0) > 0x7f
        ? "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")
        : char,
    )
    .join("");

  let driverAt = text.indexOf(`"${driverName}":`);
  if (driverAt === -1) driverAt = text.indexOf(`"${escaped}":`);
  if (driverAt === -1) return null;

  const flagAt = text.indexOf('"retired":', driverAt);
  if (flagAt === -1) return null;

  const valueAt = text.indexOf("false", flagAt);
  // Guard against running past this driver's block into the next one.
  if (valueAt === -1 || valueAt > flagAt + 20) return null;

  return text.slice(0, valueAt) + "true" + text.slice(valueAt + "false".length);
}

let filesChanged = 0;
let driversChanged = 0;

const candidates = collectJsonFiles(dataDir).filter(
  (file) => !filter || file.includes(filter),
);

for (const file of candidates) {
  let text;
  let data;
  try {
    text = fs.readFileSync(file, "utf8");
    data = JSON.parse(text);
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

    // Only ever set the flag. Being above the winner's time does not prove a
    // driver finished: total_time counts the wall clock of each lap, so someone
    // who crashed and sat there can bank a single enormous lap and land above
    // the winner. Clearing on that basis would throw away real retirements.
    if (time >= winnerTime || stats.retired === true) continue;

    const patched = setRetiredInText(text, name);
    if (!patched) {
      console.warn(`  ! could not locate the retired flag for ${name} in ${file}`);
      continue;
    }

    text = patched;
    changes.push(`${name}: retired (${stats.laps_completed} laps, ${time.toFixed(1)}s)`);
  }

  if (changes.length === 0) continue;

  filesChanged += 1;
  driversChanged += changes.length;

  console.log(`\n${path.relative(dataDir, file)}  (winner ${winner[0]}, ${winnerTime.toFixed(1)}s)`);
  for (const change of changes) console.log(`  ${change}`);

  if (write) fs.writeFileSync(file, text);
}

console.log(
  `\n${driversChanged} driver(s) across ${filesChanged} race(s) ` +
    (write ? "updated." : "would change. Re-run with --write to apply."),
);
