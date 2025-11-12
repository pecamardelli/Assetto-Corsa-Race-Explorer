import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRaceSession } from '../../lib/race-data';
import { formatTrackName, formatLapTime, formatCarName, getSortedDrivers, safeNumber } from '../../lib/format-utils';
import BackButton from '../../components/BackButton';

export default async function RacePage({ params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const decodedFilename = decodeURIComponent(filename);
  const session = await getRaceSession(decodedFilename);

  if (!session) {
    notFound();
  }

  const { session_info, driver_statistics } = session.data;
  const sessionType = session_info.session_type || 'race';
  const isPracticeOrQualifying = sessionType === 'practice' || sessionType === 'qualifying';

  // Sort drivers: by lap time for practice/qualifying, by position for race
  const drivers = isPracticeOrQualifying
    ? Object.entries(driver_statistics)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => {
          const lapA = safeNumber(a.best_lap);
          const lapB = safeNumber(b.best_lap);
          // Drivers with no lap time go to the end
          if (lapA === 0 && lapB === 0) return 0;
          if (lapA === 0) return 1;
          if (lapB === 0) return -1;
          return lapA - lapB;
        })
    : getSortedDrivers(driver_statistics);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton fallbackUrl="/">Back</BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
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
            <h1 className="text-4xl font-bold text-white mb-4">
              {formatTrackName(session_info.track)}
            </h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {session_info.track_config && (
                <div>
                  <span className="text-zinc-500 block mb-1">Configuration</span>
                  <span className="text-white font-medium">{session_info.track_config}</span>
                </div>
              )}
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
              {session_info.track_length_km && (
                <div>
                  <span className="text-zinc-500 block mb-1">Track Length</span>
                  <span className="text-white font-medium">{session_info.track_length_km.toFixed(2)} km</span>
                </div>
              )}
              {session_info.race_laps && (
                <div>
                  <span className="text-zinc-500 block mb-1">Race Length</span>
                  <span className="text-white font-medium">{session_info.race_laps} {session_info.race_laps === 1 ? 'lap' : 'laps'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Table */}
        {drivers.length === 0 ? (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-12 text-center">
            <p className="text-zinc-400 text-lg">No race results available</p>
          </div>
        ) : (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-900/50 border-b border-zinc-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Pos
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      Car
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      {isPracticeOrQualifying ? 'Total Laps' : 'Laps'}
                    </th>
                    {!isPracticeOrQualifying && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                        Overtakes
                      </th>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Crashes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Best Lap
                    </th>
                    {!isPracticeOrQualifying && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider hidden xl:table-cell">
                        Total Time
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      {isPracticeOrQualifying ? 'Gap' : 'Score'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {drivers.map((driver, index) => {
                    const isWinner = index === 0;
                    const isPodium = index < 3;
                    const netPositions = safeNumber(driver.net_positions_gained, 0);
                    const totalCrashes = safeNumber(driver.crashes?.total_crashes, 0);
                    const worstCrashG = safeNumber(driver.crashes?.worst_crash_g, 0);

                    // Calculate time difference for practice/qualifying
                    const fastestLap = drivers[0]?.best_lap || 0;
                    const driverLap = safeNumber(driver.best_lap);
                    const timeDiff = driverLap > 0 && fastestLap > 0 ? driverLap - fastestLap : 0;

                    return (
                      <tr
                        key={driver.name}
                        className={`hover:bg-zinc-800/80 transition-colors ${
                          isWinner ? 'bg-amber-500/5' : isPodium ? 'bg-zinc-700/20' : ''
                        }`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                            isWinner ? 'bg-amber-500 text-zinc-900' :
                            index === 1 ? 'bg-zinc-400 text-zinc-900' :
                            index === 2 ? 'bg-amber-700 text-white' :
                            'bg-zinc-700 text-white'
                          }`}>
                            {safeNumber(driver.position, index + 1)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-white font-medium">{driver.name || 'Unknown'}</div>
                          {!isPracticeOrQualifying && netPositions !== 0 && (
                            <div className={`text-xs mt-1 ${
                              netPositions > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {netPositions > 0 ? '↑' : '↓'} {Math.abs(netPositions)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-zinc-400 text-sm hidden sm:table-cell">
                          {formatCarName(driver.car_name)}
                        </td>
                        <td className="px-4 py-4 text-center text-white">
                          {safeNumber(driver.laps_completed, 0)}
                        </td>
                        {!isPracticeOrQualifying && (
                          <td className="px-4 py-4 text-center hidden lg:table-cell">
                            <div className="text-green-400 font-medium">+{safeNumber(driver.overtakes_made, 0)}</div>
                            <div className="text-red-400 text-xs">-{safeNumber(driver.times_overtaken, 0)}</div>
                          </td>
                        )}
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          <div className={`font-medium ${
                            totalCrashes === 0 ? 'text-green-400' :
                            totalCrashes > 5 ? 'text-red-400' :
                            'text-amber-400'
                          }`}>
                            {totalCrashes}
                          </div>
                          {worstCrashG > 0 && (
                            <div className="text-xs text-zinc-500">
                              {worstCrashG.toFixed(0)}G max
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-white font-mono">
                            {formatLapTime(driver.best_lap)}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            Avg: {formatLapTime(driver.average_lap)}
                          </div>
                        </td>
                        {!isPracticeOrQualifying && (
                          <td className="px-4 py-4 text-white font-mono hidden xl:table-cell">
                            {driver.total_time_formatted || '-'}
                          </td>
                        )}
                        <td className="px-4 py-4">
                          {isPracticeOrQualifying ? (
                            <div className="text-zinc-400 font-mono font-medium">
                              {index === 0 ? '-' : `+${timeDiff.toFixed(3)}`}
                            </div>
                          ) : (
                            <div className="text-white font-mono font-medium">
                              {safeNumber(driver.total_score, 0).toLocaleString()}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats Summary - Only show for race sessions */}
        {!isPracticeOrQualifying && drivers.length > 0 && (() => {
          const validLaps = drivers
            .map(d => safeNumber(d.best_lap))
            .filter(lap => lap > 0);

          const validOvertakes = drivers
            .map(d => safeNumber(d.overtakes_made, 0));

          const fastestLap = validLaps.length > 0 ? Math.min(...validLaps) : 0;
          const fastestDriver = drivers.find(d => safeNumber(d.best_lap) === fastestLap);

          const mostOvertakes = validOvertakes.length > 0 ? Math.max(...validOvertakes) : 0;
          const overtakingDriver = drivers.find(d => safeNumber(d.overtakes_made, 0) === mostOvertakes);

          const cleanDrivers = drivers.filter(d => safeNumber(d.crashes?.total_crashes, 0) === 0).length;

          return (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Fastest Lap</h3>
                <div className="text-2xl font-bold text-white font-mono mb-1">
                  {formatLapTime(fastestLap)}
                </div>
                <div className="text-zinc-500 text-sm">
                  {fastestDriver?.name || 'N/A'}
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Overtakes</h3>
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {mostOvertakes}
                </div>
                <div className="text-zinc-500 text-sm">
                  {overtakingDriver?.name || 'N/A'}
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Clean Drivers</h3>
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {cleanDrivers}
                </div>
                <div className="text-zinc-500 text-sm">
                  No crashes recorded
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
