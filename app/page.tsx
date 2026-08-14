import { promises as fs } from 'fs';
import path from 'path';
import { getRaceSessions, getChampionships } from './lib/race-data';
import { getTrackDetails } from './lib/track-data';
import { resolveDriverPortrait } from './lib/driver-assets';
import { calculateStandings, calculateConstructorStandings } from './lib/standings';
import { Championship } from './types/race';
import RaceExplorer from './components/RaceExplorer';

// The brand badge a car races under, or null when we don't have that badge.
async function resolveCarBadge(carName: string): Promise<string | null> {
  try {
    await fs.access(path.join(process.cwd(), 'public', 'badges', `${carName}.png`));
    return `/badges/${encodeURIComponent(carName)}.png`;
  } catch {
    return null;
  }
}

export default async function Home() {
  const quickRaces = await getRaceSessions();
  const championships = await getChampionships();

  // Enrich quick races with track details
  const enrichedQuickRaces = quickRaces.map(session => ({
    ...session,
    trackDetails: getTrackDetails(
      session.data.session_info.track,
      session.data.session_info.track_config
    )
  }));

  // Calculate championship stats
  const championshipStats = new Map();

  for (const championship of championships) {
    // Find the latest completed season (all races finished)
    let currentChampion = '-';
    let currentConstructorChampion = '-';
    let currentChampionPortrait: string | null = null;
    let currentConstructorBadge: string | null = null;

    const latestCompletedSeason = [...championship.seasons]
      .reverse()
      .find(season => {
        if (season.sessions.length === 0) return false;

        // Count completed race sessions
        const completedRaces = season.sessions.filter(session => {
          const sessionType = session.data.session_type || session.data.session_info.session_type;
      return sessionType === 'race';
        }).length;

        // Season is completed if all rounds have been raced
        return completedRaces === season.data.rounds.length;
      });

    if (latestCompletedSeason) {
      const seasonChampionship: Championship = {
        id: championship.id,
        data: latestCompletedSeason.data,
        folderName: championship.folderName,
        sessions: latestCompletedSeason.sessions,
        seasons: [latestCompletedSeason],
      };

      // Calculate champion
      const standings = calculateStandings(seasonChampionship);
      if (standings.length > 0) {
        currentChampion = standings[0].name;
        currentChampionPortrait = await resolveDriverPortrait(currentChampion, championship.id);
      }

      // Calculate constructor champion
      const constructorStandings = calculateConstructorStandings(seasonChampionship);
      if (constructorStandings.length > 0) {
        currentConstructorChampion = constructorStandings[0].brand;
        currentConstructorBadge = await resolveCarBadge(constructorStandings[0].carName);
      }
    }

    championshipStats.set(championship.id, {
      currentChampion,
      currentChampionPortrait,
      currentConstructorChampion,
      currentConstructorBadge,
    });
  }

  return <RaceExplorer quickRaces={enrichedQuickRaces} championships={championships} championshipStats={championshipStats} />;
}
