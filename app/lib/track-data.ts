import fs from 'fs';
import path from 'path';

export interface TrackData {
  name?: string;
  description?: string;
  country?: string;
  city?: string;
  length?: string;
  width?: string;
  pitboxes?: string;
  run?: string;
  tags?: string[];
  [key: string]: any;
}

const tracksDataDir = path.join(process.cwd(), 'app', 'data', 'tracks');

// Cache for track data to avoid repeated file reads
const trackDataCache = new Map<string, TrackData | null>();

/**
 * Get track identifier from track name and config
 * @param trackName - The track folder name
 * @param trackConfig - The track configuration (optional)
 * @returns Track identifier string
 */
export function getTrackIdentifier(trackName: string, trackConfig?: string): string {
  return trackConfig ? `${trackName}-${trackConfig}` : trackName;
}

/**
 * Load track data from the tracks data folder
 * @param trackName - The track folder name
 * @param trackConfig - The track configuration (optional)
 * @returns Track data object or null if not found
 */
export function getTrackData(trackName: string, trackConfig?: string): TrackData | null {
  const identifier = getTrackIdentifier(trackName, trackConfig);

  // Check cache first
  if (trackDataCache.has(identifier)) {
    return trackDataCache.get(identifier)!;
  }

  try {
    const trackFilePath = path.join(tracksDataDir, `${identifier}.json`);

    if (!fs.existsSync(trackFilePath)) {
      trackDataCache.set(identifier, null);
      return null;
    }

    const trackData = JSON.parse(fs.readFileSync(trackFilePath, 'utf8')) as TrackData;
    trackDataCache.set(identifier, trackData);
    return trackData;
  } catch (error) {
    console.error(`Error loading track data for ${identifier}:`, error);
    trackDataCache.set(identifier, null);
    return null;
  }
}

/**
 * Get the display name for a track
 * @param trackName - The track folder name
 * @param trackConfig - The track configuration (optional)
 * @returns The track's display name or formatted track_name as fallback
 */
export function getTrackName(trackName: string, trackConfig?: string): string {
  const trackData = getTrackData(trackName, trackConfig);
  if (trackData?.name) {
    return trackData.name;
  }
  // Fallback to formatted track_name
  const formatted = trackName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  if (trackConfig) {
    return `${formatted} (${trackConfig.toUpperCase()})`;
  }
  return formatted;
}

const previewsDir = path.join(process.cwd(), 'public', 'track-previews');

// Only a fraction of the tracks have a preview copied over, and pages that use one
// as a banner need to know before they lay the header out.
const previewCache = new Map<string, string | null>();

/**
 * Where a track's preview image can be loaded from, or null when none was copied.
 * @param trackName - The track folder name
 * @param trackConfig - The track configuration (optional)
 */
export function getTrackPreviewUrl(trackName: string, trackConfig?: string): string | null {
  const identifier = getTrackIdentifier(trackName, trackConfig);

  if (previewCache.has(identifier)) {
    return previewCache.get(identifier)!;
  }

  const url = fs.existsSync(path.join(previewsDir, `${identifier}.png`))
    ? `/track-previews/${identifier}.png`
    : null;
  previewCache.set(identifier, url);
  return url;
}

/**
 * Get track details including location and metadata
 * @param trackName - The track folder name
 * @param trackConfig - The track configuration (optional)
 * @returns Object with track details
 */
export function getTrackDetails(trackName: string, trackConfig?: string): {
  identifier: string;
  name: string;
  country: string;
  city: string;
  length: string;
} {
  const identifier = getTrackIdentifier(trackName, trackConfig);
  const trackData = getTrackData(trackName, trackConfig);

  if (!trackData) {
    const formattedName = getTrackName(trackName, trackConfig);
    return {
      identifier,
      name: formattedName,
      country: '',
      city: '',
      length: ''
    };
  }

  return {
    identifier,
    name: trackData.name || getTrackName(trackName, trackConfig),
    country: trackData.country || '',
    city: trackData.city || '',
    length: trackData.length || ''
  };
}
