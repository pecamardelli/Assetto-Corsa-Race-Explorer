import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  deleteSeasonAssists,
  readGlobalAssists,
  resolveAssists,
  writeGlobalAssists,
  writeSeasonAssists,
} from '../../lib/launch/assists';
import { sanitizeAssists } from '../../types/assists';

/**
 * Game presets. With no scope this is the global config; `champ` + `season`
 * together scope it to one season's override.
 */

interface SeasonScope {
  champ: string;
  season: string;
}

/**
 * Both values name files under app/data/championship, so nothing that walks the
 * tree is allowed through, and the season must actually exist as a .champ.
 */
async function validateScope(
  champ: string | null,
  season: string | null
): Promise<SeasonScope | null> {
  if (!champ || !season) return null;
  if (/[\\/]|\.\./.test(champ)) return null;
  if (!/^season_\d{1,3}$/i.test(season)) return null;

  const champFile = path.join(
    process.cwd(),
    'app',
    'data',
    'championship',
    champ,
    `${season}.champ`
  );

  try {
    await fs.access(champFile);
    return { champ, season };
  } catch {
    return null;
  }
}

function scopeParams(request: NextRequest): { champ: string | null; season: string | null } {
  const params = request.nextUrl.searchParams;
  return { champ: params.get('champ'), season: params.get('season') };
}

export async function GET(request: NextRequest) {
  const { champ, season } = scopeParams(request);

  if (!champ && !season) {
    return NextResponse.json({ assists: await readGlobalAssists(), source: 'global' });
  }

  const scope = await validateScope(champ, season);
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

  const scope = await validateScope(body.champ ?? null, body.season ?? null);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  await writeSeasonAssists(scope.champ, scope.season, assists);
  return NextResponse.json({ assists, source: 'season' });
}

/** Remove a season's override so it follows the global config again. */
export async function DELETE(request: NextRequest) {
  const { champ, season } = scopeParams(request);

  const scope = await validateScope(champ, season);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  await deleteSeasonAssists(scope.champ, scope.season);
  return NextResponse.json({ assists: await readGlobalAssists(), source: 'global' });
}
