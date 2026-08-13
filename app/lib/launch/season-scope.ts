import { promises as fs } from 'fs';
import path from 'path';

/**
 * A championship folder and one of its seasons, as named by the API routes that
 * edit season files.
 */
export interface SeasonScope {
  champ: string;
  season: string;
}

/**
 * Both values name files under app/data/championship, so nothing that walks the
 * tree is allowed through, and the season must actually exist as a .champ.
 */
export async function validateSeasonScope(
  champ: string | null | undefined,
  season: string | null | undefined
): Promise<SeasonScope | null> {
  if (!champ || !season) return null;
  if (/[\\/]|\.\./.test(champ)) return null;
  if (!/^season_\d{1,3}$/i.test(season)) return null;

  const champFile = path.join(
    process.cwd(),
    'app',
    'data',
    'championship',
    champ,
    `${season}.champ`
  );

  try {
    await fs.access(champFile);
    return { champ, season };
  } catch {
    return null;
  }
}
