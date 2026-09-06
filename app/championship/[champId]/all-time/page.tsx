import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChampionship } from '../../../lib/race-data';
import { calculateAllTimeStats } from '../../../lib/standings';
import BackButton from '../../../components/BackButton';
import FlagIcon from '../../../components/FlagIcon';
import DriverPortrait from '../../../components/DriverPortrait';
import { resolveDriverPortraits } from '../../../lib/driver-assets';
import { racesInTraffic } from '../../../lib/traffic';
import { formatDuration } from '../../../lib/format-utils';
import { completedSeasonRanking } from '../../../lib/road-series-ranking';
import { getCarDetails, getCarPreviewUrl, getCarBadgeUrl } from '../../../lib/car-data';

export default async function AllTimeStandingsPage({ params }: { params: Promise<{ champId: string }> }) {
  const { champId } = await params;
  const decodedChampId = decodeURIComponent(champId);
  const championship = await getChampionship(decodedChampId);

  if (!championship) {
    notFound();
  }

  const { data } = championship;

  // Calculate all-time stats for this championship only
  const driverStats = calculateAllTimeStats(championship.sessions, [championship]);

  // A road series raced in traffic: no poles, no fastest laps, and no abandons either
  // (nobody retires there: a crashed car is respawned and races on); the time on the
  // road joins the crashes the table already carried.
  const trafficSeries = racesInTraffic(data, championship.sessions);
  // A road series keeps its all-time table the way the first two Test Drives did: one
  // entry per driver per completed season, ranked by score. Empty until a season is over.
  const seasonRanking = trafficSeries ? completedSeasonRanking(championship) : [];
  const rankingPortraits = trafficSeries
    ? await resolveDriverPortraits([...new Set(seasonRanking.map(entry => entry.name))], decodedChampId)
    : new Map<string, string | null>();
  const portraits = await resolveDriverPortraits(driverStats.map(d => d.name), decodedChampId);

  // Count race sessions only
  const totalRaces = championship.sessions.filter(session => {
    const sessionType = session.data.session_type || session.data.session_info.session_type;
      return sessionType === 'race';
  }).length;

  // Total unique race winners, and drivers who won at least one championship
  const raceWinners = new Set(driverStats.filter(d => d.firstPlaces > 0).map(d => d.name));
  const champions = new Set(driverStats.filter(d => d.championshipsWon > 0).map(d => d.name));

  // A road series shows eight cards in one row, so they are drawn tighter there.
  const cardClass = trafficSeries
    ? 'bg-zinc-800/50 border border-zinc-700 rounded-lg p-4'
    : 'bg-zinc-800/50 border border-zinc-700 rounded-lg p-6';
  const bigNumber = trafficSeries ? 'text-2xl' : 'text-3xl';

  const summaryCards = (
    <>
      <div className={cardClass}>
        <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Drivers</h3>
        <div className={`${bigNumber} font-bold text-white`}>
          {driverStats.length}
        </div>
      </div>
      <div className={cardClass}>
        <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Races</h3>
        <div className={`${bigNumber} font-bold text-white`}>
          {totalRaces}
        </div>
      </div>
      <div className={cardClass}>
        <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Race Winners</h3>
        <div className={`${bigNumber} font-bold text-amber-400`}>
          {raceWinners.size}
        </div>
      </div>
      <div className={cardClass}>
        <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Champions</h3>
        <div className={`${bigNumber} font-bold text-amber-500`}>
          {champions.size}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Header. The banner is the section's own background rather than a card's
          right-hand column, so it runs the full width of the window and fades in
          over the first 40% of it. */}
      <section className="relative isolate overflow-hidden border-b border-zinc-700">
        {championship.bannerUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={championship.bannerUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 h-full w-full object-cover [-webkit-mask-image:linear-gradient(to_right,transparent_40%,black_85%)] [mask-image:linear-gradient(to_right,transparent_40%,black_85%)]"
          />
        )}
        <div className="w-full px-4 pt-4 pb-8 sm:px-6 lg:px-8 xl:px-12">
          <BackButton fallbackUrl={`/championship/${encodeURIComponent(decodedChampId)}`}>Back to Championship</BackButton>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold px-2 py-1 rounded bg-purple-500/20 text-purple-400 uppercase">
              All-Time Standings
            </span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
            {data.name}
          </h1>

          <p className="text-zinc-400 mb-4">
            {trafficSeries
              ? 'Best scores ever posted: every completed season, one entry per driver, ranked by score'
              : 'Career statistics across all seasons of this championship'}
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>{totalRaces} total races</span>
            <span>•</span>
            <span>{championship.seasons.length} {championship.seasons.length === 1 ? 'season' : 'seasons'}</span>
            <span>•</span>
            <span>{driverStats.length} drivers</span>
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {/* Statistics Summary: above the table for a circuit series; a road series
            keeps the ranking first and shows these in the bottom row instead. */}
        {!trafficSeries && driverStats.length > 0 && (
          <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {summaryCards}
          </div>
        )}

        {/* High-score table for a road series: one row per driver per completed season */}
        {trafficSeries ? (
          seasonRanking.length === 0 ? (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-12 text-center">
              <p className="text-zinc-400 text-lg">No completed season yet</p>
              <p className="text-zinc-500 text-sm mt-2">A score is posted here once every round of a season has been raced.</p>
            </div>
          ) : (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-900/50 border-b border-zinc-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      Nation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Car
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Season
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      <span className="text-amber-400">Wins</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Crashes
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {seasonRanking.map((entry, index) => {
                    const isTop = index === 0;
                    const isTop3 = index < 3;
                    const completed = entry.completedOn
                      ? new Date(entry.completedOn).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '-';
                    const car = getCarDetails(entry.car);
                    const carPreview = getCarPreviewUrl(entry.car);
                    const carBadge = getCarBadgeUrl(entry.car);

                    return (
                      <tr
                        key={`${entry.seasonNumber}-${entry.name}`}
                        className={`hover:bg-zinc-800/80 transition-colors ${
                          isTop ? 'bg-amber-500/5' : isTop3 ? 'bg-zinc-700/20' : ''
                        }`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                            isTop ? 'bg-amber-500 text-zinc-900' :
                            index === 1 ? 'bg-zinc-400 text-zinc-900' :
                            index === 2 ? 'bg-amber-700 text-white' :
                            'bg-zinc-700 text-white'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center hidden md:table-cell">
                          <div className="flex justify-center">
                            <div className="w-12 h-12 overflow-hidden rounded-full border-2 border-zinc-700">
                              <DriverPortrait driverName={entry.name} size={48} src={rankingPortraits.get(entry.name) ?? null} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/driver/${encodeURIComponent(entry.name)}`}
                            className="block hover:text-amber-400 transition-colors"
                          >
                            <div className="text-white font-medium">{entry.name}</div>
                            <div className="text-xs text-zinc-500 mt-1">
                              {entry.racesCompleted} race{entry.racesCompleted !== 1 ? 's' : ''}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-center hidden sm:table-cell">
                          <FlagIcon nation={entry.nation} />
                        </td>
                        <td className="px-4 py-4">
                          {/* The car: its brand's badge, the make and the model, then its picture */}
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                              {carBadge ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={carBadge} alt={car.brand} className="max-h-full max-w-full object-contain" />
                              ) : (
                                <div className="w-10 h-10 rounded-full border border-dashed border-zinc-700" />
                              )}
                            </div>
                            <div className="w-36 shrink-0">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{car.brand}</div>
                              <div className="text-sm text-zinc-200 truncate">{car.model}</div>
                            </div>
                            <div className="w-20 h-12 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/60">
                              {carPreview ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={carPreview} alt={car.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-600">No preview</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center text-zinc-300">
                          {entry.seasonName}
                        </td>
                        <td className="px-4 py-4 text-center text-zinc-400 whitespace-nowrap">
                          {completed}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-mono text-zinc-300">{formatDuration(entry.time)}</span>
                        </td>
                        <td className="px-4 py-4 text-center hidden sm:table-cell">
                          <div className={`font-bold text-lg ${entry.wins > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                            {entry.wins}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          <div className={`font-medium ${
                            entry.crashes === 0 ? 'text-green-400' :
                            entry.crashes > 20 ? 'text-red-400' :
                            'text-amber-400'
                          }`}>
                            {entry.crashes}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="font-bold text-lg text-blue-400">
                            {entry.score.toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )
        ) : driverStats.length === 0 ? (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-12 text-center">
            <p className="text-zinc-400 text-lg">No driver statistics available</p>
            <p className="text-zinc-500 text-sm mt-2">This championship doesn&apos;t have any race data yet.</p>
          </div>
        ) : (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-900/50 border-b border-zinc-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                      {/* Driver Image - no title */}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      Nation
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      Races
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      <span className="text-amber-400">1st</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      <span className="text-zinc-300">2nd</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      <span className="text-amber-600">3rd</span>
                    </th>
                    {!trafficSeries && (
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                      Poles
                    </th>
                    )}
                    {!trafficSeries && (
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                      Abandons
                    </th>
                    )}
                    {!trafficSeries && (
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Fastest Laps
                    </th>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Crashes
                    </th>
                    {trafficSeries && (
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Total Time
                    </th>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Titles
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {driverStats.map((driver, index) => {
                    const isTopDriver = index === 0;
                    const isTop3 = index < 3;

                    return (
                      <tr
                        key={driver.name}
                        className={`hover:bg-zinc-800/80 transition-colors ${
                          isTopDriver ? 'bg-amber-500/5' : isTop3 ? 'bg-zinc-700/20' : ''
                        }`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                            isTopDriver ? 'bg-amber-500 text-zinc-900' :
                            index === 1 ? 'bg-zinc-400 text-zinc-900' :
                            index === 2 ? 'bg-amber-700 text-white' :
                            'bg-zinc-700 text-white'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center hidden md:table-cell">
                          <div className="flex justify-center">
                            <div className="w-12 h-12 overflow-hidden rounded-full border-2 border-zinc-700">
                              <DriverPortrait driverName={driver.name} size={48} src={portraits.get(driver.name) ?? null} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/driver/${encodeURIComponent(driver.name)}`}
                            className="block hover:text-amber-400 transition-colors"
                          >
                            <div className="text-white font-medium">{driver.name}</div>
                            <div className="text-xs text-zinc-500 mt-1">
                              {driver.podiums} podium{driver.podiums !== 1 ? 's' : ''}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-center hidden sm:table-cell">
                          <FlagIcon nation={driver.nation} />
                        </td>
                        <td className="px-4 py-4 text-center text-zinc-400 hidden sm:table-cell">
                          {driver.totalRaces}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className={`font-bold text-lg ${
                            driver.firstPlaces > 0 ? 'text-amber-400' : 'text-zinc-600'
                          }`}>
                            {driver.firstPlaces}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center hidden sm:table-cell">
                          <div className={`font-bold text-lg ${
                            driver.secondPlaces > 0 ? 'text-zinc-300' : 'text-zinc-600'
                          }`}>
                            {driver.secondPlaces}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center hidden sm:table-cell">
                          <div className={`font-bold text-lg ${
                            driver.thirdPlaces > 0 ? 'text-amber-600' : 'text-zinc-600'
                          }`}>
                            {driver.thirdPlaces}
                          </div>
                        </td>
                        {!trafficSeries && (
                          <td className="px-4 py-4 text-center hidden md:table-cell">
                            <div className={`font-medium ${
                              driver.poles > 0 ? 'text-purple-400' : 'text-zinc-600'
                            }`}>
                              {driver.poles}
                            </div>
                          </td>
                        )}
                        {!trafficSeries && (
                          <td className="px-4 py-4 text-center hidden md:table-cell">
                            <div className={`font-medium ${
                              driver.abandons === 0 ? 'text-green-400' :
                              driver.abandons > 5 ? 'text-red-400' :
                              'text-amber-400'
                            }`}>
                              {driver.abandons}
                            </div>
                          </td>
                        )}
                        {!trafficSeries && (
                          <td className="px-4 py-4 text-center hidden lg:table-cell">
                            <div className={`font-medium ${
                              driver.fastestLaps > 0 ? 'text-purple-400' : 'text-zinc-600'
                            }`}>
                              {driver.fastestLaps}
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          <div className={`font-medium ${
                            driver.totalCrashes === 0 ? 'text-green-400' :
                            driver.totalCrashes > 20 ? 'text-red-400' :
                            'text-amber-400'
                          }`}>
                            {driver.totalCrashes}
                          </div>
                        </td>
                        {trafficSeries && (
                          <td className="px-4 py-4 text-center hidden lg:table-cell">
                            <span className="font-mono text-zinc-300">{formatDuration(driver.totalTime)}</span>
                          </td>
                        )}
                        <td className="px-4 py-4 text-center">
                          {driver.championshipsWon > 0 ? (
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-zinc-900 font-bold">
                              {driver.championshipsWon}
                            </div>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="font-bold text-lg text-blue-400">
                            {driver.totalPoints.toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Performers */}
        {driverStats.length > 0 && (() => {
          const mostWins = driverStats.reduce((max, d) => Math.max(max, d.firstPlaces), 0);
          const mostWinsDriver = driverStats.find(d => d.firstPlaces === mostWins);

          const mostFastestLaps = driverStats.reduce((max, d) => Math.max(max, d.fastestLaps), 0);
          const fastestLapsDriver = driverStats.find(d => d.fastestLaps === mostFastestLaps);

          // The road series' card in its place: who has the most road behind them.
          const mostTime = driverStats.reduce((max, d) => Math.max(max, d.totalTime), 0);
          const mostTimeDriver = driverStats.find(d => d.totalTime === mostTime);

          // Find cleanest driver: best points/crashes ratio
          // Drivers with 0 crashes get special handling (infinite ratio)
          const cleanestDriver = driverStats
            .slice()
            .sort((a, b) => {
              const ratioA = a.totalCrashes === 0 ? Infinity : a.totalPoints / a.totalCrashes;
              const ratioB = b.totalCrashes === 0 ? Infinity : b.totalPoints / b.totalCrashes;
              if (ratioB !== ratioA) return ratioB - ratioA;
              // If ratios are equal, prefer higher points
              return b.totalPoints - a.totalPoints;
            })[0];

          const mostChampionships = driverStats.reduce((max, d) => Math.max(max, d.championshipsWon), 0);
          const championDriver = driverStats.find(d => d.championshipsWon === mostChampionships);

          return (
            <div className={`mt-8 grid gap-4 ${
              trafficSeries
                ? 'grid-cols-2 md:grid-cols-4 xl:grid-cols-8'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
            }`}>
              {trafficSeries && summaryCards}

              <div className={cardClass}>
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Wins</h3>
                <div className="text-2xl font-bold text-amber-400 mb-1">
                  {mostWins}
                </div>
                <div className="text-zinc-500 text-sm">
                  {mostWinsDriver?.name || 'N/A'}
                </div>
              </div>

              {trafficSeries ? (
                <div className={cardClass}>
                  <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Time on the Road</h3>
                  <div className="text-2xl font-bold text-zinc-300 mb-1 font-mono">
                    {formatDuration(mostTime)}
                  </div>
                  <div className="text-zinc-500 text-sm">
                    {mostTimeDriver?.name || 'N/A'}
                  </div>
                </div>
              ) : (
                <div className={cardClass}>
                  <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Fastest Laps</h3>
                  <div className="text-2xl font-bold text-purple-400 mb-1">
                    {mostFastestLaps}
                  </div>
                  <div className="text-zinc-500 text-sm">
                    {fastestLapsDriver?.name || 'N/A'}
                  </div>
                </div>
              )}

              <div className={cardClass}>
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Cleanest Driver</h3>
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {cleanestDriver ? cleanestDriver.totalCrashes : 0} crashes
                </div>
                <div className="text-zinc-500 text-sm">
                  {cleanestDriver?.name || 'N/A'}
                </div>
              </div>

              <div className={cardClass}>
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Championships</h3>
                <div className="text-2xl font-bold text-amber-500 mb-1">
                  {mostChampionships > 0 ? mostChampionships : '-'}
                </div>
                <div className="text-zinc-500 text-sm">
                  {mostChampionships > 0 ? (championDriver?.name || 'N/A') : 'None'}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
