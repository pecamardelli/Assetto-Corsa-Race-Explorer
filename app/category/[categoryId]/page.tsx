import { notFound } from 'next/navigation';
import { getChampionships } from '../../lib/race-data';
import { getCategorySection } from '../../lib/championship-categories';
import { getChampionshipStats, NO_STATS } from '../../lib/championship-stats';
import { raceCount } from '../../lib/category-view';
import { accentFor } from '../../lib/category-accents';
import BackButton from '../../components/BackButton';
import ChampionshipCard from '../../components/ChampionshipCard';

/**
 * One category's page: what the shelf holds.
 *
 * The header repeats the row that was clicked to get here — same photograph, same
 * gradient — so arriving feels like the card opened rather than like a different
 * page loaded.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const decodedId = decodeURIComponent(categoryId);

  const championships = await getChampionships();
  const section = await getCategorySection(decodedId, championships);

  if (!section) notFound();

  const { category, championships: held, bannerUrl } = section;
  const accent = accentFor(category.accent);
  const stats = await getChampionshipStats(held);

  const seasons = held.reduce((total, entry) => total + entry.seasons.length, 0);
  const races = held.reduce((total, entry) => total + raceCount(entry), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* The banner runs the full width of the window and fades in over the first
          40% of it, the same masking the rows and cards use. */}
      <section className="relative isolate overflow-hidden border-b border-zinc-700">
        {bannerUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={bannerUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 h-full w-full object-cover [-webkit-mask-image:linear-gradient(to_right,transparent_40%,black_85%)] [mask-image:linear-gradient(to_right,transparent_40%,black_85%)]"
          />
        )}
        <div className="w-full px-4 pt-4 pb-8 sm:px-6 lg:px-8 xl:px-12">
          <BackButton fallbackUrl="/">Back to Categories</BackButton>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span
              className={`text-xs font-semibold px-2 py-1 rounded uppercase ${accent.chip}`}
            >
              Category
            </span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">{category.name}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-300 drop-shadow mb-3">
            {category.description}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>
              {held.length} {held.length === 1 ? 'championship' : 'championships'}
            </span>
            <span>•</span>
            <span>{seasons} {seasons === 1 ? 'season' : 'seasons'}</span>
            <span>•</span>
            <span>{races} {races === 1 ? 'race' : 'races'}</span>
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid gap-6">
          {held.map(championship => (
            <ChampionshipCard
              key={championship.id}
              championship={championship}
              accent={accent}
              stats={stats.get(championship.id) ?? NO_STATS}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
