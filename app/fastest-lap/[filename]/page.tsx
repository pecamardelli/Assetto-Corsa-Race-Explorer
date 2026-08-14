import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRaceSession, getChampionship } from '../../lib/race-data';
import { formatLapTime, safeNumber } from '../../lib/format-utils';
import { getCarName } from '../../lib/car-data';
import { getTrackDetails, getTrackPreviewUrl } from '../../lib/track-data';
import BackButton from '../../components/BackButton';
import FlagIcon from '../../components/FlagIcon';
import DriverPortrait from '../../components/DriverPortrait';
import { resolveDriverPortraits } from '../../lib/driver-assets';

export default async function FastestLapPage({ params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const decodedFilename = decodeURIComponent(filename);
  const session = await getRaceSession(decodedFilename);

  if (!session) {
    notFound();
  }

  const { session_info, driver_statistics } = session.data;
  const trackDetails = getTrackDetails(session_info.track, session_info.track_config);
  const trackPreview = getTrackPreviewUrl(session_info.track, session_info.track_config);
  const sessionType = session_info.session_type || 'race';

  // Load championship data if this session is part of a championship
  const driverNationMap = new Map<string, string>();
  if (session.championship) {
    const championship = await getChampionship(session.championship);
    if (championship?.data?.opponents) {
      championship.data.opponents.forEach((opponent: any) => {
        driverNationMap.set(opponent.name, opponent.nation);
      });
    }
  }

  // Sort drivers by best lap time
  const driversByFastestLap = Object.entries(driver_statistics)
    .map(([name, stats]) => ({
      name,
      ...stats,
      nation: (stats as any).nation || driverNationMap.get(name)
    }))
    .filter(driver => {
      const lapTime = safeNumber(driver.best_lap);
      return lapTime > 0; // Only include drivers with valid lap times
    })
    .sort((a, b) => {
      const lapA = safeNumber(a.best_lap);
      const lapB = safeNumber(b.best_lap);
      return lapA - lapB;
    });

  // Get fastest lap for gap calculation
  // Portraits resolve against the session's championship, so a series with its own
  // driver portraits uses them here too.
  const portraits = await resolveDriverPortraits(
    driversByFastestLap.map(d => d.name || 'Unknown'),
    session.championship
  );
  const fastestLap = driversByFastestLap.length > 0 ? safeNumber(driversByFastestLap[0].best_lap) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Header. The track's preview photo is the section's own background, running
          the full width of the window and fading in over the first 40% of it. */}
      <section className="relative isolate overflow-hidden border-b border-zinc-700">
        {trackPreview && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={trackPreview}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 h-full w-full object-cover [-webkit-mask-image:linear-gradient(to_right,transparent_40%,black_85%)] [mask-image:linear-gradient(to_right,transparent_40%,black_85%)]"
          />
        )}
        <div className="w-full px-4 pt-4 pb-8 sm:px-6 lg:px-8 xl:px-12">
          <BackButton fallbackUrl="/">Back</BackButton>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold px-2 py-1 rounded bg-purple-500/20 text-purple-400 uppercase">
              Fastest Lap
            </span>
            <span className={`text-xs font-semibold px-2 py-1 rounded uppercase ${
              sessionType === 'practice' ? 'bg-blue-500/20 text-blue-400' :
              sessionType === 'qualifying' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {sessionType}
            </span>
            {session.championship && (
              <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-500/20 text-amber-400">
                {session.championship}
              </span>
            )}
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
            {trackDetails.name}
          </h1>
          {trackDetails.city && trackDetails.country && (
            <p className="text-zinc-400 mb-4">
              {trackDetails.city}, {trackDetails.country}
              {trackDetails.length && <> • {trackDetails.length}</>}
            </p>
          )}

          <div className="grid max-w-3xl grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {session_info.date && (
              <div>
                <span className="text-zinc-500 block mb-1">Date</span>
                <span className="text-white font-medium font-mono">
                  {new Date(session_info.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
            <div>
              <span className="text-zinc-500 block mb-1">Drivers</span>
              <span className="text-white font-medium">{driversByFastestLap.length}</span>
            </div>
            {fastestLap > 0 && (
              <div>
                <span className="text-zinc-500 block mb-1">Fastest Lap</span>
                <span className="text-white font-medium font-mono">{formatLapTime(fastestLap)}</span>
              </div>
            )}
          </div>

          {/* Link to Race Results */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={`/race/${encodeURIComponent(decodedFilename)}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-semibold transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              View Race Results
            </Link>
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {/* Fastest Lap Standings */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-zinc-700">
            <h2 className="text-2xl font-bold text-white">Fastest Lap Standings</h2>
          </div>

          {driversByFastestLap.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-zinc-400 text-lg">No lap times recorded</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-900/50">
                  <tr className="text-left text-xs uppercase tracking-wider text-zinc-400">
                    <th className="px-6 py-4 font-semibold">Pos</th>
                    <th className="px-6 py-4 font-semibold text-center hidden md:table-cell">{/* Driver Image */}</th>
                    <th className="px-6 py-4 font-semibold">Driver</th>
                    <th className="px-6 py-4 font-semibold text-center hidden sm:table-cell">Nation</th>
                    <th className="px-6 py-4 font-semibold">Car</th>
                    <th className="px-6 py-4 font-semibold text-right">Best Lap</th>
                    <th className="px-6 py-4 font-semibold text-right">Gap</th>
                    <th className="px-6 py-4 font-semibold text-right">Avg Lap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {driversByFastestLap.map((driver, index) => {
                    const bestLap = safeNumber(driver.best_lap);
                    const avgLap = safeNumber(driver.average_lap);
                    const gap = bestLap - fastestLap;
                    const isPlayer = driver.name === 'PLAYER';
                    const isFastest = index === 0;

                    return (
                      <tr
                        key={driver.name}
                        className={`transition-colors ${
                          isPlayer
                            ? 'bg-blue-500/10 hover:bg-blue-500/20'
                            : 'hover:bg-zinc-800/50'
                        }`}
                      >
                        {/* Position */}
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center justify-center w-8 h-8 rounded font-bold text-sm ${
                            isFastest
                              ? 'bg-purple-500/20 text-purple-400'
                              : index === 1
                              ? 'bg-zinc-600/50 text-zinc-300'
                              : index === 2
                              ? 'bg-amber-900/30 text-amber-600'
                              : 'text-zinc-400'
                          }`}>
                            {index + 1}
                          </div>
                        </td>

                        {/* Driver Portrait */}
                        <td className="px-6 py-4 text-center hidden md:table-cell">
                          <div className="flex justify-center">
                            <div className="w-12 h-12 overflow-hidden rounded-full border-2 border-zinc-700">
                              <DriverPortrait driverName={driver.name} size={48} src={portraits.get(driver.name) ?? null} />
                            </div>
                          </div>
                        </td>

                        {/* Driver Name */}
                        <td className="px-6 py-4">
                          <span className={`font-medium ${
                            isPlayer ? 'text-blue-400' : 'text-white'
                          }`}>
                            {driver.name}
                          </span>
                        </td>

                        {/* Nation */}
                        <td className="px-6 py-4 text-center hidden sm:table-cell">
                          {driver.nation && <FlagIcon nation={driver.nation} />}
                        </td>

                        {/* Car */}
                        <td className="px-6 py-4">
                          <span className="text-zinc-400">
                            {driver.car_name ? getCarName(driver.car_name) : 'N/A'}
                          </span>
                        </td>

                        {/* Best Lap */}
                        <td className="px-6 py-4 text-right">
                          <span className={`font-mono font-semibold ${
                            isFastest ? 'text-purple-400' : 'text-white'
                          }`}>
                            {formatLapTime(bestLap)}
                          </span>
                        </td>

                        {/* Gap */}
                        <td className="px-6 py-4 text-right">
                          {isFastest ? (
                            <span className="text-purple-400 font-semibold">—</span>
                          ) : (
                            <span className="text-zinc-400 font-mono text-sm">
                              +{gap.toFixed(3)}s
                            </span>
                          )}
                        </td>

                        {/* Average Lap */}
                        <td className="px-6 py-4 text-right">
                          <span className="text-zinc-400 font-mono text-sm">
                            {formatLapTime(avgLap)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
