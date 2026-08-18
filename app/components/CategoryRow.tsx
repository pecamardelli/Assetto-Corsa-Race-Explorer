import Link from 'next/link';
import { CategorySection, raceCount } from '../lib/category-view';
import { accentFor } from '../lib/category-accents';

/**
 * One category, as a full-width row.
 *
 * Deliberately the same shape as a championship card — text column on the left, the
 * photograph filling the right and masked into the background with the same
 * gradient — so the front page and a category's page read as the same object at two
 * depths, rather than as two different designs.
 *
 * The photo is borrowed from a championship inside the category unless the category
 * declares one of its own; see `bannerUrl` on CategorySection.
 */
export default function CategoryRow({ section }: { section: CategorySection }) {
  const { category, championships, bannerUrl } = section;
  const accent = accentFor(category.accent);

  const seasons = championships.reduce((total, entry) => total + entry.seasons.length, 0);
  const races = championships.reduce((total, entry) => total + raceCount(entry), 0);

  return (
    <Link
      href={`/category/${encodeURIComponent(category.id)}`}
      className={`group block overflow-hidden bg-zinc-800/50 border border-zinc-700 rounded-lg transition-all hover:bg-zinc-800 ${accent.card}`}
    >
      <div className="flex flex-col lg:flex-row">
        <div className="w-full p-6 lg:w-2/5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2 className={`text-3xl font-bold text-white transition-colors ${accent.title}`}>
              {category.name}
            </h2>
            <div className={`shrink-0 text-zinc-500 transition-colors ${accent.title}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-zinc-400 mb-4">{category.description}</p>

          <div className="flex flex-wrap gap-4 text-sm text-zinc-400 mb-4">
            <span className={`font-semibold ${accent.count}`}>
              {championships.length}{' '}
              {championships.length === 1 ? 'championship' : 'championships'}
            </span>
            <span>•</span>
            <span>{seasons} {seasons === 1 ? 'season' : 'seasons'}</span>
            <span>•</span>
            <span>{races} {races === 1 ? 'race' : 'races'}</span>
          </div>

          {/* What is actually on the shelf, so the row says something specific
              rather than only counting. */}
          <div className="flex flex-wrap gap-2">
            {championships.map(championship => (
              <span
                key={championship.id}
                className="rounded bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300"
              >
                {championship.data.name}
              </span>
            ))}
          </div>
        </div>

        <div className={`relative w-full lg:w-3/5 ${bannerUrl ? 'min-h-40 lg:min-h-0' : ''}`}>
          {bannerUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={bannerUrl}
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
