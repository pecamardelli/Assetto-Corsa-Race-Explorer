import { promises as fs } from 'fs';
import path from 'path';
import { Championship } from '../types/race';
import { resolveDriverPortrait } from './driver-assets';
import { calculateStandings, calculateConstructorStandings } from './standings';

/**
 * Who currently holds a championship, for the card that advertises it.
 *
 * "Current" means the last season that actually finished. A season halfway through
 * has a leader, not a champion, and putting the leader's face on the card would
 * make the front page contradict itself the moment the next round is raced.
 */
export interface ChampionshipStats {
  currentChampion: string;
  /** Null when the champion has no portrait on disk, or there is no champion yet. */
  currentChampionPortrait: string | null;
  currentConstructorChampion: string;
  currentConstructorBadge: string | null;
}

export const NO_STATS: ChampionshipStats = {
  currentChampion: '-',
  currentChampionPortrait: null,
  currentConstructorChampion: '-',
  currentConstructorBadge: null,
};

/** The brand badge a car races under, or null when we don't have that badge. */
async function resolveCarBadge(carName: string): Promise<string | null> {
  try {
    await fs.access(path.join(process.cwd(), 'public', 'badges', `${carName}.png`));
    return `/badges/${encodeURIComponent(carName)}.png`;
  } catch {
    return null;
  }
}

export async function getChampionshipStats(
  championships: Championship[]
): Promise<Map<string, ChampionshipStats>> {
  const stats = new Map<string, ChampionshipStats>();

  for (const championship of championships) {
    let currentChampion = '-';
    let currentConstructorChampion = '-';
    let currentChampionPortrait: string | null = null;
    let currentConstructorBadge: string | null = null;

    // The most recent season all of whose rounds have been raced.
    const latestCompletedSeason = [...championship.seasons].reverse().find(season => {
      if (season.sessions.length === 0) return false;

      const completedRaces = season.sessions.filter(session => {
        const sessionType = session.data.session_type || session.data.session_info.session_type;
        return sessionType === 'race';
      }).length;

      return completedRaces === season.data.rounds.length;
    });

    if (latestCompletedSeason) {
      const seasonChampionship: Championship = {
        id: championship.id,
        data: latestCompletedSeason.data,
        folderName: championship.folderName,
        sessions: latestCompletedSeason.sessions,
        seasons: [latestCompletedSeason],
      };

      const standings = calculateStandings(seasonChampionship);
      if (standings.length > 0) {
        currentChampion = standings[0].name;
        currentChampionPortrait = await resolveDriverPortrait(currentChampion, championship.id);
      }

      const constructorStandings = calculateConstructorStandings(seasonChampionship);
      if (constructorStandings.length > 0) {
        currentConstructorChampion = constructorStandings[0].brand;
        currentConstructorBadge = await resolveCarBadge(constructorStandings[0].carName);
      }
    }

    stats.set(championship.id, {
      currentChampion,
      currentChampionPortrait,
      currentConstructorChampion,
      currentConstructorBadge,
    });
  }

  return stats;
}
