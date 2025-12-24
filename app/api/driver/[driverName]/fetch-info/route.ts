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
};

async function getDriverProfile(driverName: string): Promise<DriverProfile | null> {
  try {
    const profilePath = path.join(process.cwd(), 'app/lib/driver-profiles', `${driverName.replace(/ /g, '_').toLowerCase()}.json`);
    const fileContents = await fs.readFile(profilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ driverName: string }> }
) {
  try {
    const { driverName } = await params;
    const decodedDriverName = decodeURIComponent(driverName);

    // Get current profile
    const currentProfile = await getDriverProfile(decodedDriverName);
    if (!currentProfile) {
      return NextResponse.json(
        { error: 'Driver profile not found' },
        { status: 404 }
      );
    }

    // Check if driver is marked as real
    if (currentProfile.isFictional !== false) {
      return NextResponse.json(
        { error: 'This feature is only available for real drivers. Please mark the driver as "Real Driver" first.' },
        { status: 400 }
      );
    }

    // Fetch from Wikipedia
    const wikiResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(decodedDriverName)}&prop=extracts|pageimages&exintro=true&explaintext=true&format=json&pithumbsize=400&origin=*`
    );

    if (!wikiResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch from Wikipedia' },
        { status: 500 }
      );
    }

    const wikiData = await wikiResponse.json();
    const pages = wikiData.query?.pages;

    if (!pages) {
      return NextResponse.json(
        { error: 'No Wikipedia page found for this driver' },
        { status: 404 }
      );
    }

    const page = Object.values(pages)[0] as any;

    if (page.missing) {
      return NextResponse.json(
        { error: `No Wikipedia page found for "${decodedDriverName}". Make sure the driver name is spelled correctly.` },
        { status: 404 }
      );
    }

    const extract = page.extract || '';
    const imageUrl = page.thumbnail?.source;

    // Parse information from the extract
    let nationality = currentProfile.nationality;
    let dateOfBirth = currentProfile.dateOfBirth;
    let placeOfBirth = currentProfile.placeOfBirth;
    let gender = currentProfile.gender;
    let features = currentProfile.features;

    // Extract birth date (various formats)
    const birthDatePatterns = [
      /born[:\s]+(\d{1,2}\s+\w+\s+\d{4})/i,
      /born[:\s]+(\w+\s+\d{1,2},\s+\d{4})/i,
      /\(born\s+(\d{1,2}\s+\w+\s+\d{4})\)/i,
      /\(born\s+(\w+\s+\d{1,2},\s+\d{4})\)/i,
      /born on\s+(\d{1,2}\s+\w+\s+\d{4})/i,
    ];

    for (const pattern of birthDatePatterns) {
      const match = extract.match(pattern);
      if (match) {
        try {
          const parsedDate = new Date(match[1]);
          if (!isNaN(parsedDate.getTime())) {
            dateOfBirth = parsedDate.toISOString().split('T')[0];
            break;
          }
        } catch (e) {
          // Continue to next pattern
        }
      }
    }

    // Extract place of birth
    const birthPlacePatterns = [
      /born[^,]*,\s*([^,)]+),\s*([^,)]+)/i,
      /born in\s+([^,)]+)/i,
      /\(born[^,]*,\s*([^,)]+),\s*([^,)]+)\)/i,
    ];

    for (const pattern of birthPlacePatterns) {
      const match = extract.match(pattern);
      if (match) {
        if (match.length > 2) {
          placeOfBirth = `${match[1].trim()}, ${match[2].trim()}`;
        } else if (match[1]) {
          placeOfBirth = match[1].trim();
        }
        break;
      }
    }

    // Extract nationality
    const nationalityPatterns = [
      /is an?\s+(\w+)\s+(?:racing driver|driver|racing|motorsport)/i,
      /was an?\s+(\w+)\s+(?:racing driver|driver|racing|motorsport)/i,
      /\(born[^)]*\)\s*is\s*an?\s*(\w+)/i,
    ];

    for (const pattern of nationalityPatterns) {
      const match = extract.match(pattern);
      if (match && match[1]) {
        nationality = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        break;
      }
    }

    // Determine gender from pronouns (basic heuristic)
    if (extract.match(/\bhe\b|\bhis\b|\bhim\b/i)) {
      gender = 'male';
    } else if (extract.match(/\bshe\b|\bher\b/i)) {
      gender = 'female';
    }

    // Download portrait if available
    let portraitPath = null;
    if (imageUrl) {
      try {
        const imageResponse = await fetch(imageUrl);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const buffer = Buffer.from(imageBuffer);

          const outputDir = path.join(process.cwd(), 'public', 'driver-portraits');
          await fs.mkdir(outputDir, { recursive: true });

          const outputPath = path.join(
            outputDir,
            `${decodedDriverName.replace(/ /g, '_').toLowerCase()}.png`
          );

          await fs.writeFile(outputPath, buffer);
          portraitPath = `/driver-portraits/${decodedDriverName.replace(/ /g, '_').toLowerCase()}.png`;
        }
      } catch (err) {
        console.error('Error downloading portrait:', err);
        // Continue even if portrait download fails
      }
    }

    // Update profile
    const updatedProfile: DriverProfile = {
      name: decodedDriverName,
      nationality,
      dateOfBirth,
      placeOfBirth,
      features: features, // Keep existing features as Wikipedia doesn't provide physical descriptions
      gender,
      isFictional: false,
    };

    // Save updated profile
    const profilesDir = path.join(process.cwd(), 'app/lib/driver-profiles');
    await fs.mkdir(profilesDir, { recursive: true });

    const profilePath = path.join(profilesDir, `${decodedDriverName.replace(/ /g, '_').toLowerCase()}.json`);
    await fs.writeFile(profilePath, JSON.stringify(updatedProfile, null, 2), 'utf8');

    return NextResponse.json({
      success: true,
      message: 'Driver information fetched successfully from Wikipedia',
      profile: updatedProfile,
      portraitPath,
      source: 'Wikipedia'
    });
  } catch (error) {
    console.error('Error fetching driver info:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch driver information' },
      { status: 500 }
    );
  }
}
