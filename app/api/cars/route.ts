import { NextRequest, NextResponse } from 'next/server';
import {
  isSafeSegment,
  readCarDescription,
  readCarSkins,
  readInstalledCar,
  readInstalledCars,
} from '../../lib/launch/car-catalog';

/**
 * The cars this machine has installed.
 *
 * Without `car`, the whole catalogue — every folder under content/cars, as the picker
 * lists them. With `car`, that one car plus the two things the catalogue leaves out
 * because they are only ever wanted for the car being looked at: its liveries and its
 * description.
 *
 * Read-only and about the install rather than about a season, so unlike /api/launch it
 * has nothing to guard: a browser in another room asking what cars exist gets an honest
 * answer and can do nothing with it.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('car');

  if (id === null) {
    return NextResponse.json({ cars: await readInstalledCars() });
  }

  if (!isSafeSegment(id)) {
    return NextResponse.json({ error: 'That is not a car folder name' }, { status: 400 });
  }

  const car = await readInstalledCar(id);
  if (!car) {
    return NextResponse.json({ error: `No car "${id}" is installed` }, { status: 404 });
  }

  const [skins, description] = await Promise.all([readCarSkins(id), readCarDescription(id)]);

  return NextResponse.json({ car, skins, description });
}
