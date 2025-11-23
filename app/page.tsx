import { getRaceSessions, getChampionships } from './lib/race-data';
import { getTrackDetails } from './lib/track-data';
import { calculateStandings, calculateConstructorStandings } from './lib/standings';
import { Championship } from './types/race';
import RaceExplorer from './components/RaceExplorer';

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

  championships.forEach(championship => {
    // Find the latest completed season (all races finished)
    let currentChampion = '-';
    let currentConstructorChampion = '-';

    const latestCompletedSeason = [...championship.seasons]
      .reverse()
      .find(season => {
        if (season.sessions.length === 0) return false;

        // Count completed race sessions
        const completedRaces = season.sessions.filter(session => {
          const filename = session.filename.split('/').pop() || '';
          return filename.includes('session_race');
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
      }

      // Calculate constructor champion
      const constructorStandings = calculateConstructorStandings(seasonChampionship);
      if (constructorStandings.length > 0) {
        currentConstructorChampion = constructorStandings[0].brand;
      }
    }

    // Calculate total unique champions across all seasons
    const allChampions = new Set<string>();
    championship.seasons.forEach(season => {
      if (season.sessions.length === 0) return;

      // Count completed race sessions
      const completedRaces = season.sessions.filter(session => {
        const filename = session.filename.split('/').pop() || '';
        return filename.includes('session_race');
      }).length;

      // Only count champions from completed seasons (all rounds have been raced)
      if (completedRaces !== season.data.rounds.length) return;

      const seasonChampionship: Championship = {
        id: championship.id,
        data: season.data,
        folderName: championship.folderName,
        sessions: season.sessions,
        seasons: [season],
      };
      const standings = calculateStandings(seasonChampionship);
      if (standings.length > 0) {
        allChampions.add(standings[0].name);
      }
    });
    const totalChampions = allChampions.size;

    // Calculate total unique race winners
    const allWinners = new Set<string>();
    championship.sessions
      .filter(session => session.data.session_info.session_type === 'race')
      .forEach(session => {
        const drivers = Object.entries(session.data.driver_statistics);
        const winner = drivers.find(([_, stats]) => stats.position === 1);
        if (winner) {
          allWinners.add(winner[0]);
        }
      });
    const totalRaceWinners = allWinners.size;

    championshipStats.set(championship.id, {
      currentChampion,
      currentConstructorChampion,
      totalChampions,
      totalRaceWinners,
    });
  });

  return <RaceExplorer quickRaces={enrichedQuickRaces} championships={championships} championshipStats={championshipStats} />;
}
