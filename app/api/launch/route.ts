import { NextRequest, NextResponse } from 'next/server';
import { buildLaunchPlan, LaunchGroup, LaunchPlanError } from '../../lib/launch/plan';
import { currentLaunch, launch, LaunchError } from '../../lib/launch/launcher';
import { LAUNCH_MODES, LaunchMode } from '../../lib/launch/race-ini';

/**
 * Starting a session runs an executable on this machine, so the route only answers
 * requests that came from the same box. Set RACE_EXPLORER_ALLOW_REMOTE_LAUNCH=1 to
 * lift that if you know what you are exposing.
 */
function isLocalRequest(request: NextRequest): boolean {
  if (process.env.RACE_EXPLORER_ALLOW_REMOTE_LAUNCH === '1') return true;

  const host = request.headers.get('host') ?? '';
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');

  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export async function GET() {
  return NextResponse.json({ launch: currentLaunch() });
}

export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: 'Launching is only available locally' }, { status: 403 });
  }

  let body: {
    champId?: string;
    seasonId?: string;
    round?: number;
    mode?: string;
    record?: boolean;
    group?: { label?: unknown; of?: unknown; drivers?: unknown };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const { champId, seasonId, round, mode } = body;

  // A launch files its results away unless it is asked not to — which is how a
  // round that has already been raced gets driven again without disturbing it.
  const record = body.record !== false;

  if (!champId || !seasonId || typeof round !== 'number') {
    return NextResponse.json(
      { error: 'champId, seasonId and round are required' },
      { status: 400 }
    );
  }

  if (!mode || !LAUNCH_MODES.includes(mode as LaunchMode)) {
    return NextResponse.json(
      { error: `mode must be one of ${LAUNCH_MODES.join(', ')}` },
      { status: 400 }
    );
  }

  // A round too big for its track is raced in batches; each launch runs one of them
  // and the standings put them back together.
  let group: LaunchGroup | undefined;
  if (body.group !== undefined) {
    const label = typeof body.group?.label === 'string' ? body.group.label.trim() : '';
    const drivers = Array.isArray(body.group?.drivers)
      ? body.group.drivers.filter((name): name is string => typeof name === 'string')
      : null;

    if (!label || !drivers?.length) {
      return NextResponse.json(
        { error: 'group needs a label and a non-empty drivers array' },
        { status: 400 }
      );
    }

    // How many batches the round was divided into. A round only splits into two or
    // more, so anything else is no answer at all and is left off rather than filed.
    const of = Number(body.group?.of);
    group = { label, drivers, ...(Number.isInteger(of) && of > 1 ? { of } : {}) };
  }

  try {
    const plan = await buildLaunchPlan(
      champId,
      seasonId,
      round,
      mode as LaunchMode,
      record,
      group
    );
    const state = await launch(plan, champId, seasonId);

    return NextResponse.json({ launch: state });
  } catch (error) {
    if (error instanceof LaunchPlanError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof LaunchError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Launch failed:', error);
    return NextResponse.json({ error: 'Failed to launch Assetto Corsa' }, { status: 500 });
  }
}
