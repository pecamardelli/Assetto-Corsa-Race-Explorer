import { NextRequest, NextResponse } from 'next/server';
import {
  clearPlayerAssists,
  deleteSeasonAssists,
  readGlobalAssists,
  readGlobalTraffic,
  resolveAssists,
  resolveTraffic,
  writeGlobalAssists,
  writeGlobalTraffic,
  resolvePlayerAssists,
  writePlayerAssists,
  writeSeasonAssists,
  writeSeasonTraffic,
} from '../../lib/launch/assists';
import { readPlayers } from '../../lib/players';
import { activePlayer } from '../../types/player';
import { validateSeasonScope } from '../../lib/launch/season-scope';
import { sanitizeAssists } from '../../types/assists';
import { sanitizeTraffic } from '../../types/traffic-preset';

/**
 * Game presets. With no scope this is the global config; `champ` + `season`
 * together scope it to one season's override.
 *
 * Both preset kinds ride on this one endpoint and share a `source`, because they share
 * a file: a season either has its own presets or follows the global ones, and splitting
 * that per kind would let a season half-override and read as neither.
 *
 * Driving aids have a third layer under those two: one driver's own, for a season more
 * than one of us drives. `mine` asks for that layer — the name is never taken from the
 * request, only ever from whoever holds the wheel. Traffic has no such layer: how busy
 * a road is belongs to the round, not to the person on it.
 */

/** Whoever is driving, for the calls that touch their own aids. */
async function currentPlayerName(): Promise<string> {
  return activePlayer(await readPlayers()).name;
}

function scopeParams(request: NextRequest): { champ: string | null; season: string | null } {
  const params = request.nextUrl.searchParams;
  return { champ: params.get('champ'), season: params.get('season') };
}

export async function GET(request: NextRequest) {
  const { champ, season } = scopeParams(request);

  if (!champ && !season) {
    return NextResponse.json({
      assists: await readGlobalAssists(),
      traffic: await readGlobalTraffic(),
      source: 'global',
    });
  }

  const scope = await validateSeasonScope(champ, season);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  // The effective config for whoever is driving: their own aids where they keep any,
  // and the layers behind that where they do not.
  const resolved = await resolvePlayerAssists(
    scope.champ,
    scope.season,
    await currentPlayerName()
  );
  const traffic = await resolveTraffic(scope.champ, scope.season);
  return NextResponse.json({ ...resolved, traffic: traffic.traffic });
}

export async function PUT(request: NextRequest) {
  let body: {
    assists?: unknown;
    traffic?: unknown;
    champ?: string;
    season?: string;
    /** Save the aids as the driver's own rather than as the season's. */
    mine?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  if (!body.assists || typeof body.assists !== 'object') {
    return NextResponse.json({ error: 'assists is required' }, { status: 400 });
  }

  const assists = sanitizeAssists(body.assists);
  // Traffic is optional on the way in, so an older client that only knows about assists
  // saves assists and leaves the traffic config alone rather than resetting it.
  const traffic = body.traffic === undefined ? null : sanitizeTraffic(body.traffic);

  if (!body.champ && !body.season) {
    await writeGlobalAssists(assists);
    if (traffic) await writeGlobalTraffic(traffic);
    return NextResponse.json({
      assists,
      traffic: traffic ?? (await readGlobalTraffic()),
      source: 'global',
    });
  }

  const scope = await validateSeasonScope(body.champ ?? null, body.season ?? null);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  // Traffic is always the season's: it is a property of the road, not of the driver.
  if (traffic) await writeSeasonTraffic(scope.champ, scope.season, traffic);

  if (body.mine) {
    await writePlayerAssists(scope.champ, scope.season, await currentPlayerName(), assists);
  } else {
    await writeSeasonAssists(scope.champ, scope.season, assists);
  }

  return NextResponse.json({
    assists,
    traffic: traffic ?? (await resolveTraffic(scope.champ, scope.season)).traffic,
    source: body.mine ? 'player' : 'season',
  });
}

/**
 * Drop an override so the layer behind it applies again.
 *
 * `mine=1` drops the driver's own aids and leaves them on the season's; without it the
 * season's aids and traffic go and it follows the global config, which is what that
 * button has always said. The season's lineup, grid caps and player seats live in the
 * same file and are none of this button's business, so they stay.
 */
export async function DELETE(request: NextRequest) {
  const { champ, season } = scopeParams(request);
  const mine = request.nextUrl.searchParams.get('mine') === '1';

  const scope = await validateSeasonScope(champ, season);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  if (mine) {
    await clearPlayerAssists(scope.champ, scope.season, await currentPlayerName());
    const resolved = await resolveAssists(scope.champ, scope.season);
    return NextResponse.json({
      ...resolved,
      traffic: (await resolveTraffic(scope.champ, scope.season)).traffic,
    });
  }

  await deleteSeasonAssists(scope.champ, scope.season);
  return NextResponse.json({
    assists: await readGlobalAssists(),
    traffic: await readGlobalTraffic(),
    source: 'global',
  });
}
