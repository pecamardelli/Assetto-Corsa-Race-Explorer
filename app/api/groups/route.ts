import { NextRequest, NextResponse } from 'next/server';
import { getChampionship } from '../../lib/race-data';
import { calculateStandings } from '../../lib/standings';
import {
  orderAtRandom,
  orderByStandings,
  pitCapacityFor,
  planGroups,
  seasonHasForm,
} from '../../lib/launch/groups';
import { Championship } from '../../types/race';

/**
 * How a round would have to be split to fit its track, and who would be in each
 * batch. Read-only: racing a batch is a POST to /api/launch with the group on it.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const champId = params.get('champId');
  const seasonId = params.get('seasonId');
  const round = Number(params.get('round'));

  if (!champId || !seasonId || !Number.isInteger(round)) {
    return NextResponse.json(
      { error: 'champId, seasonId and round are required' },
      { status: 400 }
    );
  }

  const championship = await getChampionship(champId);
  if (!championship) {
    return NextResponse.json({ error: `Unknown championship "${champId}"` }, { status: 404 });
  }

  const season = championship.seasons.find(
    entry => entry.seasonName.toLowerCase().replace(' ', '_') === seasonId.toLowerCase()
  );
  if (!season) {
    return NextResponse.json({ error: `Unknown season "${seasonId}"` }, { status: 404 });
  }

  const roundData = season.data.rounds[round - 1];
  if (!roundData) {
    return NextResponse.json({ error: `Round ${round} is not in this season` }, { status: 404 });
  }

  const capacity = await pitCapacityFor(roundData.track);
  const field = season.data.opponents;

  // Standings are a season's business, so ask this season rather than the whole
  // championship — the same season-scoped view the standings page builds.
  const seasonChampionship: Championship = {
    id: championship.id,
    data: season.data,
    folderName: championship.folderName,
    sessions: season.sessions,
    seasons: [season],
  };
  const standings = calculateStandings(seasonChampionship);

  // Seed on the table once there is one. The opening round has nothing to sort by, so
  // it is drawn — from the round's own name, so the draw survives a reload and the
  // batch shown in the menu is the batch that gets raced.
  const seededOn = seasonHasForm(standings) ? 'standings' : 'random';
  const order =
    seededOn === 'standings'
      ? orderByStandings(field, standings)
      : orderAtRandom(field, `${championship.id}|${season.seasonName}|${round}`);

  // Without the track's data there is no telling what fits, so nothing is proposed
  // rather than a split guessed at.
  const groups = capacity === null ? [] : planGroups(order, capacity);

  return NextResponse.json({
    track: roundData.track,
    capacity,
    entries: field.length,
    // True when the round cannot be raced whole and has to go out in batches.
    splitRequired: capacity !== null && field.length > capacity,
    seededOn,
    groups,
    order: order.map((entry, index) => ({
      name: entry.name,
      car: entry.car,
      running: index + 1,
      championship: standings.findIndex(s => s.name === entry.name) + 1 || null,
    })),
  });
}
