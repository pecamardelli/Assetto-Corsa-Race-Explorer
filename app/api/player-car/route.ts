import { NextRequest, NextResponse } from 'next/server';
import {
  clearSeasonPlayerCar,
  readSeasonPlayerCar,
  writeSeasonPlayerCar,
} from '../../lib/launch/assists';
import { readCarSkins, readInstalledCar } from '../../lib/launch/car-catalog';
import { importCarAssets } from '../../lib/launch/car-import';
import { validateSeasonScope } from '../../lib/launch/season-scope';
import { sanitizePlayerCar } from '../../types/player-car';

/**
 * The car a season puts the player in, over the one its .champ entered them in.
 * Season-scoped only (`champ` + `season`), like the lineup: there is nothing global for
 * a car to fall back to. DELETE drops the pick and the season follows its .champ again.
 */

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const scope = await validateSeasonScope(params.get('champ'), params.get('season'));
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  return NextResponse.json({ car: await readSeasonPlayerCar(scope.champ, scope.season) });
}

export async function PUT(request: NextRequest) {
  let body: { champ?: string; season?: string; car?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const scope = await validateSeasonScope(body.champ, body.season);
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  const pick = sanitizePlayerCar(body.car);
  if (!pick) {
    return NextResponse.json({ error: 'car is required' }, { status: 400 });
  }

  // A pick has to name a car that is actually on the disk. Writing one that is not would
  // save cleanly and then fail at the launch, with race.ini naming a car AC cannot load.
  const installed = await readInstalledCar(pick.car);
  if (!installed) {
    return NextResponse.json(
      { error: `No car "${pick.car}" is installed` },
      { status: 400 }
    );
  }

  // Same for the livery — and a car whose liveries cannot be read at all is left with
  // whatever was asked for, since AC falls back to the first one it finds.
  const skins = await readCarSkins(pick.car);
  if (pick.skin && skins.length > 0 && !skins.some(skin => skin.id === pick.skin)) {
    return NextResponse.json(
      { error: `"${installed.name}" has no livery "${pick.skin}"` },
      { status: 400 }
    );
  }

  const car = { car: pick.car, skin: pick.skin || installed.defaultSkin };
  await writeSeasonPlayerCar(scope.champ, scope.season, car);

  // Every page that renders a car reads the repo's own copy of its data, so a car being
  // driven for the first time brings that copy across with it.
  const imported = await importCarAssets(car.car);

  return NextResponse.json({ car, imported });
}

export async function DELETE(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const scope = await validateSeasonScope(params.get('champ'), params.get('season'));
  if (!scope) {
    return NextResponse.json({ error: 'Unknown championship season' }, { status: 404 });
  }

  await clearSeasonPlayerCar(scope.champ, scope.season);
  return NextResponse.json({ car: null });
}
