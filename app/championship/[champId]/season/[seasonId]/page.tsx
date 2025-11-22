import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getChampionship } from '../../../../lib/race-data';
import { getTrackDetails } from '../../../../lib/track-data';
import BackButton from '../../../../components/BackButton';
import FlagIcon from '../../../../components/FlagIcon';

export default async function SeasonPage({ params }: { params: Promise<{ champId: string; seasonId: string }> }) {
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

  const { data, sessions } = season;

  // Count only race sessions (not practice or qualifying)
  const completedRaces = sessions.filter(session => {
    const filename = session.filename.split('/').pop() || '';
    return filename.includes('session_race');
  }).length;

  // Match rounds with sessions based on track name and session type
  const roundsWithSessions = data.rounds.map((round, index) => {
    // Match by track name (the full round.track includes config, e.g., "ks_brands_hatch-indy")
    const trackWithConfig = round.track; // e.g., "ks_brands_hatch-indy"

    // Parse track name and config for getTrackDetails
    const parts = trackWithConfig.split('-');
    const trackConfig = parts.length > 1 ? parts[parts.length - 1] : undefined;
    const baseTrackName = parts.length > 1 ? parts.slice(0, -1).join('-') : trackWithConfig;

    // Get track details
    const trackDetails = getTrackDetails(baseTrackName, trackConfig);

    // Find practice, qualifying, and race sessions for this round
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
      trackDetails,
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
          <BackButton fallbackUrl={`/championship/${encodeURIComponent(decodedChampId)}/seasons`}>Back to Seasons</BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 uppercase">
                  {season.seasonName}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/championship/${encodeURIComponent(decodedChampId)}/seasons`}
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-green-500/20 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  All Seasons
                </Link>
                <Link
                  href={`/championship/${encodeURIComponent(decodedChampId)}/standings`}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-amber-500/20 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Driver Standings
                </Link>
                <Link
                  href={`/championship/${encodeURIComponent(decodedChampId)}/constructors`}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/20 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Constructor Standings
                </Link>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              {data.name}
            </h1>
            <div className="text-xl text-green-400 mb-4">
              {season.seasonName}
            </div>

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
                <span className="text-white font-medium">{completedRaces}/{data.rounds.length}</span>
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
            {roundsWithSessions.map(({ round, roundNumber, trackDetails, practice, qualifying, race, hasAnySessions }) => {
              return (
                <div key={roundNumber} className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Track Info and Sessions */}
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-2">
                        {/* Round Number Badge */}
                        <div className={`rounded px-3 py-1 text-xs font-bold ${
                          hasAnySessions
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-zinc-700/50 text-zinc-500'
                        }`}>
                          R{roundNumber}
                        </div>

                        {/* Track Name */}
                        <div className={`font-semibold text-lg flex-1 ${
                          hasAnySessions ? 'text-white' : 'text-zinc-400'
                        }`}>
                          {trackDetails.name}
                        </div>
                      </div>

                      <div className={`flex items-center gap-3 mb-3 text-sm ${
                        hasAnySessions ? 'text-zinc-400' : 'text-zinc-500'
                      }`}>
                        {trackDetails.country && (
                          <div className="flex items-center gap-2">
                            <FlagIcon nation={trackDetails.country} />
                            <span>{trackDetails.city || trackDetails.country}</span>
                          </div>
                        )}
                        {trackDetails.length && (
                          <>
                            <span>•</span>
                            <span>{trackDetails.length}</span>
                          </>
                        )}
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
                            <>
                              <Link
                                href={`/race/${encodeURIComponent(race.filename)}`}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                                </svg>
                                Race
                              </Link>
                              <Link
                                href={`/fastest-lap/${encodeURIComponent(race.filename)}`}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Fastest Lap
                              </Link>
                            </>
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

                    {/* Track Preview Image */}
                    <div className="flex-shrink-0">
                      <Image
                        src={`/track-previews/${trackDetails.identifier}.png`}
                        alt={trackDetails.name}
                        width={200}
                        height={112}
                        className="rounded-lg"
                        unoptimized
                      />
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
