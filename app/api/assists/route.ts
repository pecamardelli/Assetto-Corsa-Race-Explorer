import { NextRequest, NextResponse } from 'next/server';
import {
  deleteSeasonAssists,
  readGlobalAssists,
  resolveAssists,
  writeGlobalAssists,
  writeSeasonAssists,
} from '../../lib/launch/assists';
import { validateSeasonScope } from '../../lib/launch/season-scope';
import { sanitizeAssists } from '../../types/assists';

/**
 * Game presets. With no scope this is the global config; `champ` + `season`
 * together scope it to one season's override.
 */

function scopeParams(request: NextRequest): { champ: string | null; season: string | null } {
  const params = request.nextUrl.searchParams;
  return { champ: params.get('champ'), season: params.get('season') };
}

export async function GET(request: NextRequest) {
  const { champ, season } = scopeParams(request);

  if (!champ && !season) {
    return NextResponse.json({ assists: await readGlobalAssists(), source: 'global' });
  }

  const scope = await validateSeasonScope(champ, season);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  const resolved = await resolveAssists(scope.champ, scope.season);
  return NextResponse.json(resolved);
}

export async function PUT(request: NextRequest) {
  let body: { assists?: unknown; champ?: string; season?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  if (!body.assists || typeof body.assists !== 'object') {
    return NextResponse.json({ error: 'assists is required' }, { status: 400 });
  }

  const assists = sanitizeAssists(body.assists);

  if (!body.champ && !body.season) {
    await writeGlobalAssists(assists);
    return NextResponse.json({ assists, source: 'global' });
  }

  const scope = await validateSeasonScope(body.champ ?? null, body.season ?? null);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  await writeSeasonAssists(scope.champ, scope.season, assists);
  return NextResponse.json({ assists, source: 'season' });
}

/** Remove a season's override so it follows the global config again. */
export async function DELETE(request: NextRequest) {
  const { champ, season } = scopeParams(request);

  const scope = await validateSeasonScope(champ, season);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  await deleteSeasonAssists(scope.champ, scope.season);
  return NextResponse.json({ assists: await readGlobalAssists(), source: 'global' });
}
