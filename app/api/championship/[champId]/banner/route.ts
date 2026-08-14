import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Banners sit next to the championship's data rather than in public/, so they
// have to be served by hand.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ champId: string }> }
) {
  const { champId } = await params;
  const folderName = decodeURIComponent(champId);

  // A championship id is a single folder name; anything else could walk out of
  // the data directory.
  if (folderName.includes('/') || folderName.includes('\\') || folderName.includes('..')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const bannerPath = path.join(
    process.cwd(),
    'app',
    'data',
    'championship',
    folderName,
    'banner.webp'
  );

  try {
    const banner = await fs.readFile(bannerPath);
    return new NextResponse(new Uint8Array(banner), {
      headers: {
        'Content-Type': 'image/webp',
        // Short-lived: the file is replaced whenever a new banner is downloaded.
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
