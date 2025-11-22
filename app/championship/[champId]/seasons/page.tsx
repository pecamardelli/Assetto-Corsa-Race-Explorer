import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChampionship } from '../../../lib/race-data';
import BackButton from '../../../components/BackButton';

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
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton fallbackUrl={`/championship/${encodeURIComponent(decodedChampId)}`}>Back to Championship</BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 uppercase">
                Seasons
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              {data.name}
            </h1>
            <div className="flex gap-4 text-sm text-zinc-400">
              <span>{seasons.length} {seasons.length === 1 ? 'season' : 'seasons'}</span>
            </div>
          </div>
        </div>

        {/* Seasons Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {seasons.map((season) => {
            // Count race sessions only
            const completedRaces = season.sessions.filter(session => {
              const filename = session.filename.split('/').pop() || '';
              return filename.includes('session_race');
            }).length;

            // Create season ID from season name (e.g., "Season 01" -> "season_01")
            const seasonId = season.seasonName.toLowerCase().replace(' ', '_');

            return (
              <Link
                key={season.seasonName}
                href={`/championship/${encodeURIComponent(decodedChampId)}/season/${seasonId}`}
                className="group block bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 transition-all hover:bg-zinc-800 hover:border-green-600 hover:shadow-lg hover:shadow-green-500/10"
              >
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-green-400 transition-colors">
                    {season.seasonName}
                  </h2>
                  <div className="text-sm text-zinc-400">
                    Season {season.seasonNumber}
                  </div>
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
