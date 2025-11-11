import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChampionship } from '../../../lib/race-data';
import { calculateStandings } from '../../../lib/standings';
import BackButton from '../../../components/BackButton';

export default async function StandingsPage({ params }: { params: Promise<{ champId: string }> }) {
  const { champId } = await params;
  const championship = await getChampionship(champId);

  if (!championship) {
    notFound();
  }

  const standings = calculateStandings(championship);
  const { data } = championship;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton fallbackUrl={`/championship/${champId}`}>Back</BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-500/20 text-amber-400 uppercase">
                Championship Standings
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              {data.name}
            </h1>

            <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
              <span>{championship.sessions.length} of {data.rounds.length} rounds completed</span>
              <span>•</span>
              <span>{data.opponents.length} drivers</span>
            </div>
          </div>

          <Link
            href={`/championship/${champId}`}
            className="inline-flex items-center text-zinc-400 hover:text-amber-400 transition-colors text-sm"
          >
            View Championship Rounds →
          </Link>
        </div>

        {/* Standings Table */}
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
                    Nation
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Points
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    Wins
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    Podiums
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    Races
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {standings.map((driver, index) => {
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
                      <td className="px-4 py-4">
                        <div className="text-white font-medium">{driver.name}</div>
                        <div className="text-xs text-zinc-500 mt-1 hidden sm:block">
                          {driver.car.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-400 text-sm hidden sm:table-cell">
                        <span className="font-mono uppercase">{driver.nation}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`font-bold text-lg ${
                          isLeader ? 'text-amber-400' : 'text-white'
                        }`}>
                          {driver.points}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden md:table-cell">
                        {driver.wins > 0 ? (
                          <span className="text-amber-400 font-semibold">{driver.wins}</span>
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
                      <td className="px-4 py-4 text-center text-zinc-400 hidden lg:table-cell">
                        {driver.racesCompleted}
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
