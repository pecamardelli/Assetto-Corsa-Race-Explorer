import { NextRequest, NextResponse } from 'next/server';
import { getChampionship } from '../../lib/race-data';
import { pitCapacityFor, planGroups } from '../../lib/launch/groups';
import { fieldOrder } from '../../lib/launch/field-order';
import { readSeasonGridCaps } from '../../lib/launch/assists';
import { resolveRaceSpec } from '../../lib/launch/race-spec';

/**
 * How a round would have to be split to fit its track, who would be in each batch,
 * and whether it is a round that qualifies at all. Read-only: racing a batch is a
 * POST to /api/launch with the group on it.
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

  // The track's pit boxes are the ceiling; a season may set a lower one per round in
  // its presets file, for a paddock whose boxes are not all far enough apart.
  const pitboxes = await pitCapacityFor(roundData.track);
  const caps = await readSeasonGridCaps(championship.folderName, seasonId.toLowerCase());
  const cap = caps[roundData.track];
  const capacity =
    cap === undefined ? pitboxes : Math.min(cap, pitboxes ?? Number.POSITIVE_INFINITY);
  const field = season.data.opponents;

  // The championship table seeds the batches, and on a point-to-point round it is
  // the grid as well. Drawn from the round's own name before a season has any form
  // to seed on, so the draw survives a reload and the batch shown in the menu is
  // the batch that gets raced.
  const { order, seededOn, standings } = fieldOrder(championship, season, round);

  // A round run from a start to a finish somewhere else is raced without qualifying,
  // so the menu offers the race itself rather than a weekend.
  const spec = await resolveRaceSpec(
    championship.folderName,
    seasonId.toLowerCase(),
    season.data,
    round
  );

  // Without the track's data there is no telling what fits, so nothing is proposed
  // rather than a split guessed at.
  const groups = capacity === null ? [] : planGroups(order, capacity);

  return NextResponse.json({
    track: roundData.track,
    capacity,
    // What the track actually has, when the season has asked for fewer.
    pitboxes,
    capped: cap !== undefined,
    entries: field.length,
    // True when the round cannot be raced whole and has to go out in batches.
    splitRequired: capacity !== null && field.length > capacity,
    pointToPoint: spec?.spec.pointToPoint ?? false,
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
