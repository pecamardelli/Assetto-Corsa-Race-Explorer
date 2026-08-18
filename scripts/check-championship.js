/**
 * Check a season's .champ against what Assetto Corsa actually has installed.
 *
 * A .champ file is a list of names, and Assetto Corsa's answer to a name it does not
 * recognise is to fail at load with nothing useful said. So this reads the rounds and
 * the entry list and asks the content folder about every one of them: does the track
 * exist, does the layout, does the car, does the skin. It also compares the size of
 * the field against the track's own pit box count, since that — not maxCars — is what
 * caps a grid.
 *
 * Usage:
 *   node scripts/check-championship.js                       # every championship
 *   node scripts/check-championship.js "European Challenge"   # just the one
 */

const fs = require('fs');
const path = require('path');

const AC_PATH = 'C:\\GAMES\\Assetto Corsa';
const TRACKS_DIR = path.join(AC_PATH, 'content', 'tracks');
const CARS_DIR = path.join(AC_PATH, 'content', 'cars');
const CHAMP_DIR = path.join(__dirname, '..', 'app', 'data', 'championship');
const TRACK_DATA_DIR = path.join(__dirname, '..', 'app', 'data', 'tracks');

const only = process.argv[2];

function exists(target) {
  return fs.existsSync(target);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

/**
 * Split a round's track string into folder + layout.
 *
 * The naive split on the last hyphen is wrong for folders that contain one without
 * having a layout at all ("monza_faux_pre-war"), so the installed content decides and
 * the split is only the fallback.
 */
function resolveTrack(roundTrack) {
  if (exists(path.join(TRACKS_DIR, roundTrack))) return { folder: roundTrack, layout: '' };

  const cut = roundTrack.lastIndexOf('-');
  if (cut === -1) return { folder: roundTrack, layout: '' };

  return { folder: roundTrack.slice(0, cut), layout: roundTrack.slice(cut + 1) };
}

/** Pit boxes as the app knows them, from the track data it has on file. */
function pitBoxes(roundTrack) {
  const file = path.join(TRACK_DATA_DIR, `${roundTrack}.json`);
  if (!exists(file)) return null;

  const boxes = Number(readJson(file).pitboxes);
  return Number.isFinite(boxes) && boxes > 0 ? boxes : null;
}

let problems = 0;
const note = (mark, text) => {
  if (mark === '✗') problems += 1;
  console.log(`   ${mark} ${text}`);
};

const champFolders = fs
  .readdirSync(CHAMP_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .filter(entry => !only || entry.name === only)
  .map(entry => entry.name);

if (!champFolders.length) {
  console.log(only ? `No championship folder named "${only}"` : 'No championships found');
  process.exit(1);
}

for (const champ of champFolders) {
  const seasons = fs
    .readdirSync(path.join(CHAMP_DIR, champ))
    .filter(file => file.endsWith('.champ'))
    .sort();

  for (const seasonFile of seasons) {
    const data = readJson(path.join(CHAMP_DIR, champ, seasonFile));
    const racing = data.opponents.filter(entry => entry.traffic !== true);
    const traffic = data.opponents.filter(entry => entry.traffic === true);

    console.log(`\n${data.name} — ${seasonFile.replace('.champ', '')}`);
    console.log(
      `   ${racing.length} racing, ${traffic.length} traffic, ${data.rounds.length} rounds`
    );

    console.log('\n   Rounds');
    data.rounds.forEach((round, index) => {
      const { folder, layout } = resolveTrack(round.track);
      const trackDir = path.join(TRACKS_DIR, folder);
      const label = `${String(index + 1).padStart(2, ' ')}. ${round.track}`;

      if (!exists(trackDir)) {
        note('✗', `${label} — track folder not installed`);
        return;
      }

      if (layout && !exists(path.join(trackDir, layout))) {
        const available = fs
          .readdirSync(trackDir, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && exists(path.join(trackDir, entry.name, 'ai')))
          .map(entry => entry.name);
        note(
          '✗',
          `${label} — no layout "${layout}"${
            available.length ? ` (has: ${available.join(', ')})` : ''
          }`
        );
        return;
      }

      // The whole field has to fit the pits at once, or the round goes out in batches.
      const boxes = pitBoxes(round.track);
      const field = data.opponents.length;
      if (boxes === null) {
        note('✓', `${label} — installed, pit boxes unknown`);
      } else if (field > boxes) {
        note('✓', `${label} — installed, ${boxes} boxes for ${field} cars: splits into batches`);
      } else {
        note('✓', `${label} — installed, ${boxes} boxes for ${field} cars`);
      }
    });

    console.log('\n   Entries');
    // Counted on its own, so a missing track does not silence the entry list's
    // own verdict.
    const before = problems;
    const seen = new Set();
    for (const entry of data.opponents) {
      const key = `${entry.car}|${entry.skin}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const carDir = path.join(CARS_DIR, entry.car);
      if (!exists(carDir)) {
        note('✗', `${entry.car} — car not installed (${entry.name})`);
      } else if (!exists(path.join(carDir, 'skins', entry.skin))) {
        const skins = exists(path.join(carDir, 'skins'))
          ? fs.readdirSync(path.join(carDir, 'skins'), { withFileTypes: true })
              .filter(item => item.isDirectory())
              .map(item => item.name)
          : [];
        note(
          '✗',
          `${entry.car} — no skin "${entry.skin}" (${entry.name})${
            skins.length ? ` — has: ${skins.slice(0, 6).join(', ')}${skins.length > 6 ? '…' : ''}` : ''
          }`
        );
      }
    }
    if (problems === before) {
      console.log(`   ✓ all ${seen.size} car/skin combinations on the entry list are installed`);
    }
  }
}

console.log(problems ? `\n${problems} problem(s) found.` : '\nAll clear.');
