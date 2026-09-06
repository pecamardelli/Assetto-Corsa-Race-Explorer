import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getChampionship } from '../../../../../lib/race-data';
import { calculateConstructorStandings } from '../../../../../lib/standings';
import { Championship } from '../../../../../types/race';
import BackButton from '../../../../../components/BackButton';
import { racesInTraffic } from '../../../../../lib/traffic';
import { formatDuration } from '../../../../../lib/format-utils';

export default async function SeasonConstructorsPage({ params }: { params: Promise<{ champId: string; seasonId: string }> }) {
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

  const standings = calculateConstructorStandings(seasonChampionship);
  const { data } = season;

  // A road series raced in traffic: no qualifying, so no poles; lap times set by what
  // was in the way, so no fastest laps; and the drivers column goes, since a car may
  // carry more than one driver there and the table is about the car. In their place,
  // the shunts and the time on the road, per car.
  const trafficSeries = racesInTraffic(data, season.sessions);


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
            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400 uppercase">
              Constructor Standings
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
            <span>{standings.length} constructors</span>
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
              href={`/championship/${encodeURIComponent(decodedChampId)}/season/${encodeURIComponent(decodedSeasonId)}/standings`}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-amber-500/20 flex items-center gap-2"
            >
              Driver Standings
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {/* Standings Table */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Pos
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Brand
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Model
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Year
                  </th>
                  {!trafficSeries && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Drivers
                  </th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    Wins
                  </th>
                  {!trafficSeries && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    Poles
                  </th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    Podiums
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    {trafficSeries ? 'Crashes' : 'Fast Laps'}
                  </th>
                  {trafficSeries && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    Total Time
                  </th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {standings.map((constructor, index) => {
                  const position = index + 1;
                  const isLeader = position === 1;
                  const isPodium = position <= 3;

                  return (
                    <tr
                      key={constructor.name}
                      className={`hover:bg-zinc-800/80 transition-colors ${
                        isLeader ? 'bg-blue-500/5' : isPodium ? 'bg-zinc-700/10' : ''
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          isLeader ? 'bg-blue-500 text-white' :
                          position === 2 ? 'bg-zinc-400 text-zinc-900' :
                          position === 3 ? 'bg-blue-700 text-white' :
                          'bg-zinc-700 text-white'
                        }`}>
                          {position}
                        </span>
                      </td>
                      <td className="px-2 py-4">
                        <div className="flex items-center justify-center">
                          <Image
                            src={`/badges/${constructor.carName}.png`}
                            alt={constructor.brand}
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-white font-medium">{constructor.brand}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-zinc-300">{constructor.model}</div>
                      </td>
                      <td className="px-4 py-4 text-center text-zinc-400">
                        {constructor.year || '-'}
                      </td>
                      {!trafficSeries && (
                        <td className="px-4 py-4 text-center text-white">
                          {constructor.driverCount}
                        </td>
                      )}
                      <td className="px-4 py-4 text-center text-white hidden md:table-cell">
                        {constructor.wins > 0 ? (
                          <span className="text-amber-400 font-semibold">{constructor.wins}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      {!trafficSeries && (
                        <td className="px-4 py-4 text-center text-white hidden md:table-cell">
                          {constructor.poles > 0 ? (
                            <span className="text-purple-400 font-semibold">{constructor.poles}</span>
                          ) : (
                            <span className="text-zinc-600">0</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-4 text-center text-white hidden lg:table-cell">
                        {constructor.podiums > 0 ? (
                          <span className="text-zinc-300 font-semibold">{constructor.podiums}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden lg:table-cell">
                        {trafficSeries ? (
                          constructor.crashes > 0 ? (
                            <span className="text-red-400 font-semibold">{constructor.crashes}</span>
                          ) : (
                            <span className="text-green-400 font-semibold">0</span>
                          )
                        ) : constructor.fastestLaps > 0 ? (
                          <span className="text-green-400 font-semibold">{constructor.fastestLaps}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      {trafficSeries && (
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          <span className="font-mono text-zinc-300">{formatDuration(constructor.totalTime)}</span>
                        </td>
                      )}
                      <td className="px-4 py-4 text-center">
                        <div className={`font-bold text-lg font-mono ${
                          isLeader ? 'text-blue-400' : 'text-white'
                        }`}>
                          {constructor.customPoints.toLocaleString()}
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
    </div>
  );
}
