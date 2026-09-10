import { promises as fs } from 'fs';
import path from 'path';

/**
 * Starting a championship's next season by copying its last one.
 *
 * A season is a `season_NN.champ` beside a `season_NN/` folder of race results, with
 * `season_NN.races.json` and `season_NN.presets.json` as optional sidecars. Every one
 * of those except the results is what the *next* season wants too: the same roster in
 * the same cars, the same points and penalties, the same calendar until the rounds are
 * edited, the same assists and the same lineup. So a new season is the last one's files
 * copied forward under the next number, with an empty results folder — never the last
 * one's races, which belong to the season that ran them.
 *
 * Nothing here decides whether the last season is *finished*. A championship is allowed
 * more than one season in flight, and the page that offers the button says how far the
 * last one has got.
 */

const CHAMPIONSHIP_DIR = path.join(process.cwd(), 'app', 'data', 'championship');

/** The sidecars copied forward, in the order the report lists them. */
const SIDECARS = ['.races.json', '.presets.json'] as const;

export interface NewSeason {
  /** The folder-and-file stem of the season created, e.g. `season_03`. */
  season: string;
  /** The season it was copied from. */
  copiedFrom: string;
  /** Which files were written, relative to the championship folder. */
  files: string[];
}

export type NewSeasonError =
  | { error: 'unknown-championship' }
  | { error: 'no-seasons' }
  | { error: 'already-exists'; season: string };

/** A championship id is one folder name; anything else could walk out of the data tree. */
export function isChampionshipId(champ: string | null | undefined): champ is string {
  return !!champ && !/[\\/]|\.\./.test(champ);
}

function stem(n: number): string {
  return `season_${String(n).padStart(2, '0')}`;
}

/**
 * The season numbers a championship has, highest last. Read off the `.champ` files
 * rather than the folders, because the `.champ` is what makes a season exist —
 * a season that has not been raced yet has no folder until this creates one.
 */
async function seasonNumbers(champPath: string): Promise<number[]> {
  const entries = await fs.readdir(champPath, { withFileTypes: true });
  const numbers = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.champ'))
    .map(entry => /^season_(\d+)\.champ$/i.exec(entry.name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(match => parseInt(match[1], 10));
  return [...new Set(numbers)].sort((a, b) => a - b);
}

/**
 * Copy a championship's last season forward under the next number.
 *
 * Returns what was created, or why it could not be.
 */
export async function duplicateLastSeason(champ: string): Promise<NewSeason | NewSeasonError> {
  if (!isChampionshipId(champ)) return { error: 'unknown-championship' };

  const champPath = path.join(CHAMPIONSHIP_DIR, champ);
  let numbers: number[];
  try {
    numbers = await seasonNumbers(champPath);
  } catch {
    return { error: 'unknown-championship' };
  }
  if (numbers.length === 0) return { error: 'no-seasons' };

  const from = stem(numbers[numbers.length - 1]);
  const to = stem(numbers[numbers.length - 1] + 1);

  // The check is on the whole season, not just its .champ: a leftover results folder
  // under that number would silently become the new season's history.
  for (const name of [`${to}.champ`, to, ...SIDECARS.map(suffix => `${to}${suffix}`)]) {
    try {
      await fs.access(path.join(champPath, name));
      return { error: 'already-exists', season: to };
    } catch {
      // absent, which is what we want
    }
  }

  const files: string[] = [];
  // `wx` so a season that appears between the check above and here is not overwritten.
  await fs.copyFile(
    path.join(champPath, `${from}.champ`),
    path.join(champPath, `${to}.champ`),
    fs.constants.COPYFILE_EXCL
  );
  files.push(`${to}.champ`);

  for (const suffix of SIDECARS) {
    try {
      await fs.copyFile(
        path.join(champPath, `${from}${suffix}`),
        path.join(champPath, `${to}${suffix}`),
        fs.constants.COPYFILE_EXCL
      );
      files.push(`${to}${suffix}`);
    } catch {
      // The source has no such sidecar. Both are optional; the season reads its
      // defaults when one is missing.
    }
  }

  await fs.mkdir(path.join(champPath, to), { recursive: true });
  files.push(`${to}/`);

  return { season: to, copiedFrom: from, files };
}
