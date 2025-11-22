import { promises as fs } from 'fs';
import path from 'path';
import { RaceData, RaceSession, Championship, ChampionshipData } from '../types/race';

// Helper function to extract session type from filename
// Filename format: stats_{track}_session_{type}_{timestamp}.json
function extractSessionTypeFromFilename(filename: string): string | null {
  const match = filename.match(/stats_.*_session_([^_]+)_\d+\.json$/);
  return match ? match[1] : null;
}

// Helper function to ensure session has correct session_type
function ensureSessionType(data: RaceData, filename: string): RaceData {
  // If session_type is missing or empty, try to extract from filename
  if (!data.session_info.session_type) {
    const extractedType = extractSessionTypeFromFilename(filename);
    if (extractedType) {
      return {
        ...data,
        session_info: {
          ...data.session_info,
          session_type: extractedType as 'practice' | 'qualifying' | 'race'
        }
      };
    }
  }
  return data;
}

export async function getRaceSessions(): Promise<RaceSession[]> {
  const quickRaceDirectory = path.join(process.cwd(), 'app', 'data', 'quick_race');

  try {
    const sessions: RaceSession[] = [];

    // Read quick race JSON files
    const files = await fs.readdir(quickRaceDirectory);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    for (const filename of jsonFiles) {
      const filePath = path.join(quickRaceDirectory, filename);
      const fileContents = await fs.readFile(filePath, 'utf8');
      let data: RaceData = JSON.parse(fileContents);

      // Ensure session_type is populated from filename if empty
      data = ensureSessionType(data, filename);

      sessions.push({
        filename: `quick_race/${filename}`,
        data,
        raceType: 'quick_race',
      });
    }

    // Sort by date, newest first
    return sessions.sort((a, b) => {
      const dateA = new Date(a.data.session_info.date);
      const dateB = new Date(b.data.session_info.date);
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error) {
    console.error('Error reading race data:', error);
    return [];
  }
}

export async function getRaceSession(filename: string): Promise<RaceSession | null> {
  const dataDirectory = path.join(process.cwd(), 'app', 'data');

  // Split the filename by forward slash and join with proper path separator
  const parts = filename.split('/');
  const filePath = path.join(dataDirectory, ...parts);

  try {
    const fileContents = await fs.readFile(filePath, 'utf8');
    let data: RaceData = JSON.parse(fileContents);

    // Ensure session_type is populated from filename if empty
    const actualFilename = parts[parts.length - 1];
    data = ensureSessionType(data, actualFilename);

    // Extract race type and championship from filename
    const raceType = parts[0];
    const championship = parts.length > 2 ? parts[1] : undefined;

    return {
      filename,
      data,
      raceType,
      championship,
    };
  } catch (error) {
    console.error('Error reading race session:', error);
    return null;
  }
}

// Re-export client-safe utilities
export { formatTrackName, formatLapTime, formatCarName, getSortedDrivers, safeNumber, safeString } from './format-utils';

export async function getChampionships(): Promise<Championship[]> {
  const championshipDirectory = path.join(process.cwd(), 'app', 'data', 'championship');

  try {
    const championships: Championship[] = [];
    const entries = await fs.readdir(championshipDirectory, { withFileTypes: true });
    const champFolders = entries.filter(entry => entry.isDirectory());

    for (const champFolder of champFolders) {
      const champName = champFolder.name;
      const champPath = path.join(championshipDirectory, champName);

      try {
        // Look for season folders and .champ files
        const seasonEntries = await fs.readdir(champPath, { withFileTypes: true });
        const seasonDirs = seasonEntries.filter(entry => entry.isDirectory() && entry.name.startsWith('Season '));

        // For now, we'll read all seasons and combine them
        // Later we can add per-season support
        let allSessions: RaceSession[] = [];
        let champData: ChampionshipData | null = null;

        for (const seasonDir of seasonDirs) {
          const seasonName = seasonDir.name;
          const seasonPath = path.join(champPath, seasonName);

          // Look for corresponding .champ file (e.g., season_01.champ for Season 01)
          const champFileName = seasonName.toLowerCase().replace(' ', '_') + '.champ';
          const champFilePath = path.join(champPath, champFileName);

          let seasonChampData: ChampionshipData;
          try {
            const fileContents = await fs.readFile(champFilePath, 'utf8');
            const cleanedContents = fileContents.replace(/^\uFEFF/, '');
            seasonChampData = JSON.parse(cleanedContents);
            champData = seasonChampData; // Keep reference to latest season data
          } catch (error) {
            console.error(`Error reading .champ file ${champFileName}:`, error);
            continue;
          }

          // Read race session files
          const sessionFiles = await fs.readdir(seasonPath);
          const jsonFiles = sessionFiles.filter(file => file.endsWith('.json'));

          for (const sessionFile of jsonFiles) {
            const sessionPath = path.join(seasonPath, sessionFile);
            const sessionContents = await fs.readFile(sessionPath, 'utf8');
            let sessionData: RaceData = JSON.parse(sessionContents);

            // Ensure session_type is populated from filename if empty
            sessionData = ensureSessionType(sessionData, sessionFile);

            allSessions.push({
              filename: `championship/${champName}/${seasonName}/${sessionFile}`,
              data: sessionData,
              raceType: 'championship',
              championship: seasonChampData.name,
            });
          }
        }

        if (champData) {
          // Sort sessions by date
          allSessions.sort((a, b) => {
            const dateA = new Date(a.data.session_info.date);
            const dateB = new Date(b.data.session_info.date);
            return dateA.getTime() - dateB.getTime();
          });

          championships.push({
            id: champName,
            data: champData,
            folderName: champName,
            sessions: allSessions,
          });
        }
      } catch (error) {
        console.error(`Error reading championship folder ${champName}:`, error);
      }
    }

    return championships;
  } catch (error) {
    console.error('Error reading championships:', error);
    return [];
  }
}

export async function getChampionship(champId: string): Promise<Championship | null> {
  const championshipDirectory = path.join(process.cwd(), 'app', 'data', 'championship');
  const champPath = path.join(championshipDirectory, champId);

  try {
    // Look for season folders and .champ files
    const seasonEntries = await fs.readdir(champPath, { withFileTypes: true });
    const seasonDirs = seasonEntries.filter(entry => entry.isDirectory() && entry.name.startsWith('Season '));

    let allSessions: RaceSession[] = [];
    let champData: ChampionshipData | null = null;

    for (const seasonDir of seasonDirs) {
      const seasonName = seasonDir.name;
      const seasonPath = path.join(champPath, seasonName);

      // Look for corresponding .champ file (e.g., season_01.champ for Season 01)
      const champFileName = seasonName.toLowerCase().replace(' ', '_') + '.champ';
      const champFilePath = path.join(champPath, champFileName);

      let seasonChampData: ChampionshipData;
      try {
        const fileContents = await fs.readFile(champFilePath, 'utf8');
        const cleanedContents = fileContents.replace(/^\uFEFF/, '');
        seasonChampData = JSON.parse(cleanedContents);
        champData = seasonChampData; // Keep reference to latest season data
      } catch (error) {
        console.error(`Error reading .champ file ${champFileName}:`, error);
        continue;
      }

      // Read race session files
      const sessionFiles = await fs.readdir(seasonPath);
      const jsonFiles = sessionFiles.filter(file => file.endsWith('.json'));

      for (const sessionFile of jsonFiles) {
        const sessionFilePath = path.join(seasonPath, sessionFile);
        const sessionContents = await fs.readFile(sessionFilePath, 'utf8');
        let sessionData: RaceData = JSON.parse(sessionContents);

        // Ensure session_type is populated from filename if empty
        sessionData = ensureSessionType(sessionData, sessionFile);

        allSessions.push({
          filename: `championship/${champId}/${seasonName}/${sessionFile}`,
          data: sessionData,
          raceType: 'championship',
          championship: seasonChampData.name,
        });
      }
    }

    if (!champData) {
      return null;
    }

    // Sort sessions by date
    allSessions.sort((a, b) => {
      const dateA = new Date(a.data.session_info.date);
      const dateB = new Date(b.data.session_info.date);
      return dateA.getTime() - dateB.getTime();
    });

    return {
      id: champId,
      data: champData,
      folderName: champId,
      sessions: allSessions,
    };
  } catch (error) {
    console.error('Error reading championship:', error);
    return null;
  }
}
