/**
 * Tests for app/lib/new-season.ts — the New Season button's copy.
 *
 *   npx tsx scripts/test-new-season.mjs
 *
 * The module reads app/data/championship under process.cwd(), so the test builds a
 * throwaway tree in the system temp folder, copies two real championships into it and
 * chdirs there. Nothing under app/data is touched, and creating a season is a write:
 * this must never be pointed at the real folder.
 */
import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const REPO = path.resolve(import.meta.dirname, '..');
const REAL = path.join(REPO, 'app', 'data', 'championship');

const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'new-season-'));
const data = path.join(sandbox, 'app', 'data', 'championship');
await fs.mkdir(data, { recursive: true });
// A championship on its second season, one on its first, and one with no season at all.
await fs.cp(path.join(REAL, 'European Challenge'), path.join(data, 'European Challenge'), { recursive: true });
await fs.cp(path.join(REAL, 'Oceania Challenge'), path.join(data, 'Oceania Challenge'), { recursive: true });
await fs.mkdir(path.join(data, 'Empty Cup'));

process.chdir(sandbox);
const { duplicateLastSeason, isChampionshipId } = await import(
  pathToFileURL(path.join(REPO, 'app', 'lib', 'new-season.ts')).href
);

const dir = p => path.join(data, p);
const exists = p => fs.access(p).then(() => true, () => false);
const ok = message => console.log('ok  ' + message);

let r = await duplicateLastSeason('European Challenge');
assert.deepEqual(r, {
  season: 'season_03',
  copiedFrom: 'season_02',
  files: ['season_03.champ', 'season_03.races.json', 'season_03.presets.json', 'season_03/'],
});
for (const f of r.files) assert(await exists(dir(`European Challenge/${f}`)), `missing ${f}`);
assert.equal(
  await fs.readFile(dir('European Challenge/season_03.champ'), 'utf8'),
  await fs.readFile(dir('European Challenge/season_02.champ'), 'utf8'),
  'the .champ was not copied verbatim'
);
assert.deepEqual(await fs.readdir(dir('European Challenge/season_03')), [], 'the new season carries races');
assert(
  (await fs.readdir(dir('European Challenge/season_02'))).length > 0,
  'the source season had no races, so leaving them behind proves nothing'
);
ok('copies the last season forward, with an empty results folder');

r = await duplicateLastSeason('European Challenge');
assert.deepEqual(r, {
  season: 'season_04',
  copiedFrom: 'season_03',
  files: ['season_04.champ', 'season_04.races.json', 'season_04.presets.json', 'season_04/'],
});
ok('a second call makes the season after, copying the one just made');

// Half a season under the next number — a sidecar or a results folder with no .champ —
// is what the scan cannot see, so it is refused rather than absorbed.
await fs.writeFile(dir('European Challenge/season_05.presets.json'), '{"stray":true}');
assert.deepEqual(await duplicateLastSeason('European Challenge'), {
  error: 'already-exists',
  season: 'season_05',
});
assert.equal(
  await fs.readFile(dir('European Challenge/season_05.presets.json'), 'utf8'),
  '{"stray":true}',
  'a stray sidecar was overwritten'
);
assert.equal(await exists(dir('European Challenge/season_05.champ')), false);
await fs.rm(dir('European Challenge/season_05.presets.json'));
ok('a stray sidecar under the next number blocks the copy, and survives it');

await fs.mkdir(dir('Oceania Challenge/season_02'));
assert.deepEqual(await duplicateLastSeason('Oceania Challenge'), {
  error: 'already-exists',
  season: 'season_02',
});
await fs.rmdir(dir('Oceania Challenge/season_02'));
ok('a stray results folder under the next number blocks the copy');

r = await duplicateLastSeason('Oceania Challenge');
assert.deepEqual(r.files, [
  'season_02.champ',
  'season_02.races.json',
  'season_02.presets.json',
  'season_02/',
]);
ok('a championship on its first season goes to its second');

assert.deepEqual(await duplicateLastSeason('Empty Cup'), { error: 'no-seasons' });
ok('a championship with no .champ has nothing to copy');

assert.deepEqual(await duplicateLastSeason('Nope Cup'), { error: 'unknown-championship' });
for (const bad of ['../secrets', 'a/b', String.raw`a\b`, '..', 'x/../../y']) {
  assert.equal(isChampionshipId(bad), false, bad);
  assert.deepEqual(await duplicateLastSeason(bad), { error: 'unknown-championship' }, bad);
}
assert.equal(isChampionshipId('European Challenge'), true, 'a real name with a space');
ok('rejects unknown ids and anything that walks out of the data folder');

process.chdir(REPO);
await fs.rm(sandbox, { recursive: true, force: true });
console.log('\nAll clear.');
