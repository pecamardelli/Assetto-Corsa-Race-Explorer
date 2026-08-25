import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { AI_SKILL_MAX, driverSlug, resolvePlayerName } from '../../../lib/driver-assets';

const PROFILE_DIR = 'app/lib/driver-profiles';

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

// Skill may run past AC's 100 (see AI_SKILL_MAX); aggression is AC's own 0-100.
const isValidSkill = (value: unknown) => isIntegerIn(value, 0, AI_SKILL_MAX);
const isValidAggression = (value: unknown) => isIntegerIn(value, 0, 100);

async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    // A BOM would make JSON.parse throw and silently drop the file's fields
    // from the merge, so strip it.
    return JSON.parse((await fs.readFile(filePath, 'utf8')).replace(/^﻿/, ''));
  } catch {
    return null;
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ driverName: string }> }
) {
  try {
    const { driverName } = await params;
    const decodedDriverName = decodeURIComponent(driverName);
    const body = await request.json();

    // Validate required fields
    if (!body.nationality || !body.dateOfBirth || !body.placeOfBirth || !body.features || !body.gender) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // The AI rating: undefined leaves the stored one alone, null clears it back
    // to the unrated fallback, an object replaces it. Validated before anything
    // is written.
    let aiRating: { skill: number; aggression: number } | null | undefined;
    if (body.aiRating !== undefined) {
      if (body.aiRating === null) {
        aiRating = null;
      } else {
        const { skill, aggression } = body.aiRating as { skill?: unknown; aggression?: unknown };
        if (!isValidSkill(skill) || !isValidAggression(aggression)) {
          return NextResponse.json(
            {
              error: `Invalid AI rating: skill must be an integer 0-${AI_SKILL_MAX}, aggression 0-100`,
            },
            { status: 400 }
          );
        }
        aiRating = { skill, aggression };
      }
    }

    const slug = driverSlug(decodedDriverName);
    const profilePath = path.join(process.cwd(), PROFILE_DIR, `${slug}.json`);

    // Merge over what the file already holds so fields the form does not carry
    // (ageAsOf, ...) survive a save.
    const updatedProfile: Record<string, unknown> = {
      ...((await readJson(profilePath)) ?? {}),
      name: decodedDriverName, // Name cannot be changed
      nationality: body.nationality,
      dateOfBirth: body.dateOfBirth,
      placeOfBirth: body.placeOfBirth,
      features: body.features,
      gender: body.gender,
      isFictional: body.isFictional ?? true,
      bio: body.bio || '',
    };

    // The player has no AI rating: their seat is driven by the user, so any
    // rating sent for them is ignored.
    if (aiRating !== undefined && decodedDriverName !== (await resolvePlayerName())) {
      if (aiRating === null) {
        delete updatedProfile.skill;
        delete updatedProfile.aggression;
      } else {
        updatedProfile.skill = aiRating.skill;
        updatedProfile.aggression = aiRating.aggression;
      }
    }

    await fs.writeFile(profilePath, JSON.stringify(updatedProfile, null, 2), 'utf8');

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error('Error updating driver profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
