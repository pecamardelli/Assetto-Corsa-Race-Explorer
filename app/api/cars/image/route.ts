import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  carBadgeFile,
  carPreviewFile,
  isSafeSegment,
  readInstalledCar,
} from '../../../lib/launch/car-catalog';

/**
 * Livery previews and brand badges, served straight out of the Assetto Corsa install.
 *
 * `public/car-gallery` and `public/badges` only hold cars some championship has already
 * raced — a picker offering all 350 installed cars has nothing there for most of them,
 * so the pictures come from the install itself.
 *
 * They come from it *shrunk*, though. A stock preview is a 1022x575 JPEG averaging
 * 120 KB, and a grid of them is 40 MB of pictures to show at 320 px wide. So each one is
 * re-encoded once to a WebP of the width it is actually displayed at and kept in the
 * build cache, which takes the same grid to about a twentieth of that. If the encoder is
 * unavailable for any reason the original file is served instead — a slow picker beats a
 * broken one.
 */

type Kind = 'preview' | 'badge';

/**
 * Twice the widest each is drawn at, so they stay sharp on a high-density screen. A
 * livery strip shows thirty previews at a time at a fraction of a card's width, which is
 * worth its own size rather than thirty full-width pictures.
 */
const WIDTHS: Record<string, number> = { preview: 640, thumb: 256, badge: 192 };

/**
 * Beside Next's own build cache: derived from files on another disk, cheap to rebuild,
 * and nothing anyone would want in the repo.
 */
const CACHE_DIR = path.join(process.cwd(), '.next', 'cache', 'race-explorer', 'car-images');

/** A day. The install changes when a mod is installed and not otherwise. */
const MAX_AGE_SECONDS = 86400;

async function cached(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(CACHE_DIR, key));
  } catch {
    return null;
  }
}

async function store(key: string, body: Buffer): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(CACHE_DIR, key), body);
  } catch (error) {
    // A cache that cannot be written is a slower picker, not a broken one.
    console.error('Could not cache a car image:', error);
  }
}

/** Shrink to `width` as WebP, or null when the encoder is not usable here. */
async function shrink(file: string, width: number): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(file)
      .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: 72 })
      .toBuffer();
  } catch (error) {
    console.error(`Could not shrink ${file}:`, error);
    return null;
  }
}

function image(body: Buffer, type: string): NextResponse {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': type,
      'Cache-Control': `public, max-age=${MAX_AGE_SECONDS}`,
    },
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const car = params.get('car') ?? '';
  const kind: Kind = params.get('kind') === 'badge' ? 'badge' : 'preview';
  const size = kind === 'preview' && params.get('size') === 'thumb' ? 'thumb' : kind;

  if (!isSafeSegment(car)) {
    return NextResponse.json({ error: 'That is not a car folder name' }, { status: 400 });
  }

  let file: string;
  let skin = '';

  if (kind === 'badge') {
    file = carBadgeFile(car);
  } else {
    // No livery named: the car's own first one, which is the livery a pick defaults to.
    skin = params.get('skin') ?? '';
    if (!skin) skin = (await readInstalledCar(car))?.defaultSkin ?? '';
    if (!skin || !isSafeSegment(skin)) {
      return NextResponse.json({ error: 'That is not a livery folder name' }, { status: 400 });
    }
    file = carPreviewFile(car, skin);
  }

  // One cache file per car and livery. Hashed rather than named after them: a folder
  // name may carry spaces, brackets and hashes, and this has to be a filename.
  const key = `${size}-${createHash('sha1').update(`${car}/${skin}`).digest('hex')}.webp`;

  const hit = await cached(key);
  if (hit) return image(hit, 'image/webp');

  let original: Buffer;
  try {
    original = await fs.readFile(file);
  } catch {
    return NextResponse.json({ error: 'No such picture in the install' }, { status: 404 });
  }

  const shrunk = await shrink(file, WIDTHS[size]);
  if (!shrunk) return image(original, kind === 'badge' ? 'image/png' : 'image/jpeg');

  await store(key, shrunk);
  return image(shrunk, 'image/webp');
}
