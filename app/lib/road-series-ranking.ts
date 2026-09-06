import { Championship } from '../types/race';
import { calculateStandings } from './standings';
import { mergeGroupedRounds } from './round-groups';

/**
 * The all-time table of a road series, in the shape the first two Test Drives kept it:
 * a high-score list.
 *
 * A circuit championship's all-time page adds a driver's seasons together — career
 * wins, career points. A run down a coast road is not a career; it is a score and a
 * time, and the thing worth keeping is the best runs ever posted. So every completed
 * season contributes one entry per driver, carrying that season's score and time, and
 * the entries are ranked together. A driver who has driven three seasons appears three
 * times, wherever each of those seasons put them, which is exactly how an arcade high
 * score table treats the same initials.
 *
 * Only a finished season posts a score: a table that moved every time a round was
 * raced would let a half-season sit above a whole one. Nothing completed, nothing
 * listed.
 */
export interface SeasonScore {
  name: string;
  nation: string;
  seasonName: string;
  seasonNumber: number;
  /** The season's Test Drive score (`total_score` summed over its rounds). */
  score: number;
  /** Seconds on the road over the season. */
  time: number;
  crashes: number;
  wins: number;
  racesCompleted: number;
  /** The car folder the season was driven in (its last race's, if it changed). */
  car: string;
  /** When the season's last race was filed, as the result file wrote it. */
  completedOn: string;
}

/** A season is complete once every round has a race on file, batches merged. */
function seasonComplete(season: Championship['seasons'][number]): boolean {
  if (season.sessions.length === 0 || season.data.rounds.length === 0) return false;
  const races = mergeGroupedRounds(season.sessions).filter(session => {
    const sessionType = session.data.session_type || session.data.session_info.session_type;
    return sessionType === 'race';
  });
  return races.length >= season.data.rounds.length;
}

/** The last race date a season's results carry, or '' when they carry none. */
function completionDate(season: Championship['seasons'][number]): string {
  return season.sessions
    .map(session => session.data.session_info.date)
    .filter((date): date is string => typeof date === 'string' && date.length > 0)
    .sort()
    .pop() ?? '';
}

export function completedSeasonRanking(championship: Championship): SeasonScore[] {
  const entries: SeasonScore[] = [];

  for (const season of championship.seasons) {
    if (!seasonComplete(season)) continue;

    const seasonChampionship: Championship = {
      id: championship.id,
      data: season.data,
      folderName: championship.folderName,
      sessions: season.sessions,
      seasons: [season],
    };
    const completedOn = completionDate(season);

    for (const standing of calculateStandings(seasonChampionship)) {
      entries.push({
        name: standing.name,
        nation: standing.nation,
        seasonName: season.seasonName,
        seasonNumber: season.seasonNumber,
        score: standing.customPoints,
        time: standing.totalTime,
        crashes: standing.crashes,
        wins: standing.wins,
        racesCompleted: standing.racesCompleted,
        car: standing.car,
        completedOn,
      });
    }
  }

  // Highest score first; the same score is settled by less time on the road.
  return entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.time !== b.time) return a.time - b.time;
    if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
    return a.name.localeCompare(b.name);
  });
}
