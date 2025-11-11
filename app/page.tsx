import { getRaceSessions, getChampionships } from './lib/race-data';
import RaceExplorer from './components/RaceExplorer';

export default async function Home() {
  const quickRaces = await getRaceSessions();
  const championships = await getChampionships();

  return <RaceExplorer quickRaces={quickRaces} championships={championships} />;
}
