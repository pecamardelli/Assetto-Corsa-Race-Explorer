#!/usr/bin/env node
/**
 * Check the traffic fleet table against the install.
 *
 *   node scripts/check-traffic-fleets.js
 *
 * For every fleet in app/data/traffic-fleets.json: is each model id installed in CSP's
 * traffic data folder (a JSON plus the three kn5 it names)? For every championship
 * round flagged cspTraffic: does its track resolve to a fleet? Exit 1 on any miss, so
 * a rename in the manifest or a model that failed to build is caught before a launch
 * writes it into TRAFFIC_CARS and the mode quietly drops it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FLEETS = path.join(ROOT, 'app', 'data', 'traffic-fleets.json');
const CHAMPS = path.join(ROOT, 'app', 'data', 'championship');
const GAME = process.env.AC_ROOT || 'C:\\GAMES\\Assetto Corsa';
const TRAFFIC_DATA = path.join(GAME, 'extension', 'lua', 'tools', 'csp-traffic-tool', 'data');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function modelInstalled(id) {
  const json = path.join(TRAFFIC_DATA, `${id}.json`);
  if (!fs.existsSync(json)) return `${id}: no ${id}.json in the traffic data folder`;
  let cfg;
  try {
    cfg = readJson(json);
  } catch (error) {
    return `${id}: unreadable json (${error.message})`;
  }
  for (const key of ['main', 'lod', 'collider']) {
    const file = path.join(TRAFFIC_DATA, String(cfg[key] || ''));
    if (!cfg[key] || !fs.existsSync(file)) return `${id}: ${key} model missing (${cfg[key]})`;
  }
  const lamps = Object.values(cfg.lights || {}).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
  return lamps === 0 ? `${id}: installed but unlit (no lamp meshes)` : null;
}

function resolveFleet(table, roundTrack) {
  const candidates = [roundTrack];
  const dash = roundTrack.lastIndexOf('-');
  if (dash > 0) candidates.push(roundTrack.slice(0, dash));
  for (const key of candidates) {
    const fleet = table.tracks[key];
    if (fleet && (table.fleets[fleet] || []).length > 0) return fleet;
  }
  return null;
}

function main() {
  const table = readJson(FLEETS);
  let failures = 0;
  const warnings = [];

  console.log(`traffic data: ${TRAFFIC_DATA}`);
  for (const [name, entries] of Object.entries(table.fleets)) {
    const problems = [];
    for (const entry of entries) {
      const problem = modelInstalled(entry.id);
      if (!problem) continue;
      if (problem.includes('unlit')) warnings.push(problem);
      else problems.push(problem);
    }
    const total = entries.reduce((n, e) => n + e.weight, 0);
    console.log(`  ${name.padEnd(14)} ${String(entries.length).padStart(3)} models, weight ${total.toFixed(2)}${problems.length ? `, ${problems.length} MISSING` : ''}`);
    for (const problem of problems) console.log(`      ! ${problem}`);
    failures += problems.length;
  }

  console.log('\nrounds:');
  for (const champ of fs.readdirSync(CHAMPS)) {
    const dir = path.join(CHAMPS, champ);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.champ')) continue;
      let data;
      try {
        data = readJson(path.join(dir, file));
      } catch {
        continue;
      }
      for (const round of data.rounds || []) {
        if (!round.cspTraffic) continue;
        const fleet = resolveFleet(table, round.track);
        if (!fleet) {
          console.log(`  ! ${champ} ${file}: ${round.track} has no fleet (the mode will run every model)`);
          failures += 1;
        } else {
          console.log(`  ${champ.padEnd(20)} ${round.track.padEnd(50)} -> ${fleet}`);
        }
      }
    }
  }

  if (warnings.length) {
    console.log(`\n${warnings.length} model(s) unlit:`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log(failures ? `\n${failures} problem(s)` : '\nall fleets resolve and every model is installed');
  process.exit(failures ? 1 : 0);
}

main();
