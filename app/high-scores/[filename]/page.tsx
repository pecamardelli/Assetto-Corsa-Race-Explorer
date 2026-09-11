import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRaceSession } from '../../lib/race-data';
import { getTrackHighScores } from '../../lib/track-high-scores';
import { formatDuration, safeNumber, safeString } from '../../lib/format-utils';
import { getCarDetails, getCarPreviewUrl, getCarBadgeUrl } from '../../lib/car-data';
import { getTrackDetails, getTrackPreviewUrl } from '../../lib/track-data';
import BackButton from '../../components/BackButton';
import FlagIcon from '../../components/FlagIcon';
import DriverPortrait from '../../components/DriverPortrait';
import { resolveDriverPortraits } from '../../lib/driver-assets';

/**
 * The road's high-score table, reached from a Test Drive race in place of the
 * fastest-lap standings a circuit round links to.
 *
 * Ranked like the all-time table of a road series: every run ever posted down this
 * road, one row per driver per race, best score at the top. The race the table was
 * opened from is picked out in it.
 */
export default async function TrackHighScoresPage({ params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const decodedFilename = decodeURIComponent(filename);
  const session = await getRaceSession(decodedFilename);

  if (!session) {
    notFound();
  }

  const { session_info } = session.data;
  const trackDetails = getTrackDetails(session_info.track, session_info.track_config);
  const trackPreview = getTrackPreviewUrl(session_info.track, session_info.track_config);

  const highScores = await getTrackHighScores(session_info.track, session_info.track_config);
  const portraits = await resolveDriverPortraits(
    [...new Set(highScores.map(entry => entry.name))],
    session.championship
  );

  const bestScore = highScores.length > 0 ? highScores[0].score : 0;
  const runsOnFile = new Set(highScores.map(entry => entry.filename)).size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Header. The track's preview photo is the section's own background, running
          the full width of the window and fading in over the first 40% of it. */}
      <section className="relative isolate overflow-hidden border-b border-zinc-700">
        {trackPreview && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={trackPreview}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 h-full w-full object-cover [-webkit-mask-image:linear-gradient(to_right,transparent_40%,black_85%)] [mask-image:linear-gradient(to_right,transparent_40%,black_85%)]"
          />
        )}
        <div className="w-full px-4 pt-4 pb-8 sm:px-6 lg:px-8 xl:px-12">
          <BackButton fallbackUrl={`/race/${encodeURIComponent(decodedFilename)}`}>Back</BackButton>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400 uppercase">
              High Scores
            </span>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-red-500/20 text-red-400 uppercase">
              Test Drive
            </span>
            {session.championship && (
              <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-500/20 text-amber-400">
                {session.championship}
              </span>
            )}
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
            {trackDetails.name}
          </h1>
          {trackDetails.city && trackDetails.country && (
            <p className="text-zinc-400 mb-1">
              {trackDetails.city}, {trackDetails.country}
              {trackDetails.length && <> • {trackDetails.length}</>}
            </p>
          )}
          <p className="text-zinc-400 mb-4">
            Every run ever posted down this road, ranked by score
          </p>

          <div className="grid max-w-3xl grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-zinc-500 block mb-1">Runs</span>
              <span className="text-white font-medium">{highScores.length}</span>
            </div>
            <div>
              <span className="text-zinc-500 block mb-1">Races</span>
              <span className="text-white font-medium">{runsOnFile}</span>
            </div>
            {bestScore > 0 && (
              <div>
                <span className="text-zinc-500 block mb-1">Best Score</span>
                <span className="text-blue-400 font-medium font-mono">{bestScore.toLocaleString()}</span>
              </div>
            )}
            {session_info.track_length_km && (
              <div>
                <span className="text-zinc-500 block mb-1">Track Length</span>
                <span className="text-white font-medium">{session_info.track_length_km.toFixed(2)} km</span>
              </div>
            )}
          </div>

          {/* Link back to the race this table was opened from */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={`/race/${encodeURIComponent(decodedFilename)}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-semibold transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              View Race Results
            </Link>
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {highScores.length === 0 ? (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-12 text-center">
            <p className="text-zinc-400 text-lg">No scores posted on this road yet</p>
            <p className="text-zinc-500 text-sm mt-2">A run appears here once a Test Drive race on it has been filed.</p>
          </div>
        ) : (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-900/50 border-b border-zinc-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      Nation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Car
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Series
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Raced
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                      Avg Speed
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                      Crashes
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {highScores.map((entry, index) => {
                    const isTop = index === 0;
                    const isTop3 = index < 3;
                    const isThisRace = entry.filename === decodedFilename;
                    const raced = entry.date
                      ? new Date(entry.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '-';
                    const car = getCarDetails(entry.car);
                    const carPreview = getCarPreviewUrl(entry.car);
                    const carBadge = getCarBadgeUrl(entry.car);

                    return (
                      <tr
                        key={`${entry.filename}-${entry.name}`}
                        className={`hover:bg-zinc-800/80 transition-colors ${
                          isThisRace ? 'bg-blue-500/10' :
                          isTop ? 'bg-amber-500/5' :
                          isTop3 ? 'bg-zinc-700/20' : ''
                        }`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                            isTop ? 'bg-amber-500 text-zinc-900' :
                            index === 1 ? 'bg-zinc-400 text-zinc-900' :
                            index === 2 ? 'bg-amber-700 text-white' :
                            'bg-zinc-700 text-white'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center hidden md:table-cell">
                          <div className="flex justify-center">
                            <div className="w-12 h-12 overflow-hidden rounded-full border-2 border-zinc-700">
                              <DriverPortrait driverName={entry.name} size={48} src={portraits.get(entry.name) ?? null} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/driver/${encodeURIComponent(entry.name)}`}
                            className="block hover:text-amber-400 transition-colors"
                          >
                            <div className="text-white font-medium">{entry.name}</div>
                            <div className="text-xs text-zinc-500 mt-1">
                              {entry.distanceKm > 0 ? `${entry.distanceKm.toFixed(1)} km covered` : '—'}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-center hidden sm:table-cell">
                          {entry.nation && <FlagIcon nation={entry.nation} />}
                        </td>
                        <td className="px-4 py-4">
                          {/* The car: its brand's badge, the make and the model, then its picture */}
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                              {carBadge ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={carBadge} alt={car.brand} className="max-h-full max-w-full object-contain" />
                              ) : (
                                <div className="w-10 h-10 rounded-full border border-dashed border-zinc-700" />
                              )}
                            </div>
                            <div className="w-36 shrink-0">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{car.brand}</div>
                              <div className="text-sm text-zinc-200 truncate">{car.model}</div>
                            </div>
                            <div className="w-20 h-12 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/60">
                              {carPreview ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={carPreview} alt={car.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-600">No preview</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Link
                            href={`/championship/${encodeURIComponent(entry.championshipId)}`}
                            className="text-zinc-300 hover:text-amber-400 transition-colors"
                          >
                            {entry.championship}
                          </Link>
                          <div className="text-xs text-zinc-500 mt-1">{entry.seasonName}</div>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <Link
                            href={`/race/${encodeURIComponent(entry.filename)}`}
                            className="text-zinc-400 hover:text-amber-400 transition-colors"
                          >
                            {raced}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-mono text-zinc-300">{formatDuration(entry.time)}</span>
                        </td>
                        <td className="px-4 py-4 text-center hidden sm:table-cell">
                          <span className="font-mono text-zinc-300">
                            {entry.averageSpeedKmh > 0 ? `${entry.averageSpeedKmh.toFixed(0)} km/h` : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          <div className={`font-medium ${
                            entry.crashes === 0 ? 'text-green-400' :
                            entry.crashes > 20 ? 'text-red-400' :
                            'text-amber-400'
                          }`}>
                            {entry.crashes}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="font-bold text-lg text-blue-400">
                            {safeNumber(entry.score, 0).toLocaleString()}
                          </div>
                          {isThisRace && (
                            <div className="text-[10px] uppercase tracking-wider text-blue-300 mt-1">
                              This race
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-zinc-500">
          Test Drive runs only: {safeString(session_info.scoring_formula, 'score = distance × average speed × 10, less 3% per crash')}
        </p>
      </div>
    </div>
  );
}
