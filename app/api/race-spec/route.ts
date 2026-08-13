import { NextRequest, NextResponse } from 'next/server';
import {
  deleteRaceSpec,
  listWeathers,
  readSeasonChampionship,
  resolveRaceSpec,
  writeRaceSpec,
} from '../../lib/launch/race-spec';
import { validateSeasonScope } from '../../lib/launch/season-scope';
import { sanitizeRaceSpec } from '../../types/race-spec';

/**
 * The settings one round is raced with. Saving writes an override next to the
 * season's .champ, which is left alone; DELETE drops the override again.
 */

interface Target {
  champ: string;
  season: string;
  round: number;
}

/**
 * Everything the round's spec is resolved from: a valid season, a round that is
 * really in it, and the championship the round belongs to.
 */
async function resolveTarget(
  champ: string | null | undefined,
  season: string | null | undefined,
  round: unknown
): Promise<{ target: Target; error?: never } | { target?: never; error: NextResponse }> {
  const notFound = NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });

  const scope = await validateSeasonScope(champ, season);
  if (!scope) return { error: notFound };

  const roundNumber = typeof round === 'number' ? round : Number(round);
  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    return {
      error: NextResponse.json({ error: 'round must be a round number' }, { status: 400 }),
    };
  }

  return { target: { champ: scope.champ, season: scope.season, round: roundNumber } };
}

async function respond(target: Target) {
  const data = await readSeasonChampionship(target.champ, target.season);
  if (!data) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  // The editor needs the installed folders to offer them, spec or no spec.
  const weathers = await listWeathers();
  const resolved = await resolveRaceSpec(target.champ, target.season, data, target.round);

  if (!resolved) {
    return NextResponse.json({ error: 'That round is not in this season' }, { status: 404 });
  }

  return NextResponse.json({ ...resolved, weathers, round: target.round });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { target, error } = await resolveTarget(
    params.get('champ'),
    params.get('season'),
    params.get('round')
  );
  if (error) return error;

  return respond(target);
}

export async function PUT(request: NextRequest) {
  let body: { champ?: string; season?: string; round?: number; spec?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  if (!body.spec || typeof body.spec !== 'object') {
    return NextResponse.json({ error: 'spec is required' }, { status: 400 });
  }

  const { target, error } = await resolveTarget(body.champ, body.season, body.round);
  if (error) return error;

  const data = await readSeasonChampionship(target.champ, target.season);
  if (!data) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  // Resolved first so anything the body leaves out falls back to what the round
  // already runs with, rather than to some global default.
  const current = await resolveRaceSpec(target.champ, target.season, data, target.round);
  if (!current) {
    return NextResponse.json({ error: 'That round is not in this season' }, { status: 404 });
  }

  const spec = sanitizeRaceSpec(body.spec, current.championship);
  await writeRaceSpec(target.champ, target.season, target.round, spec);

  return respond(target);
}

/** Drop a round's override so it follows the championship file again. */
export async function DELETE(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { target, error } = await resolveTarget(
    params.get('champ'),
    params.get('season'),
    params.get('round')
  );
  if (error) return error;

  await deleteRaceSpec(target.champ, target.season, target.round);

  return respond(target);
}
