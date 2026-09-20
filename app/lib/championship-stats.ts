import { promises as fs } from 'fs';
import path from 'path';
import { Championship } from '../types/race';
import { resolveDriverPortrait } from './driver-assets';
import { calculateStandings, calculateConstructorStandings } from './standings';
import { racesInTraffic } from './traffic';
import { completedSeasonRanking } from './road-series-ranking';
import { getCarDetails, getCarPreviewUrl } from './car-data';

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
  /** A road series raced in traffic: the card says so, and shows `bestScore` instead. */
  traffic: boolean;
  /** Null for a circuit series, and for a road series with no completed season yet. */
  bestScore: BestScore | null;
}

/**
 * What a road series has in place of a champion: the top of its all-time table. There
 * is no title to hold on a coast road and no constructors' cup among the traffic, so
 * the card shows the best season score ever posted, who posted it, and in what.
 */
export interface BestScore {
  score: number;
  driver: string;
  driverPortrait: string | null;
  seasonName: string;
  carBrand: string;
  carModel: string;
  carPreview: string | null;
}

export const NO_STATS: ChampionshipStats = {
  currentChampion: '-',
  currentChampionPortrait: null,
  currentConstructorChampion: '-',
  currentConstructorBadge: null,
  traffic: false,
  bestScore: null,
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
    if (racesInTraffic(championship.data, championship.sessions)) {
      const best = completedSeasonRanking(championship)[0];
      const car = best ? getCarDetails(best.car) : null;
      stats.set(championship.id, {
        ...NO_STATS,
        traffic: true,
        bestScore: best && car
          ? {
              score: best.score,
              driver: best.name,
              driverPortrait: await resolveDriverPortrait(best.name, championship.id),
              seasonName: best.seasonName,
              carBrand: car.brand,
              carModel: car.model,
              carPreview: getCarPreviewUrl(best.car),
            }
          : null,
      });
      continue;
    }

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
      traffic: false,
      bestScore: null,
    });
  }

  return stats;
}
