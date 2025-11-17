import { getRaceSessions, getChampionships } from './lib/race-data';
import { getTrackDetails } from './lib/track-data';
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

  return <RaceExplorer quickRaces={enrichedQuickRaces} championships={championships} />;
}
