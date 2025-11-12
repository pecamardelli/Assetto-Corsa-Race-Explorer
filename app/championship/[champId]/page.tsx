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

  // Match rounds with sessions based on track name and session type
  const roundsWithSessions = data.rounds.map((round, index) => {
    // Match by track name (the full round.track includes config, e.g., "ks_brands_hatch-indy")
    const trackWithConfig = round.track; // e.g., "ks_brands_hatch-indy"

    // Find practice, qualifying, and race sessions for this round
    // Filenames are like: stats_ks_brands_hatch-indy_session_practice_20251112_022523.json
    const practiceSessions = sessions.filter(session => {
      const filename = session.filename.split('/').pop() || '';
      return filename.includes(trackWithConfig) && filename.includes('session_practice');
    });

    const qualifyingSessions = sessions.filter(session => {
      const filename = session.filename.split('/').pop() || '';
      return filename.includes(trackWithConfig) && filename.includes('session_qualifying');
    });

    const raceSessions = sessions.filter(session => {
      const filename = session.filename.split('/').pop() || '';
      return filename.includes(trackWithConfig) && filename.includes('session_race');
    });

    return {
      round,
      roundNumber: index + 1,
      practice: practiceSessions.length > 0 ? practiceSessions[0] : null,
      qualifying: qualifyingSessions.length > 0 ? qualifyingSessions[0] : null,
      race: raceSessions.length > 0 ? raceSessions[0] : null,
      hasAnySessions: practiceSessions.length > 0 || qualifyingSessions.length > 0 || raceSessions.length > 0,
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
            {roundsWithSessions.map(({ round, roundNumber, practice, qualifying, race, hasAnySessions }) => {
              const trackName = formatTrackName(round.track);
              const trackConfig = round.track.split('-').pop() || '';

              return (
                <div key={roundNumber} className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Round Number */}
                    <div className="flex-shrink-0">
                      <div className={`rounded-lg px-4 py-2 text-sm font-bold min-w-[80px] text-center ${
                        hasAnySessions
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-zinc-700/50 text-zinc-500'
                      }`}>
                        Round {roundNumber}
                      </div>
                    </div>

                    {/* Track Info and Sessions */}
                    <div className="flex-1">
                      <div className={`font-semibold text-lg mb-2 ${
                        hasAnySessions ? 'text-white' : 'text-zinc-400'
                      }`}>
                        {trackName}
                      </div>
                      <div className={`flex items-center gap-3 mb-3 text-sm ${
                        hasAnySessions ? 'text-zinc-400' : 'text-zinc-500'
                      }`}>
                        <span className="font-mono">{trackConfig}</span>
                        <span>•</span>
                        <span>{round.laps} {round.laps === 1 ? 'lap' : 'laps'}</span>
                      </div>

                      {/* Session Links */}
                      {hasAnySessions ? (
                        <div className="flex flex-wrap gap-2">
                          {practice && (
                            <Link
                              href={`/race/${encodeURIComponent(practice.filename)}`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Practice
                            </Link>
                          )}
                          {qualifying && (
                            <Link
                              href={`/race/${encodeURIComponent(qualifying.filename)}`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Qualifying
                            </Link>
                          )}
                          {race && (
                            <Link
                              href={`/race/${encodeURIComponent(race.filename)}`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                              </svg>
                              Race
                            </Link>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-zinc-500 text-sm">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">Not Started</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
