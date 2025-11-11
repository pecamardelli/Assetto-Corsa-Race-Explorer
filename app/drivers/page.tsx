import Link from 'next/link';
import { getRaceSessions, getChampionships } from '../lib/race-data';
import { calculateAllTimeStats } from '../lib/standings';
import BackButton from '../components/BackButton';

export default async function DriversPage() {
  const [sessions, championships] = await Promise.all([
    getRaceSessions(),
    getChampionships(),
  ]);

  // Combine all sessions (quick races + championship races)
  const allSessions = [
    ...sessions,
    ...championships.flatMap(c => c.sessions),
  ];

  const driverStats = calculateAllTimeStats(allSessions, championships);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton fallbackUrl="/">Back</BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
            <h1 className="text-4xl font-bold text-white mb-2">
              All-Time Driver Standings
            </h1>
            <p className="text-zinc-400">
              Career statistics across all races and championships
            </p>
          </div>
        </div>

        {/* Statistics Summary */}
        {driverStats.length > 0 && (
          <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
              <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Drivers</h3>
              <div className="text-3xl font-bold text-white">
                {driverStats.length}
              </div>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
              <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Races</h3>
              <div className="text-3xl font-bold text-white">
                {allSessions.length}
              </div>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
              <h3 className="text-zinc-400 text-sm font-medium mb-2">Championships</h3>
              <div className="text-3xl font-bold text-white">
                {championships.length}
              </div>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
              <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Crashes</h3>
              <div className="text-3xl font-bold text-red-400">
                {driverStats.reduce((sum, d) => sum + d.totalCrashes, 0)}
              </div>
            </div>
          </div>
        )}

        {/* Drivers Table */}
        {driverStats.length === 0 ? (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-12 text-center">
            <p className="text-zinc-400 text-lg">No driver statistics available</p>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Driver
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
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                      Abandons
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Fastest Laps
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Crashes
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Championships
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden xl:table-cell">
                      Total Races
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
                        <td className="px-4 py-4">
                          <div className="text-white font-medium">{driver.name}</div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {driver.podiums} podium{driver.podiums !== 1 ? 's' : ''}
                          </div>
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
                        <td className="px-4 py-4 text-center hidden md:table-cell">
                          <div className={`font-medium ${
                            driver.abandons === 0 ? 'text-green-400' :
                            driver.abandons > 5 ? 'text-red-400' :
                            'text-amber-400'
                          }`}>
                            {driver.abandons}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          <div className={`font-medium ${
                            driver.fastestLaps > 0 ? 'text-purple-400' : 'text-zinc-600'
                          }`}>
                            {driver.fastestLaps}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          <div className={`font-medium ${
                            driver.totalCrashes === 0 ? 'text-green-400' :
                            driver.totalCrashes > 20 ? 'text-red-400' :
                            'text-amber-400'
                          }`}>
                            {driver.totalCrashes}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {driver.championshipsWon > 0 ? (
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-zinc-900 font-bold">
                              {driver.championshipsWon}
                            </div>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center text-zinc-400 hidden xl:table-cell">
                          {driver.totalRaces}
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

          const eligibleDrivers = driverStats.filter(d => d.totalRaces >= 5);
          const cleanestDriver = (eligibleDrivers.length > 0 ? eligibleDrivers : driverStats)
            .slice()
            .sort((a, b) => {
              if (a.totalCrashes !== b.totalCrashes) return a.totalCrashes - b.totalCrashes;
              if (b.totalRaces !== a.totalRaces) return b.totalRaces - a.totalRaces;
              if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
              if (b.podiums !== a.podiums) return b.podiums - a.podiums;
              return a.name.localeCompare(b.name);
            })[0];

          const mostChampionships = driverStats.reduce((max, d) => Math.max(max, d.championshipsWon), 0);
          const championDriver = driverStats.find(d => d.championshipsWon === mostChampionships);

          return (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Wins</h3>
                <div className="text-2xl font-bold text-amber-400 mb-1">
                  {mostWins}
                </div>
                <div className="text-zinc-500 text-sm">
                  {mostWinsDriver?.name || 'N/A'}
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Fastest Laps</h3>
                <div className="text-2xl font-bold text-purple-400 mb-1">
                  {mostFastestLaps}
                </div>
                <div className="text-zinc-500 text-sm">
                  {fastestLapsDriver?.name || 'N/A'}
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Cleanest Driver</h3>
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {cleanestDriver ? cleanestDriver.totalCrashes : 0} crashes
                </div>
                <div className="text-zinc-500 text-sm">
                  {cleanestDriver?.name || 'N/A'}
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
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
