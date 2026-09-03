import { NextRequest, NextResponse } from 'next/server';
import {
  deleteSeasonAssists,
  readGlobalAssists,
  readGlobalTraffic,
  resolveAssists,
  resolveTraffic,
  writeGlobalAssists,
  writeGlobalTraffic,
  writeSeasonAssists,
  writeSeasonTraffic,
} from '../../lib/launch/assists';
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
 */

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

  const resolved = await resolveAssists(scope.champ, scope.season);
  const traffic = await resolveTraffic(scope.champ, scope.season);
  return NextResponse.json({ ...resolved, traffic: traffic.traffic });
}

export async function PUT(request: NextRequest) {
  let body: { assists?: unknown; traffic?: unknown; champ?: string; season?: string };
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

  await writeSeasonAssists(scope.champ, scope.season, assists);
  if (traffic) await writeSeasonTraffic(scope.champ, scope.season, traffic);
  return NextResponse.json({
    assists,
    traffic: traffic ?? (await resolveTraffic(scope.champ, scope.season)).traffic,
    source: 'season',
  });
}

/** Remove a season's override so it follows the global config again. */
export async function DELETE(request: NextRequest) {
  const { champ, season } = scopeParams(request);

  const scope = await validateSeasonScope(champ, season);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  // Drops the whole presets file, so the season goes back to the global config for
  // every kind it holds - assists and traffic together. That is what the button says.
  await deleteSeasonAssists(scope.champ, scope.season);
  return NextResponse.json({
    assists: await readGlobalAssists(),
    traffic: await readGlobalTraffic(),
    source: 'global',
  });
}
