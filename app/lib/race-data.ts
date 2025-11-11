import { promises as fs } from 'fs';
import path from 'path';
import { RaceData, RaceSession, Championship, ChampionshipData } from '../types/race';

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
      const data: RaceData = JSON.parse(fileContents);

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
    const data: RaceData = JSON.parse(fileContents);

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
    const files = await fs.readdir(championshipDirectory);
    const champFiles = files.filter(file => file.endsWith('.champ'));

    for (const champFile of champFiles) {
      const champFilePath = path.join(championshipDirectory, champFile);
      const fileContents = await fs.readFile(champFilePath, 'utf8');

      // Remove BOM if present
      const cleanedContents = fileContents.replace(/^\uFEFF/, '');
      const champData: ChampionshipData = JSON.parse(cleanedContents);

      // Read the championship folder to get race sessions
      // The folder name is the UUID (same as the .champ filename without extension)
      const champId = champFile.replace('.champ', '');
      const folderName = champId; // Use UUID as folder name
      const folderPath = path.join(championshipDirectory, folderName);

      let sessions: RaceSession[] = [];
      try {
        const sessionFiles = await fs.readdir(folderPath);
        const jsonFiles = sessionFiles.filter(file => file.endsWith('.json'));

        for (const sessionFile of jsonFiles) {
          const sessionPath = path.join(folderPath, sessionFile);
          const sessionContents = await fs.readFile(sessionPath, 'utf8');
          const sessionData: RaceData = JSON.parse(sessionContents);

          sessions.push({
            filename: `championship/${folderName}/${sessionFile}`,
            data: sessionData,
            raceType: 'championship',
            championship: champData.name,
          });
        }

        // Sort sessions by date
        sessions.sort((a, b) => {
          const dateA = new Date(a.data.session_info.date);
          const dateB = new Date(b.data.session_info.date);
          return dateA.getTime() - dateB.getTime();
        });
      } catch (error) {
        console.error(`Error reading championship folder ${folderName}:`, error);
      }

      championships.push({
        id: champId,
        data: champData,
        folderName,
        sessions,
      });
    }

    return championships;
  } catch (error) {
    console.error('Error reading championships:', error);
    return [];
  }
}

export async function getChampionship(champId: string): Promise<Championship | null> {
  const championshipDirectory = path.join(process.cwd(), 'app', 'data', 'championship');
  const champFilePath = path.join(championshipDirectory, `${champId}.champ`);

  try {
    const fileContents = await fs.readFile(champFilePath, 'utf8');
    const cleanedContents = fileContents.replace(/^\uFEFF/, '');
    const champData: ChampionshipData = JSON.parse(cleanedContents);

    // The folder name is the UUID (same as champId)
    const folderName = champId;
    const folderPath = path.join(championshipDirectory, folderName);

    let sessions: RaceSession[] = [];
    try {
      const sessionFiles = await fs.readdir(folderPath);
      const jsonFiles = sessionFiles.filter(file => file.endsWith('.json'));

      for (const sessionFile of jsonFiles) {
        const sessionPath = path.join(folderPath, sessionFile);
        const sessionContents = await fs.readFile(sessionPath, 'utf8');
        const sessionData: RaceData = JSON.parse(sessionContents);

        sessions.push({
          filename: `championship/${folderName}/${sessionFile}`,
          data: sessionData,
          raceType: 'championship',
          championship: champData.name,
        });
      }

      // Sort sessions by date
      sessions.sort((a, b) => {
        const dateA = new Date(a.data.session_info.date);
        const dateB = new Date(b.data.session_info.date);
        return dateA.getTime() - dateB.getTime();
      });
    } catch (error) {
      console.error(`Error reading championship folder ${folderName}:`, error);
    }

    return {
      id: champId,
      data: champData,
      folderName,
      sessions,
    };
  } catch (error) {
    console.error('Error reading championship:', error);
    return null;
  }
}
