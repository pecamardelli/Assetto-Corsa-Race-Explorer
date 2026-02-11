import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

type DriverProfile = {
  name: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  features: string;
  gender: string;
  isFictional?: boolean;
  bio?: string;
};

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

    // Create the updated profile
    const updatedProfile: DriverProfile = {
      name: decodedDriverName, // Name cannot be changed
      nationality: body.nationality,
      dateOfBirth: body.dateOfBirth,
      placeOfBirth: body.placeOfBirth,
      features: body.features,
      gender: body.gender,
      isFictional: body.isFictional ?? true,
      bio: body.bio || '',
    };

    // Write to file
    const profilePath = path.join(
      process.cwd(),
      'app/lib/driver-profiles',
      `${decodedDriverName.replace(/ /g, '_').toLowerCase()}.json`
    );

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
