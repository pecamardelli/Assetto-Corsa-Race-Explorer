import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getChampionship } from '../../../lib/race-data';
import { calculateConstructorStandings } from '../../../lib/standings';
import BackButton from '../../../components/BackButton';

export default async function ConstructorsPage({ params }: { params: Promise<{ champId: string }> }) {
  const { champId } = await params;
  const decodedChampId = decodeURIComponent(champId);
  const championship = await getChampionship(decodedChampId);

  if (!championship) {
    notFound();
  }

  const standings = calculateConstructorStandings(championship);
  const { data } = championship;

  // Count only race sessions (not practice or qualifying)
  const completedRaces = championship.sessions.filter(session => {
    const sessionType = session.data.session_type || session.data.session_info.session_type;
      return sessionType === 'race';
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {/* Header */}
        <div className="mb-8">
          <BackButton fallbackUrl={`/championship/${encodeURIComponent(decodedChampId)}`}>Back</BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400 uppercase">
                Constructor Standings
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              {data.name}
            </h1>

            <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
              <span>
                {completedRaces} of {data.rounds.length} rounds completed
              </span>
              <span>•</span>
              <span>{standings.length} constructors</span>
            </div>
          </div>

          <Link
            href={`/championship/${encodeURIComponent(decodedChampId)}`}
            className="inline-flex items-center text-zinc-400 hover:text-blue-400 transition-colors text-sm"
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Drivers
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    Wins
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    Poles
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    Podiums
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    Fast Laps
                  </th>
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
                      <td className="px-4 py-4 text-center text-white">
                        {constructor.driverCount}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden md:table-cell">
                        {constructor.wins > 0 ? (
                          <span className="text-amber-400 font-semibold">{constructor.wins}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden md:table-cell">
                        {constructor.poles > 0 ? (
                          <span className="text-purple-400 font-semibold">{constructor.poles}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden lg:table-cell">
                        {constructor.podiums > 0 ? (
                          <span className="text-zinc-300 font-semibold">{constructor.podiums}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden lg:table-cell">
                        {constructor.fastestLaps > 0 ? (
                          <span className="text-green-400 font-semibold">{constructor.fastestLaps}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
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
