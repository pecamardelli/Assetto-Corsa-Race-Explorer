import { DriverStatistics, RaceData, RaceSession, SessionInfo } from '../types/race';
import { safeNumber } from './format-utils';

/**
 * A round too big for its track is run in groups: the field is split into batches
 * small enough to fit the pits, each batch races on its own, and the round is
 * classified on all of them together. It is how the hillclimbs of the period were
 * actually run — cars went up in batches and the clock, not the batch, decided the
 * order — and it is the only way a thirty-two car championship can visit a pass
 * with sixteen pit boxes.
 *
 * Assetto Corsa knows nothing about any of this. Each group is an ordinary session
 * and lands as its own result file, so without merging them a two-group round would
 * pay out its points twice: a winner per group, each collecting the full twenty-five.
 *
 * Merging happens on the way into the standings rather than on the way in from disk,
 * so the season page still lists each group as its own race and you can open one and
 * read it. What the championship counts, though, is the round.
 *
 * And it counts nothing until the round is over. A batch on its own is not a result:
 * the winner of the first eight cars up a hill has not won anything until the other
 * twenty-four have had their run and the clock has put them all in one order. So the
 * groups of a round that is still going out are withheld from the standings
 * altogether — no points, no win, no start — and the round appears the moment its
 * last batch is filed. Holding them back also keeps the round's own draw still:
 * batches are seeded on the table, and a table that moved half way through a round
 * would deal the remaining batches a different set of drivers.
 */

/** Sessions are only ever merged with others carrying the same label here. */
function groupKey(session: RaceSession): string | null {
  const info = session.data.session_info;
  const label = typeof info.group === 'string' ? info.group.trim() : '';
  const round = info.round;

  // A result with no group is a round raced whole, and stands on its own — which is
  // every result filed before groups existed.
  if (!label || typeof round !== 'number') return null;

  const sessionType = session.data.session_type ?? info.session_type;
  if (!sessionType) return null;

  // Rounds are numbered per season, so the season's folder is part of the identity:
  // all-time standings walk sessions from every championship at once.
  const season = session.filename.split('/').slice(0, -1).join('/');

  return `${season}|${round}|${sessionType}`;
}

/**
 * How many batches the round these sessions came from was divided into, as they
 * themselves report it, or null when none of them says.
 *
 * The largest answer wins: a round raced before the count was recorded leaves
 * batches that cannot say, and one of them saying four is enough to know.
 */
function declaredGroupCount(members: RaceSession[]): number | null {
  const counts = members
    .map(member => safeNumber(member.data.session_info.group_count, 0))
    .filter(count => count > 1);

  return counts.length ? Math.max(...counts) : null;
}

/** Batches of a round that have run, counted by name so a re-run is not two. */
function groupsRun(members: RaceSession[]): number {
  return new Set(
    members.map(member => String(member.data.session_info.group ?? '').trim())
  ).size;
}

/**
 * Whether every batch of a round is in.
 *
 * Results filed before the count was recorded cannot say how many there were, so
 * two batches are taken to be the whole round — which is what the standings assumed
 * of them before this, and the most that can be made of a result that never wrote
 * the number down. Every launch records it now.
 */
function groupsComplete(members: RaceSession[]): boolean {
  const declared = declaredGroupCount(members);
  return declared === null ? groupsRun(members) >= 2 : groupsRun(members) >= declared;
}

/**
 * Whether the race sessions filed for one round add up to a round that was run.
 *
 * The season page asks this to decide whether a round still has racing left in it:
 * a round part way through its batches must go on offering the rest of them as
 * sessions that count, rather than as re-runs for the fun of it.
 */
export function roundFullyRaced(sessions: RaceSession[]): boolean {
  // A session the driver quit out of is a partial record, and leaves the round open.
  const finished = sessions.filter(session => session.data.session_info.finished !== false);
  if (finished.length === 0) return false;

  const batches = finished.filter(session =>
    String(session.data.session_info.group ?? '').trim()
  );

  // Anything filed without a batch name is the round raced whole, and settles it.
  if (batches.length < finished.length) return true;

  return groupsComplete(batches);
}

/** Laps a driver got round, counting the part-lap a retirement stopped on. */
function distance(stats: DriverStatistics): number {
  return safeNumber(stats.laps_completed, 0) + safeNumber(stats.partial_lap_completion, 0);
}

/**
 * Order a merged field.
 *
 * Qualifying sorts on the one lap that matters. A race sorts on distance first and
 * elapsed time second, which is what lets two grids that never saw each other be
 * ranked against one another at all: they covered the same course under the same
 * conditions, so the clock is common ground even though the racing was not.
 *
 * Anyone who retired drops behind everyone still running at the end, however far
 * they got — a retirement is not a finish, and the group it happened in should not
 * change that.
 */
