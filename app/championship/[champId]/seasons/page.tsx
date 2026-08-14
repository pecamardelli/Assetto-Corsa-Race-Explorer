import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getChampionship } from '../../../lib/race-data';
import { calculateStandings } from '../../../lib/standings';
import { Championship, Season } from '../../../types/race';
import BackButton from '../../../components/BackButton';

// Helper function to calculate the champion for a specific season
function getSeasonChampion(season: Season): string | null {
  if (season.sessions.length === 0) return null;

  // Create a temporary Championship object for this season only
  const seasonChampionship: Championship = {
    id: 'temp',
    data: season.data,
    folderName: 'temp',
    sessions: season.sessions,
    seasons: [season],
  };

  const standings = calculateStandings(seasonChampionship);
  return standings.length > 0 ? standings[0].name : null;
}

export default async function SeasonsPage({ params }: { params: Promise<{ champId: string }> }) {
  const { champId } = await params;
  const decodedChampId = decodeURIComponent(champId);
  const championship = await getChampionship(decodedChampId);

  if (!championship) {
    notFound();
  }

  const { data, seasons } = championship;

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
        <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
          <BackButton fallbackUrl={`/championship/${encodeURIComponent(decodedChampId)}`}>Back to Championship</BackButton>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 uppercase">
              Seasons
            </span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
            {data.name}
          </h1>
          <div className="flex gap-4 text-sm text-zinc-400">
            <span>{seasons.length} {seasons.length === 1 ? 'season' : 'seasons'}</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={`/championship/${encodeURIComponent(decodedChampId)}/all-time`}
              className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/20 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              All-Time Drivers
            </Link>
            <Link
              href={`/championship/${encodeURIComponent(decodedChampId)}/all-time-constructors`}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/20 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              All-Time Constructors
            </Link>
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {/* Seasons Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {seasons.map((season) => {
            // Count race sessions only
            const completedRaces = season.sessions.filter(session => {
              const sessionType = session.data.session_type || session.data.session_info.session_type;
      return sessionType === 'race';
            }).length;

            // Check if season is completed
            const isCompleted = completedRaces === season.data.rounds.length;

            // Get champion name if season is completed
            const champion = isCompleted ? getSeasonChampion(season) : null;

            // Create season ID from season name (e.g., "Season 01" -> "season_01")
            const seasonId = season.seasonName.toLowerCase().replace(' ', '_');

            return (
              <Link
                key={season.seasonName}
                href={`/championship/${encodeURIComponent(decodedChampId)}/season/${seasonId}`}
                className="group block bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 transition-all hover:bg-zinc-800 hover:border-green-600 hover:shadow-lg hover:shadow-green-500/10"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 mb-4">
                    <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-green-400 transition-colors">
                      {season.seasonName}
                    </h2>
                    <div className="text-sm text-zinc-400">
                      Season {season.seasonNumber}
                    </div>
                  </div>

                  {isCompleted && champion && (
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                      <Image
                        src="/trophy.svg"
                        alt="Champion"
                        width={24}
                        height={24}
                        className="drop-shadow-lg"
                      />
                      <div className="text-sm">
                        <div className="text-yellow-500 font-semibold">{champion}</div>
                        <div className="text-yellow-400/70 text-xs">Champion</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Rounds */}
                  <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded">
                    <div className="text-xs text-zinc-500 uppercase">Rounds</div>
                    <div className="text-white font-semibold">{season.data.rounds.length}</div>
                  </div>

                  {/* Completed Races */}
                  <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded">
                    <div className="text-xs text-zinc-500 uppercase">Completed</div>
                    <div className="text-white font-semibold">
                      {completedRaces} / {season.data.rounds.length}
                    </div>
                  </div>

                  {/* Drivers */}
                  <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded">
                    <div className="text-xs text-zinc-500 uppercase">Drivers</div>
                    <div className="text-white font-semibold">{season.data.opponents.length}</div>
                  </div>

                  {/* Qualifying */}
                  <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded">
                    <div className="text-xs text-zinc-500 uppercase">Qualifying</div>
                    <div className="text-white font-semibold">{season.data.rules.qualifying} min</div>
                  </div>
                </div>

                <div className="mt-4 text-sm text-green-400 group-hover:text-green-300 transition-colors flex items-center gap-2">
                  View Season Details
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Empty State */}
        {seasons.length === 0 && (
          <div className="text-center py-12">
            <div className="text-zinc-400 text-lg mb-2">No seasons found</div>
            <div className="text-zinc-500 text-sm">
              This championship doesn't have any seasons yet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
