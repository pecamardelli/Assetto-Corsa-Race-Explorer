import { getRaceSessions, getChampionships } from './lib/race-data';
import { getTrackDetails } from './lib/track-data';
import { readCategories, groupByCategory } from './lib/championship-categories';
import RaceExplorer from './components/RaceExplorer';

export default async function Home() {
  const quickRaces = await getRaceSessions();
  const championships = await getChampionships();
  const categories = await readCategories();

  // Enrich quick races with track details
  const enrichedQuickRaces = quickRaces.map(session => ({
    ...session,
    trackDetails: getTrackDetails(
      session.data.session_info.track,
      session.data.session_info.track_config
    ),
  }));

  // Grouped here rather than in the browser: the categories are read off disk, and
  // the order they impose is part of the page rather than something the client
  // works out for itself. Who holds each championship is no longer worked out here
  // — that belongs to the championship cards, which live on a category's own page.
  const sections = groupByCategory(championships, categories);

  return <RaceExplorer quickRaces={enrichedQuickRaces} sections={sections} />;
}