function classificationOrder(
  entries: Array<[string, DriverStatistics]>,
  sessionType: string
): Array<[string, DriverStatistics]> {
  if (sessionType === 'qualifying') {
    return [...entries].sort(([nameA, a], [nameB, b]) => {
      const lapA = safeNumber(a.best_lap, 0);
      const lapB = safeNumber(b.best_lap, 0);

      // A driver who never set a time sorts to the back rather than to the front.
      const rankA = lapA > 0 ? lapA : Infinity;
      const rankB = lapB > 0 ? lapB : Infinity;

      if (rankA !== rankB) return rankA - rankB;
      return nameA.localeCompare(nameB);
    });
  }

  return [...entries].sort(([nameA, a], [nameB, b]) => {
    if (a.retired !== b.retired) return a.retired ? 1 : -1;

    const distanceA = distance(a);
    const distanceB = distance(b);
    if (distanceA !== distanceB) return distanceB - distanceA;

    const timeA = safeNumber(a.total_time_seconds, 0);
    const timeB = safeNumber(b.total_time_seconds, 0);

    // A driver the stats never timed cannot be placed on the clock, so they fall
    // in behind those who were.
    const rankA = timeA > 0 ? timeA : Infinity;
    const rankB = timeB > 0 ? timeB : Infinity;

    if (rankA !== rankB) return rankA - rankB;
    return nameA.localeCompare(nameB);
  });
}

/** The round's own header, assembled from the headers of the groups that ran it. */
function mergeSessionInfo(members: RaceSession[], groups: string[]): SessionInfo {
  const infos = members.map(member => member.data.session_info);
  const [first] = infos;

  const bestTimes = infos
    .map(info => safeNumber(info.best_total_time_seconds, 0))
    .filter(time => time > 0);

  const totalCars = infos.reduce((sum, info) => sum + safeNumber(info.total_cars, 0), 0);

  return {
    ...first,
    // The round took as long as it took: from the first group going out to the last
    // one coming in, the sum is a truer figure than any single group's clock.
    session_duration_seconds: infos.reduce(
      (sum, info) => sum + safeNumber(info.session_duration_seconds, 0),
      0
    ),
    session_duration_formatted: undefined,
    total_cars: totalCars || undefined,
    best_total_time_seconds: bestTimes.length ? Math.min(...bestTimes) : undefined,
    // The merged record belongs to the round, not to any one group that made it up.
    group: undefined,
    groups,
    // A round is only wholly run once every group of it has been.
    finished: infos.every(info => info.finished !== false),
  };
}

/**
 * Fold every set of group results into the single round each set stands for.
 *
 * Sessions that carry no group come back untouched and in their original order, so
 * a season that has never split a round is not changed by passing through here.
 */
export function mergeGroupedRounds(sessions: RaceSession[]): RaceSession[] {
  const grouped = new Map<string, RaceSession[]>();

  for (const session of sessions) {
    const key = groupKey(session);
    if (!key) continue;

    const existing = grouped.get(key);
    if (existing) existing.push(session);
    else grouped.set(key, [session]);
  }

  // A round still going out scores nothing at all: its batches are set aside here
  // and come back as one round once the last of them has run.
  const withheld = new Set<RaceSession>();
  for (const [key, members] of grouped) {
    if (groupsComplete(members)) continue;

    for (const member of members) withheld.add(member);
    grouped.delete(key);
  }

  if (grouped.size === 0 && withheld.size === 0) return sessions;

  const merged = new Set<RaceSession>();
  for (const members of grouped.values()) {
    for (const member of members) merged.add(member);
  }

  const emitted = new Set<string>();
  const output: RaceSession[] = [];

  for (const session of sessions) {
    // A batch of a round that is not finished yet is no part of anything scored.
    if (withheld.has(session)) continue;

    if (!merged.has(session)) {
      output.push(session);
      continue;
    }

    // The merged round takes the place of the first of its groups to appear, which
    // keeps the season's chronological order intact.
    const key = groupKey(session) as string;
    if (emitted.has(key)) continue;
    emitted.add(key);

    output.push(mergeMembers(grouped.get(key) as RaceSession[]));
  }

  return output;
}

/** Build the one session that stands for a round from the groups that ran it. */
function mergeMembers(members: RaceSession[]): RaceSession {
  const ordered = [...members].sort(
    (a, b) =>
      new Date(a.data.session_info.date).getTime() - new Date(b.data.session_info.date).getTime()
  );

  const first = ordered[0];
  const sessionType = first.data.session_type ?? first.data.session_info.session_type ?? 'race';

  const groups = ordered
    .map(member => String(member.data.session_info.group ?? '').trim())
    .filter(Boolean);

  const entries: Array<[string, DriverStatistics]> = [];
  const cars: Record<string, unknown> = {};

  for (const member of ordered) {
    for (const [name, stats] of Object.entries(member.data.driver_statistics)) {
      entries.push([name, stats]);
    }
    Object.assign(cars, member.data.cars ?? {});
  }

  // Every group ran the same course, so the round's order is the whole field on one
  // list — the position each driver held inside their own group is discarded.
  const classified = classificationOrder(entries, sessionType);

  const driverStatistics: Record<string, DriverStatistics> = {};
  classified.forEach(([name, stats], index) => {
    driverStatistics[name] = { ...stats, position: index + 1 };
  });

  const data: RaceData = {
    ...first.data,
    session_info: mergeSessionInfo(ordered, groups),
    driver_statistics: driverStatistics,
    cars: Object.keys(cars).length ? (cars as RaceData['cars']) : first.data.cars,
    session_type: sessionType as RaceData['session_type'],
  };

  return { ...first, data };
}
