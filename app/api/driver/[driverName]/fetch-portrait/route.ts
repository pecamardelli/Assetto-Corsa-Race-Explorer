import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ driverName: string }> }
) {
  try {
    const { driverName } = await params;
    const decodedDriverName = decodeURIComponent(driverName);

    // Search for driver image on the web
    const searchQuery = encodeURIComponent(`${decodedDriverName} racing driver portrait`);

    // Use a web search to find the driver's image
    // For now, we'll use a placeholder approach - in production, you'd want to integrate with
    // an image search API like Google Custom Search, Bing Image Search, or SerpAPI

    // Try Wikipedia first (many racing drivers have Wikipedia pages with portraits)
    const wikiResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(decodedDriverName)}&prop=pageimages&format=json&pithumbsize=400&origin=*`
    );

    if (!wikiResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to search for portrait' },
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
    const imageUrl = page?.thumbnail?.source;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No portrait image found on Wikipedia. Try generating an AI portrait instead.' },
        { status: 404 }
      );
    }

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download portrait image' },
        { status: 500 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    // Save the image
    const outputDir = path.join(process.cwd(), 'public', 'driver-portraits');

    // Ensure directory exists
    try {
      await fs.access(outputDir);
    } catch {
      await fs.mkdir(outputDir, { recursive: true });
    }

    const outputPath = path.join(
      outputDir,
      `${decodedDriverName.replace(/ /g, '_').toLowerCase()}.png`
    );

    await fs.writeFile(outputPath, buffer);

    return NextResponse.json({
      success: true,
      message: 'Portrait fetched successfully from Wikipedia',
      imagePath: `/driver-portraits/${decodedDriverName.replace(/ /g, '_').toLowerCase()}.png`,
      source: 'Wikipedia'
    });
  } catch (error) {
    console.error('Error fetching portrait:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch portrait' },
      { status: 500 }
    );
  }
}
