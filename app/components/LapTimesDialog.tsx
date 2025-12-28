'use client';

import { useState } from 'react';
import { formatLapTime } from '../lib/format-utils';

interface LapTimesDialogProps {
  driverName: string;
  lapTimes: number[];
  totalTime: string;
}

export default function LapTimesDialog({ driverName, lapTimes, totalTime }: LapTimesDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!lapTimes || lapTimes.length === 0) {
    return <span className="text-white font-mono">{totalTime || '-'}</span>;
  }

  const bestLapTime = Math.min(...lapTimes);
  const averageLapTime = lapTimes.reduce((sum, time) => sum + time, 0) / lapTimes.length;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-white font-mono hover:text-amber-400 transition-colors cursor-pointer underline decoration-dotted"
      >
        {totalTime || '-'}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-zinc-800 border border-zinc-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-bold text-white">{driverName}</h2>
                <span className="text-zinc-500 text-sm">Lap Times Breakdown</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Lap Times List */}
            <div className="overflow-y-auto max-h-96">
              <table className="w-full">
                <thead className="bg-zinc-900/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Lap
                    </th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Delta
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {lapTimes.map((lapTime, index) => {
                    const isBestLap = lapTime === bestLapTime;
                    const delta = index > 0 ? lapTime - lapTimes[index - 1] : 0;

                    return (
                      <tr
                        key={index}
                        className={`hover:bg-zinc-700/50 ${isBestLap ? 'bg-green-500/10' : ''}`}
                      >
                        <td className="px-3 py-1">
                          <span className={`font-medium text-sm ${isBestLap ? 'text-green-400' : 'text-white'}`}>
                            {index + 1}
                            {isBestLap && (
                              <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                                Best
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-1 text-right">
                          <span className={`font-mono font-semibold text-sm ${isBestLap ? 'text-green-400' : 'text-white'}`}>
                            {formatLapTime(lapTime)}
                          </span>
                        </td>
                        <td className="px-3 py-1 text-right">
                          {index === 0 ? (
                            <span className="text-zinc-600 text-sm">-</span>
                          ) : (
                            <span className={`font-mono text-sm ${
                              delta < 0 ? 'text-green-400' : delta > 0 ? 'text-red-400' : 'text-zinc-400'
                            }`}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(3)}s
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-zinc-700 bg-zinc-900/50">
              <div className="text-center">
                <span className="text-zinc-500 text-sm">Total Time: </span>
                <span className="text-white font-mono font-semibold">{totalTime}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
