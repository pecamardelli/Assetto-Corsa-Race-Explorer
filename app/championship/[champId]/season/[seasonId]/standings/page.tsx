import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChampionship } from '../../../../../lib/race-data';
import { calculateStandings } from '../../../../../lib/standings';
import { Championship } from '../../../../../types/race';
import { getCarName } from '../../../../../lib/car-data';
import BackButton from '../../../../../components/BackButton';
import FlagIcon from '../../../../../components/FlagIcon';
import DriverPortrait from '../../../../../components/DriverPortrait';
import { resolveDriverPortraits } from '../../../../../lib/driver-assets';
import { classLabel, isMultiClass } from '../../../../../lib/racing-classes';
import { racesInTraffic } from '../../../../../lib/traffic';
import { formatDuration } from '../../../../../lib/format-utils';

export default async function SeasonStandingsPage({ params }: { params: Promise<{ champId: string; seasonId: string }> }) {
  const { champId, seasonId } = await params;
  const decodedChampId = decodeURIComponent(champId);
  const decodedSeasonId = decodeURIComponent(seasonId);
  const championship = await getChampionship(decodedChampId);

  if (!championship) {
    notFound();
  }

  // Find the specific season
  const season = championship.seasons.find(s =>
    s.seasonName.toLowerCase().replace(' ', '_') === decodedSeasonId.toLowerCase()
  );

  if (!season) {
    notFound();
  }

  // Create a temporary Championship object for this season only
  const seasonChampionship: Championship = {
    id: championship.id,
    data: season.data,
    folderName: championship.folderName,
    sessions: season.sessions,
    seasons: [season],
  };

  const standings = calculateStandings(seasonChampionship);
  const portraits = await resolveDriverPortraits(standings.map(d => d.name), decodedChampId);
  const { data } = season;

  // A road series raced in traffic is judged on crashes and time on the road, not on
  // poles (there is no qualifying) and fastest laps (set by whatever was in the way).
  const trafficSeries = racesInTraffic(data, season.sessions);

  // A season running several classes is several championships, so it gets a table
  // each rather than one table with the GT cars stranded at the bottom of it.
  // Standings arrive sorted by class, so grouping in order is enough; a single-class
  // season yields exactly one group and renders as it always did.
  const multiClass = isMultiClass(data.opponents);
  const groups: { name: string; drivers: typeof standings }[] = [];
  for (const driver of standings) {
    const group = groups.at(-1);
    if (group && group.name === driver.class) group.drivers.push(driver);
    else groups.push({ name: driver.class, drivers: [driver] });
  }

  // Count only race sessions
  const completedRaces = season.sessions.filter(s => {
    const sessionType = s.data.session_type || s.data.session_info.session_type;
    return sessionType === 'race';
  }).length;

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
          <BackButton fallbackUrl={`/championship/${encodeURIComponent(decodedChampId)}/season/${encodeURIComponent(decodedSeasonId)}`}>
            Back to {season.seasonName}
          </BackButton>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-500/20 text-amber-400 uppercase">
              Driver Standings
            </span>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 uppercase">
              {season.seasonName}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
            {data.name}
          </h1>

          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>
              {completedRaces} of {data.rounds.length} rounds completed
            </span>
            <span>•</span>
            <span>{data.opponents.length} drivers</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={`/championship/${encodeURIComponent(decodedChampId)}/season/${encodeURIComponent(decodedSeasonId)}`}
              className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-green-500/20 flex items-center gap-2"
            >
              Season Rounds
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href={`/championship/${encodeURIComponent(decodedChampId)}/season/${encodeURIComponent(decodedSeasonId)}/constructors`}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/20 flex items-center gap-2"
            >
              Constructor Standings
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12 flex flex-col gap-8">
        {groups.map((group) => (
        <div key={group.name} className="flex flex-col gap-3">
        {multiClass && (
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-bold text-white">{classLabel(group.name)}</h2>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              {group.drivers.length} {group.drivers.length === 1 ? 'driver' : 'drivers'}
            </span>
          </div>
        )}
        {/* Standings Table */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Pos
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    Wins
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    {trafficSeries ? 'Crashes' : 'Poles'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    Podiums
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    {trafficSeries ? 'Total Time' : 'Fast Laps'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {group.drivers.map((driver, index) => {
                  const position = index + 1;
                  const isLeader = position === 1;
                  const isPodium = position <= 3;

                  return (
                    <tr
                      key={driver.name}
                      className={`hover:bg-zinc-800/80 transition-colors ${
                        isLeader ? 'bg-amber-500/5' : isPodium ? 'bg-zinc-700/10' : ''
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          isLeader ? 'bg-amber-500 text-zinc-900' :
                          position === 2 ? 'bg-zinc-400 text-zinc-900' :
                          position === 3 ? 'bg-amber-700 text-white' :
                          'bg-zinc-700 text-white'
                        }`}>
                          {position}
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
                          <div className="text-xs text-zinc-500 mt-1 hidden sm:block">
                            {getCarName(driver.car)}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-center hidden sm:table-cell">
                        <FlagIcon nation={driver.nation} />
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden md:table-cell">
                        {driver.wins > 0 ? (
                          <span className="text-amber-400 font-semibold">{driver.wins}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden md:table-cell">
                        {trafficSeries ? (
                          driver.crashes > 0 ? (
                            <span className="text-red-400 font-semibold">{driver.crashes}</span>
                          ) : (
                            <span className="text-green-400 font-semibold">0</span>
                          )
                        ) : driver.poles > 0 ? (
                          <span className="text-purple-400 font-semibold">{driver.poles}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden lg:table-cell">
                        {driver.podiums > 0 ? (
                          <span className="text-zinc-300 font-semibold">{driver.podiums}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden lg:table-cell">
                        {trafficSeries ? (
                          <span className="font-mono text-zinc-300">{formatDuration(driver.totalTime)}</span>
                        ) : driver.fastestLaps > 0 ? (
                          <span className="text-green-400 font-semibold">{driver.fastestLaps}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`font-bold text-lg font-mono ${
                          isLeader ? 'text-amber-400' : 'text-white'
                        }`}>
                          {driver.customPoints.toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
        ))}
      </div>
    </div>
  );
}
