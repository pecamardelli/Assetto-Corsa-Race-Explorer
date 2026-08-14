import { NextRequest, NextResponse } from 'next/server';
import { getChampionship } from '../../lib/race-data';
import { classOfCar, displacementOf } from '../../lib/car-classes';
import { pitCapacityFor, planClassGroups } from '../../lib/launch/groups';

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

  // Without the track's data there is no telling what fits, so nothing is proposed
  // rather than a split guessed at.
  const groups = capacity === null ? [] : planClassGroups(field, capacity);

  return NextResponse.json({
    track: roundData.track,
    capacity,
    entries: field.length,
    // True when the round cannot be raced whole and has to go out in batches.
    splitRequired: capacity !== null && field.length > capacity,
    groups,
    classes: field.map(entry => ({
      name: entry.name,
      car: entry.car,
      displacement: displacementOf(entry.car),
      carClass: classOfCar(entry.car).label,
    })),
  });
}
