import { NextResponse } from 'next/server';
import { duplicateLastSeason } from '../../../../lib/new-season';

/**
 * Start a championship's next season as a copy of its last one.
 *
 * POST only, and it takes no body: there is exactly one thing this can do to a
 * championship, and which season it copies is not a choice — it is the last one.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ champId: string }> }
) {
  const { champId } = await params;
  const result = await duplicateLastSeason(decodeURIComponent(champId));

  if ('error' in result) {
    switch (result.error) {
      case 'unknown-championship':
        return NextResponse.json({ error: 'Unknown championship' }, { status: 404 });
      case 'no-seasons':
        return NextResponse.json(
          { error: 'This championship has no season to copy' },
          { status: 409 }
        );
      case 'already-exists':
        return NextResponse.json(
          { error: `${result.season} already exists` },
          { status: 409 }
        );
    }
  }

  return NextResponse.json(result, { status: 201 });
}
