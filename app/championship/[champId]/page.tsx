import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChampionship } from '../../lib/race-data';
import { formatTrackName } from '../../lib/format-utils';
import BackButton from '../../components/BackButton';

export default async function ChampionshipPage({ params }: { params: Promise<{ champId: string }> }) {
  const { champId } = await params;
  const championship = await getChampionship(champId);

  if (!championship) {
    notFound();
  }

  const { data, sessions } = championship;

  // Match rounds with sessions based on track name
  const roundsWithSessions = data.rounds.map((round, index) => {
    // Find session that matches this round's track
    // The filename pattern is: stats_round_{XX}_{track}_{timestamp}.json
    const matchingSession = sessions.find(session => {
      const filename = session.filename.split('/').pop() || '';
      // Extract track from filename and round track
      const trackFromRound = round.track.split('-')[0]; // e.g., "rj_lemans_1967"
      return filename.includes(trackFromRound) && filename.includes(`round_${String(index + 1).padStart(2, '0')}`);
    });

    return {
      round,
      roundNumber: index + 1,
      session: matchingSession,
      hasRaced: !!matchingSession,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton fallbackUrl="/">Back</BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-500/20 text-amber-400 uppercase">
                  Championship
                </span>
              </div>
              <Link
                href={`/championship/${champId}/standings`}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-amber-500/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Standings
              </Link>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              {data.name}
            </h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-zinc-500 block mb-1">Total Rounds</span>
                <span className="text-white font-medium">{data.rounds.length}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Drivers</span>
                <span className="text-white font-medium">{data.opponents.length}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Completed</span>
                <span className="text-white font-medium">{sessions.length}/{data.rounds.length}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Qualifying</span>
                <span className="text-white font-medium">{data.rules.qualifying} min</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rounds List */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-zinc-700">
            <h2 className="text-2xl font-bold text-white">Championship Rounds</h2>
          </div>

          <div className="divide-y divide-zinc-700">
            {roundsWithSessions.map(({ round, roundNumber, session, hasRaced }) => {
              const trackName = formatTrackName(round.track);
              const trackConfig = round.track.split('-').pop() || '';

              if (hasRaced && session) {
                return (
                  <Link
                    key={roundNumber}
                    href={`/race/${encodeURIComponent(session.filename)}`}
                    className="group block p-6 transition-all hover:bg-zinc-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0">
                          <div className="bg-amber-500/20 text-amber-400 rounded-lg px-4 py-2 text-sm font-bold min-w-[80px] text-center">
                            Round {roundNumber}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-semibold text-lg group-hover:text-amber-400 transition-colors">
                            {trackName}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                            <span className="font-mono">{trackConfig}</span>
                            <span>•</span>
                            <span>{round.laps} {round.laps === 1 ? 'lap' : 'laps'}</span>
                            {session.data.session_info.date && (
                              <>
                                <span>•</span>
                                <span className="font-mono">
                                  {new Date(session.data.session_info.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-green-400">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">Completed</span>
                        </div>
                        <svg className="w-5 h-5 text-zinc-500 group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              } else {
                return (
                  <div
                    key={roundNumber}
                    className="p-6 opacity-50 cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0">
                          <div className="bg-zinc-700/50 text-zinc-500 rounded-lg px-4 py-2 text-sm font-bold min-w-[80px] text-center">
                            Round {roundNumber}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-zinc-400 font-semibold text-lg">
                            {trackName}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
                            <span className="font-mono">{trackConfig}</span>
                            <span>•</span>
                            <span>{round.laps} {round.laps === 1 ? 'lap' : 'laps'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-medium">Not Raced</span>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
