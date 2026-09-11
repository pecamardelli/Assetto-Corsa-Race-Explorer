import { getChampionships } from './race-data';
import { safeNumber, safeString } from './format-utils';
import { RaceSession } from '../types/race';

/**
 * The high-score table of a road, in the shape an arcade machine keeps one.
 *
 * A Test Drive round is not a race against a grid — most of them are a car, a road and
 * whatever traffic is on it — so the standings a circuit round posts mean nothing here.
 * What the road keeps instead is every run ever made down it: one entry per driver per
 * race, carrying the score that run posted, ranked highest first. Drive the same road
 * again in another season and you get another entry, above or below your old one.
 *
 * Only Test Drive results are listed. A circuit race scores on a different formula
 * entirely (position and pace against the field, crashes charged by their g), so its
 * numbers would sit in this table as nonsense. A track raced both ways keeps the two
 * apart: the circuit rounds have their fastest-lap standings, the road runs have this.
 *
 * Every series is read, not just the one the run came from. The road is the constant.
 */
export interface TrackHighScore {
  name: string;
  nation: string;
  /** The car folder the run was driven in. */
  car: string;
  /** The series the run was posted in, and its folder for linking. */
  championship: string;
  championshipId: string;
  seasonName: string;
  seasonNumber: number;
  /** When the run was filed, as the result file wrote it. */
  date: string;
  score: number;
  /** Seconds on the road. */
  time: number;
  distanceKm: number;
  averageSpeedKmh: number;
  crashes: number;
  /** The result file the run is in, so the row can open its race. */
  filename: string;
}

/** A track and a layout name the same road only when both match. */
function sameTrack(session: RaceSession, track: string, trackConfig: string): boolean {
  const info = session.data.session_info;
  return (
    safeString(info.track).toLowerCase() === track.toLowerCase() &&
    safeString(info.track_config).toLowerCase() === trackConfig.toLowerCase()
  );
}

/** Whether this session is a Test Drive race — the only kind this table scores. */
function isTestDriveRace(session: RaceSession): boolean {
  const info = session.data.session_info;
  const sessionType = session.data.session_type ?? info.session_type;
  return sessionType === 'race' && info.traffic_race === true;
}

export async function getTrackHighScores(
  track: string,
  trackConfig?: string
): Promise<TrackHighScore[]> {
  const config = safeString(trackConfig);
  const championships = await getChampionships();
  const entries: TrackHighScore[] = [];

  for (const championship of championships) {
    for (const season of championship.seasons) {
      // The roster carries the nationalities; a result file only sometimes does.
      const nations = new Map<string, string>();
      season.data.opponents?.forEach(opponent => {
        nations.set(opponent.name, opponent.nation);
      });

      for (const session of season.sessions) {
        if (!isTestDriveRace(session) || !sameTrack(session, track, config)) continue;

        const info = session.data.session_info;
        for (const [name, stats] of Object.entries(session.data.driver_statistics)) {
          const score = safeNumber(stats.total_score, 0);
          if (score <= 0) continue;

          const time = safeNumber(stats.total_time_seconds, 0);
          const distanceKm =
            safeNumber(stats.score_breakdown?.distance_km, 0) ||
            safeNumber(stats.distance_covered_km, 0) ||
            safeNumber(info.track_length_km, 0) * safeNumber(stats.laps_completed, 0);
          const averageSpeedKmh =
            safeNumber(stats.score_breakdown?.average_speed_kmh, 0) ||
            safeNumber(stats.average_speed_kmh, 0) ||
            (time > 0 ? (distanceKm / time) * 3600 : 0);

          entries.push({
            name,
            nation: safeString(stats.nation) || nations.get(name) || '',
            car: safeString(stats.car_name),
            championship: safeString(championship.data.name, championship.id),
            championshipId: championship.folderName,
            seasonName: season.seasonName,
            seasonNumber: season.seasonNumber,
            date: safeString(info.date),
            score,
            time,
            distanceKm,
            averageSpeedKmh,
            crashes: safeNumber(stats.crashes?.total_crashes, 0),
            filename: session.filename,
          });
        }
      }
    }
  }

  // Highest score first; the same score is settled by less time on the road, then by
  // the older run, which is how a machine that never forgets ranks a tie.
  return entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.time !== b.time) return a.time - b.time;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.name.localeCompare(b.name);
  });
}
