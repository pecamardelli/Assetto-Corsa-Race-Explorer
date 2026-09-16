import { NextRequest, NextResponse } from 'next/server';
import {
  addPlayer,
  readPlayers,
  removePlayer,
  setActivePlayer,
} from '../../lib/players';
import { resolveDriverPortraits } from '../../lib/driver-assets';
import { PlayersConfig, primaryPlayer } from '../../types/player';

/**
 * Who is at the keyboard.
 *
 * One setting for the whole app: every launch, every car pick and every page that
 * shows "your" anything reads it. Switching is a PUT with a name that is already on
 * the list — a person cannot be conjured into the wheel by naming them, since a
 * player has to have a driver profile for the app to know a thing about them.
 */

/** The list as the browser wants it: portraits resolved, primary flagged. */
async function withPortraits(config: PlayersConfig) {
  const portraits = await resolveDriverPortraits(config.players.map(player => player.name));
  const primary = primaryPlayer(config).name;

  return {
    active: config.active,
    players: config.players.map(player => ({
      ...player,
      portrait: portraits.get(player.name) ?? null,
      primary: player.name === primary,
    })),
  };
}

export async function GET() {
  return NextResponse.json(await withPortraits(await readPlayers()));
}

export async function PUT(request: NextRequest) {
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const config = await setActivePlayer(name);
  if (!config) {
    return NextResponse.json({ error: `"${name}" is not one of the players` }, { status: 404 });
  }

  return NextResponse.json(await withPortraits(config));
}

export async function POST(request: NextRequest) {
  let body: { name?: unknown; nation?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const nation = typeof body.nation === 'string' ? body.nation.trim().toUpperCase() : '';

  return NextResponse.json(await withPortraits(await addPlayer({ name, nation: nation || 'ARG' })));
}

export async function DELETE(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')?.trim() ?? '';
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const config = await removePlayer(name);
  if (!config) {
    // The primary is what every result filed before players existed is read as
    // belonging to, so taking them off would re-attribute the whole archive.
    return NextResponse.json(
      { error: `"${name}" cannot be removed — an unknown player, or the primary one` },
      { status: 400 }
    );
  }

  return NextResponse.json(await withPortraits(config));
}
