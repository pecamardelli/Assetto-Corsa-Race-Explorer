import { NextRequest, NextResponse } from 'next/server';
import { readSeasonLineup, writeSeasonLineup } from '../../lib/launch/assists';
import { validateSeasonScope } from '../../lib/launch/season-scope';
import { sanitizeLineup } from '../../types/lineup-preset';

/**
 * A season's lineup: which of its roster stays home. Season-scoped only (`champ` +
 * `season`), because a lineup is a list of that season's own names.
 */

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const scope = await validateSeasonScope(params.get('champ'), params.get('season'));
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }
  return NextResponse.json(await readSeasonLineup(scope.champ, scope.season));
}

export async function PUT(request: NextRequest) {
  let body: { champ?: string; season?: string; excluded?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const scope = await validateSeasonScope(body.champ, body.season);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  const lineup = sanitizeLineup({ excluded: body.excluded });
  await writeSeasonLineup(scope.champ, scope.season, lineup);
  return NextResponse.json(lineup);
}
