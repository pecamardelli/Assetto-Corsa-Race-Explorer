import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getChampionship } from '../../../lib/race-data';
import { calculateAllTimeConstructorStats } from '../../../lib/standings';
import BackButton from '../../../components/BackButton';

export default async function AllTimeConstructorStandingsPage({ params }: { params: Promise<{ champId: string }> }) {
  const { champId } = await params;
  const decodedChampId = decodeURIComponent(champId);
  const championship = await getChampionship(decodedChampId);

  if (!championship) {
    notFound();
  }

  const { data } = championship;

  // Calculate all-time constructor stats for this championship only
  const constructorStats = calculateAllTimeConstructorStats(championship.sessions, [championship]);

  // Count race sessions only
  const totalRaces = championship.sessions.filter(session => {
    const sessionType = session.data.session_type || session.data.session_info.session_type;
    return sessionType === 'race';
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton fallbackUrl={`/championship/${encodeURIComponent(decodedChampId)}`}>Back to Championship</BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400 uppercase">
                All-Time Constructor Standings
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              {data.name}
            </h1>

            <p className="text-zinc-400 mb-4">
              Constructor statistics across all seasons of this championship
            </p>

            <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
              <span>{totalRaces} total races</span>
              <span>•</span>
              <span>{championship.seasons.length} {championship.seasons.length === 1 ? 'season' : 'seasons'}</span>
              <span>•</span>
              <span>{constructorStats.length} constructors</span>
            </div>
          </div>
        </div>

        {/* Statistics Summary */}
        {constructorStats.length > 0 && (() => {
          // Calculate total unique race winners
          const raceWinners = new Set(
            constructorStats.filter(c => c.wins > 0).map(c => c.name)
          );

          // Calculate total champions (constructors who won at least one championship)
          const champions = new Set(
            constructorStats.filter(c => c.championshipsWon > 0).map(c => c.name)
          );

          return (
            <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Constructors</h3>
                <div className="text-3xl font-bold text-white">
                  {constructorStats.length}
                </div>
              </div>
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Races</h3>
                <div className="text-3xl font-bold text-white">
                  {totalRaces}
                </div>
              </div>
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Race Winners</h3>
                <div className="text-3xl font-bold text-amber-400">
                  {raceWinners.size}
                </div>
              </div>
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Champions</h3>
                <div className="text-3xl font-bold text-amber-500">
                  {champions.size}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Constructors Table */}
        {constructorStats.length === 0 ? (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-12 text-center">
            <p className="text-zinc-400 text-lg">No constructor statistics available</p>
            <p className="text-zinc-500 text-sm mt-2">This championship doesn't have any race data yet.</p>
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
                    <th className="px-2 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      {/* Badge - no title */}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Brand
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                      Model
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Year
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      Drivers
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      Races
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      <span className="text-amber-400">Wins</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                      Poles
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Podiums
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Fastest Laps
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Titles
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {constructorStats.map((constructor, index) => {
                    const isTopConstructor = index === 0;
                    const isTop3 = index < 3;

                    return (
                      <tr
                        key={constructor.carName}
                        className={`hover:bg-zinc-800/80 transition-colors ${
                          isTopConstructor ? 'bg-blue-500/5' : isTop3 ? 'bg-zinc-700/20' : ''
                        }`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                            isTopConstructor ? 'bg-blue-500 text-white' :
                            index === 1 ? 'bg-zinc-400 text-zinc-900' :
                            index === 2 ? 'bg-blue-700 text-white' :
                            'bg-zinc-700 text-white'
                          }`}>
                            {index + 1}
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
                          <Link
                            href={`/car/${encodeURIComponent(constructor.carName)}`}
                            className="block hover:text-blue-400 transition-colors"
                          >
                            <div className="text-white font-medium">{constructor.brand}</div>
                            <div className="text-xs text-zinc-500 mt-1">
                              {constructor.podiums} podium{constructor.podiums !== 1 ? 's' : ''}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-zinc-300 hidden md:table-cell">
                          {constructor.model}
                        </td>
                        <td className="px-4 py-4 text-center text-zinc-400 hidden lg:table-cell">
                          {constructor.year || '-'}
                        </td>
                        <td className="px-4 py-4 text-center text-zinc-400 hidden sm:table-cell">
                          {constructor.driverCount}
                        </td>
                        <td className="px-4 py-4 text-center text-zinc-400 hidden sm:table-cell">
                          {constructor.totalRaces}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className={`font-bold text-lg ${
                            constructor.wins > 0 ? 'text-amber-400' : 'text-zinc-600'
                          }`}>
                            {constructor.wins}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center hidden md:table-cell">
                          <div className={`font-medium ${
                            constructor.poles > 0 ? 'text-purple-400' : 'text-zinc-600'
                          }`}>
                            {constructor.poles}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          <div className={`font-medium ${
                            constructor.podiums > 0 ? 'text-zinc-300' : 'text-zinc-600'
                          }`}>
                            {constructor.podiums}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          <div className={`font-medium ${
                            constructor.fastestLaps > 0 ? 'text-green-400' : 'text-zinc-600'
                          }`}>
                            {constructor.fastestLaps}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {constructor.championshipsWon > 0 ? (
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-zinc-900 font-bold">
                              {constructor.championshipsWon}
                            </div>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="font-bold text-lg text-blue-400">
                            {constructor.totalPoints.toLocaleString()}
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
        {constructorStats.length > 0 && (() => {
          const mostWins = constructorStats.reduce((max, c) => Math.max(max, c.wins), 0);
          const mostWinsConstructor = constructorStats.find(c => c.wins === mostWins);

          const mostPoles = constructorStats.reduce((max, c) => Math.max(max, c.poles), 0);
          const mostPolesConstructor = constructorStats.find(c => c.poles === mostPoles);

          const mostFastestLaps = constructorStats.reduce((max, c) => Math.max(max, c.fastestLaps), 0);
          const fastestLapsConstructor = constructorStats.find(c => c.fastestLaps === mostFastestLaps);

          const mostChampionships = constructorStats.reduce((max, c) => Math.max(max, c.championshipsWon), 0);
          const championConstructor = constructorStats.find(c => c.championshipsWon === mostChampionships);

          return (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Wins</h3>
                <div className="text-2xl font-bold text-amber-400 mb-1">
                  {mostWins}
                </div>
                <div className="text-zinc-500 text-sm">
                  {mostWinsConstructor?.brand || 'N/A'}
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Poles</h3>
                <div className="text-2xl font-bold text-purple-400 mb-1">
                  {mostPoles}
                </div>
                <div className="text-zinc-500 text-sm">
                  {mostPolesConstructor?.brand || 'N/A'}
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Fastest Laps</h3>
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {mostFastestLaps}
                </div>
                <div className="text-zinc-500 text-sm">
                  {fastestLapsConstructor?.brand || 'N/A'}
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                <h3 className="text-zinc-400 text-sm font-medium mb-2">Most Championships</h3>
                <div className="text-2xl font-bold text-amber-500 mb-1">
                  {mostChampionships > 0 ? mostChampionships : '-'}
                </div>
                <div className="text-zinc-500 text-sm">
                  {mostChampionships > 0 ? (championConstructor?.brand || 'N/A') : 'None'}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
