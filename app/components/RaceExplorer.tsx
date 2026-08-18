'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RaceSession } from '../types/race';
import { CategorySection } from '../lib/category-view';
import CategoryRow from './CategoryRow';

interface RaceExplorerProps {
  quickRaces: RaceSession[];
  /** Categories already filled and ordered — see `championship-categories.ts`. */
  sections: CategorySection[];
}

type ViewMode = 'quick_race' | 'championship';

/**
 * The front page: a shelf of categories, one to a row.
 *
 * It used to list every championship at once, which was a wall of cards by the time
 * there were ten of them. A category is now the unit the page deals in, and the
 * championships inside it live on the category's own page.
 */
export default function RaceExplorer({ quickRaces, sections }: RaceExplorerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('championship');

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="w-full px-4 py-12 sm:px-6 lg:px-8 xl:px-12">
        {/* Toggle Buttons */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={() => setViewMode('championship')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              viewMode === 'championship'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            Championship
          </button>
          <button
            onClick={() => setViewMode('quick_race')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              viewMode === 'quick_race'
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            Quick Race
          </button>
          <Link
            href="/drivers"
            className="px-6 py-3 rounded-lg font-semibold transition-all bg-zinc-800 text-zinc-400 hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-500/30"
          >
            All-Time Standings
          </Link>
          <Link
            href="/presets"
            className="px-6 py-3 rounded-lg font-semibold transition-all bg-zinc-800 text-zinc-400 hover:bg-cyan-600 hover:text-white hover:shadow-lg hover:shadow-cyan-500/30"
          >
            Game Presets
          </Link>
        </div>

        {/* Quick Race View */}
        {viewMode === 'quick_race' && (
          <div className="grid gap-4 md:gap-6">
            {quickRaces.length === 0 ? (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-12 text-center">
                <p className="text-zinc-400 text-lg">No quick race sessions found</p>
              </div>
            ) : (
              quickRaces.map((session) => {
                const { session_info, driver_statistics } = session.data;
                const driverCount = Object.keys(driver_statistics).length;

                return (
                  <Link
                    key={session.filename}
                    href={`/race/${encodeURIComponent(session.filename)}`}
                    className="group block bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 transition-all hover:bg-zinc-800 hover:border-zinc-600 hover:shadow-lg hover:shadow-red-500/10"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors">
                          {session.trackDetails?.name || session_info.track}
                        </h2>
                        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                          {session.trackDetails?.city && session.trackDetails?.country && (
                            <>
                              <span>{session.trackDetails.city}, {session.trackDetails.country}</span>
                              <span>•</span>
                            </>
                          )}
                          {session.trackDetails?.length && (
                            <>
                              <span>{session.trackDetails.length}</span>
                              <span>•</span>
                            </>
                          )}
                          <span>{driverCount} {driverCount === 1 ? 'driver' : 'drivers'}</span>
                          {session_info.race_laps && (
                            <>
                              <span>•</span>
                              <span>{session_info.race_laps} {session_info.race_laps === 1 ? 'lap' : 'laps'}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-1">
                        {session_info.date && (
                          <>
                            <time className="text-zinc-400 text-sm font-mono">
                              {new Date(session_info.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </time>
                            <time className="text-zinc-500 text-xs font-mono">
                              {new Date(session_info.date).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* Championship View: the categories, one to a row. */}
        {viewMode === 'championship' && (
          <div className="grid gap-6">
            {sections.length === 0 ? (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-12 text-center">
                <p className="text-zinc-400 text-lg">No championships found</p>
              </div>
            ) : (
              sections.map(section => (
                <CategoryRow key={section.category.id} section={section} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
