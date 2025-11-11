'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RaceSession, Championship } from '../types/race';
import { formatTrackName } from '../lib/format-utils';

interface RaceExplorerProps {
  quickRaces: RaceSession[];
  championships: Championship[];
}

type ViewMode = 'quick_race' | 'championship';

export default function RaceExplorer({ quickRaces, championships }: RaceExplorerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('quick_race');

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            Race Explorer
          </h1>
          <p className="text-zinc-400 text-lg">
            Assetto Corsa race results and statistics
          </p>
        </div>

        {/* Toggle Buttons */}
        <div className="mb-8 flex flex-wrap gap-4">
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
          <Link
            href="/drivers"
            className="px-6 py-3 rounded-lg font-semibold transition-all bg-zinc-800 text-zinc-400 hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-500/30"
          >
            All-Time Standings
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
                          {formatTrackName(session_info.track)}
                        </h2>
                        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                          {session_info.track_config && (
                            <>
                              <span className="flex items-center gap-1">
                                <span className="font-mono">{session_info.track_config}</span>
                              </span>
                              <span>•</span>
                            </>
                          )}
                          <span>{driverCount} {driverCount === 1 ? 'driver' : 'drivers'}</span>
                          {session_info.track_length_km && (
                            <>
                              <span>•</span>
                              <span>{session_info.track_length_km.toFixed(2)} km</span>
                            </>
                          )}
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

        {/* Championship View */}
        {viewMode === 'championship' && (
          <div className="grid gap-6">
            {championships.length === 0 ? (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-12 text-center">
                <p className="text-zinc-400 text-lg">No championships found</p>
              </div>
            ) : (
              championships.map((championship) => (
                <Link
                  key={championship.id}
                  href={`/championship/${championship.id}`}
                  className="group block bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 transition-all hover:bg-zinc-800 hover:border-amber-600 hover:shadow-lg hover:shadow-amber-500/10"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h2 className="text-3xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                        {championship.data.name}
                      </h2>
                      <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                        <span>{championship.data.rounds.length} rounds</span>
                        <span>•</span>
                        <span>{championship.data.opponents.length} drivers</span>
                        <span>•</span>
                        <span>{championship.sessions.length} completed</span>
                      </div>
                    </div>
                    <div className="text-zinc-500 group-hover:text-amber-400 transition-colors">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Championship Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-900/50 rounded-lg p-4">
                      <div className="text-zinc-500 text-xs mb-1">Qualifying</div>
                      <div className="text-white font-semibold">{championship.data.rules.qualifying} min</div>
                    </div>
                    <div className="bg-zinc-900/50 rounded-lg p-4">
                      <div className="text-zinc-500 text-xs mb-1">Practice</div>
                      <div className="text-white font-semibold">{championship.data.rules.practice} min</div>
                    </div>
                    <div className="bg-zinc-900/50 rounded-lg p-4">
                      <div className="text-zinc-500 text-xs mb-1">Max Cars</div>
                      <div className="text-white font-semibold">{championship.data.maxCars}</div>
                    </div>
                    <div className="bg-zinc-900/50 rounded-lg p-4">
                      <div className="text-zinc-500 text-xs mb-1">Penalties</div>
                      <div className="text-white font-semibold">{championship.data.rules.penalties ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
