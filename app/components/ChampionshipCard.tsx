import Link from 'next/link';
import { Championship } from '../types/race';
import { Accent } from '../lib/category-accents';
import { ChampionshipStats } from '../lib/championship-stats';

/**
 * One championship, as a full-width row: what it is and who holds it on the left,
 * its photograph filling the right and fading into the card.
 *
 * Shown on a category's page. The front page is a shelf of categories now, so this
 * only ever appears once you have picked one.
 */
export default function ChampionshipCard({
  championship,
  stats,
  accent,
}: {
  championship: Championship;
  stats: ChampionshipStats;
  accent: Accent;
}) {
  const totalSeasons = championship.seasons.length;

  // Unique tracks across every season, so a round that recurs counts once.
  const allTracks = new Set<string>();
  championship.seasons.forEach(season => {
    season.data.rounds.forEach(round => allTracks.add(round.track));
  });

  const totalDrivers = championship.data.opponents.length;
  const totalRaces = championship.sessions.filter(session => {
    const sessionType = session.data.session_type || session.data.session_info.session_type;
    return sessionType === 'race';
  }).length;

  return (
    <Link
      href={`/championship/${encodeURIComponent(championship.id)}/seasons`}
      className={`group block overflow-hidden bg-zinc-800/50 border border-zinc-700 rounded-lg transition-all hover:bg-zinc-800 ${accent.card}`}
    >
      <div className="flex flex-col lg:flex-row">
        <div className="w-full p-6 lg:w-2/5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className={`text-3xl font-bold text-white mb-2 transition-colors ${accent.title}`}>
                {championship.data.name}
              </h3>
              <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                <span>{totalSeasons} {totalSeasons === 1 ? 'season' : 'seasons'}</span>
                <span>•</span>
                <span>{allTracks.size} {allTracks.size === 1 ? 'track' : 'tracks'}</span>
                <span>•</span>
                <span>{totalDrivers} {totalDrivers === 1 ? 'driver' : 'drivers'}</span>
                <span>•</span>
                <span>{totalRaces} {totalRaces === 1 ? 'race' : 'races'}</span>
              </div>
            </div>
            <div className={`text-zinc-500 transition-colors ${accent.title}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 rounded-lg px-5 py-6 flex items-center gap-4">
              {stats.currentChampionPortrait ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={stats.currentChampionPortrait}
                  alt=""
                  aria-hidden="true"
                  className="h-20 w-20 shrink-0 rounded-full border border-zinc-700 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-2xl font-semibold text-zinc-500">
                  {stats.currentChampion.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-zinc-500 text-xs mb-1">Current Champion</div>
                <div className="text-white font-semibold truncate">{stats.currentChampion}</div>
              </div>
            </div>
            <div className="bg-zinc-900/50 rounded-lg px-5 py-6 flex items-center gap-4">
              {stats.currentConstructorBadge ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={stats.currentConstructorBadge}
                  alt=""
                  aria-hidden="true"
                  className="h-20 w-20 shrink-0 object-contain"
                />
              ) : (
                <div className="h-20 w-20 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-zinc-500 text-xs mb-1">Constructor Champion</div>
                <div className="text-white font-semibold truncate">
                  {stats.currentConstructorChampion}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The photo fills this column; the column stays even when there's no banner. */}
        <div
          className={`relative w-full lg:w-3/5 ${
            championship.bannerUrl ? 'min-h-40 lg:min-h-0' : ''
          }`}
        >
          {championship.bannerUrl && (
            /* Masked rather than covered by a tinted overlay, so the photo
               fades into the card's own background — including on hover —
               and the seam with the text column disappears. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={championship.bannerUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_40%)] [mask-image:linear-gradient(to_right,transparent_0%,black_40%)]"
            />
          )}
        </div>
      </div>
    </Link>
  );
}
