import { promises as fs } from 'fs';
import path from 'path';
import { RaceData, RaceSession, Championship, ChampionshipData, Season } from '../types/race';

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
        // Read all entries in championship folder
        const seasonEntries = await fs.readdir(champPath, { withFileTypes: true });

        // Find all .champ files
        const champFiles = seasonEntries.filter(entry => entry.isFile() && entry.name.endsWith('.champ'));

        let allSessions: RaceSession[] = [];
        let champData: ChampionshipData | null = null;
        const seasons: Season[] = [];

        for (const champFile of champFiles) {
          const champFileName = champFile.name;
          const champFilePath = path.join(champPath, champFileName);

          // Get the season folder name (same as .champ file without extension)
          // e.g., season_01.champ -> season_01
          const seasonFolderName = champFileName.replace('.champ', '');
          const seasonPath = path.join(champPath, seasonFolderName);

          // Extract season number from name (e.g., "season_01" -> 1)
          const seasonNumberMatch = seasonFolderName.match(/season_(\d+)/i);
          const seasonNumber = seasonNumberMatch ? parseInt(seasonNumberMatch[1], 10) : 0;

          // Create display name (e.g., "season_01" -> "Season 01")
          const seasonDisplayName = `Season ${String(seasonNumber).padStart(2, '0')}`;

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

          // Read race session files for this season
          const seasonSessions: RaceSession[] = [];

          try {
            const sessionFiles = await fs.readdir(seasonPath);
            const jsonFiles = sessionFiles.filter(file => file.endsWith('.json'));

            for (const sessionFile of jsonFiles) {
              const sessionFilePath = path.join(seasonPath, sessionFile);
              const sessionContents = await fs.readFile(sessionFilePath, 'utf8');
              let sessionData: RaceData = JSON.parse(sessionContents);

              // Ensure session_type is populated from filename if empty
              sessionData = ensureSessionType(sessionData, sessionFile);

              const session = {
                filename: `championship/${champName}/${seasonFolderName}/${sessionFile}`,
                data: sessionData,
                raceType: 'championship' as const,
                championship: seasonChampData.name,
              };

              seasonSessions.push(session);
              allSessions.push(session);
            }
          } catch (error) {
            console.error(`Error reading season folder ${seasonFolderName}:`, error);
          }

          // Sort season sessions by date
          seasonSessions.sort((a, b) => {
            const dateA = new Date(a.data.session_info.date);
            const dateB = new Date(b.data.session_info.date);
            return dateA.getTime() - dateB.getTime();
          });

          seasons.push({
            seasonName: seasonDisplayName,
            seasonNumber,
            data: seasonChampData,
            sessions: seasonSessions,
          });
        }

        if (champData) {
          // Sort all sessions by date
          allSessions.sort((a, b) => {
            const dateA = new Date(a.data.session_info.date);
            const dateB = new Date(b.data.session_info.date);
            return dateA.getTime() - dateB.getTime();
          });

          // Sort seasons by season number
          seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

          championships.push({
            id: champName,
            data: champData,
            folderName: champName,
            sessions: allSessions,
            seasons,
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
    // Read all entries in championship folder
    const seasonEntries = await fs.readdir(champPath, { withFileTypes: true });

    // Find all .champ files
    const champFiles = seasonEntries.filter(entry => entry.isFile() && entry.name.endsWith('.champ'));

    let allSessions: RaceSession[] = [];
    let champData: ChampionshipData | null = null;
    const seasons: Season[] = [];

    for (const champFile of champFiles) {
      const champFileName = champFile.name;
      const champFilePath = path.join(champPath, champFileName);

      // Get the season folder name (same as .champ file without extension)
      // e.g., season_01.champ -> season_01
      const seasonFolderName = champFileName.replace('.champ', '');
      const seasonPath = path.join(champPath, seasonFolderName);

      // Extract season number from name (e.g., "season_01" -> 1)
      const seasonNumberMatch = seasonFolderName.match(/season_(\d+)/i);
      const seasonNumber = seasonNumberMatch ? parseInt(seasonNumberMatch[1], 10) : 0;

      // Create display name (e.g., "season_01" -> "Season 01")
      const seasonDisplayName = `Season ${String(seasonNumber).padStart(2, '0')}`;

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

      // Read race session files for this season
      const seasonSessions: RaceSession[] = [];

      try {
        const sessionFiles = await fs.readdir(seasonPath);
        const jsonFiles = sessionFiles.filter(file => file.endsWith('.json'));

        for (const sessionFile of jsonFiles) {
          const sessionFilePath = path.join(seasonPath, sessionFile);
          const sessionContents = await fs.readFile(sessionFilePath, 'utf8');
          let sessionData: RaceData = JSON.parse(sessionContents);

          // Ensure session_type is populated from filename if empty
          sessionData = ensureSessionType(sessionData, sessionFile);

          const session = {
            filename: `championship/${champId}/${seasonFolderName}/${sessionFile}`,
            data: sessionData,
            raceType: 'championship' as const,
            championship: seasonChampData.name,
          };

          seasonSessions.push(session);
          allSessions.push(session);
        }
      } catch (error) {
        console.error(`Error reading season folder ${seasonFolderName}:`, error);
      }

      // Sort season sessions by date
      seasonSessions.sort((a, b) => {
        const dateA = new Date(a.data.session_info.date);
        const dateB = new Date(b.data.session_info.date);
        return dateA.getTime() - dateB.getTime();
      });

      seasons.push({
        seasonName: seasonDisplayName,
        seasonNumber,
        data: seasonChampData,
        sessions: seasonSessions,
      });
    }

    if (!champData) {
      return null;
    }

    // Sort all sessions by date
    allSessions.sort((a, b) => {
      const dateA = new Date(a.data.session_info.date);
      const dateB = new Date(b.data.session_info.date);
      return dateA.getTime() - dateB.getTime();
    });

    // Sort seasons by season number
    seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

    return {
      id: champId,
      data: champData,
      folderName: champId,
      sessions: allSessions,
      seasons,
    };
  } catch (error) {
    console.error('Error reading championship:', error);
    return null;
  }
}
