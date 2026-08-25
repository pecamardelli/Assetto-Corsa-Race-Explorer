import type { RaceIniSpec } from './race-ini';

/**
 * The grid manifest Il Direttore (apps/lua/Direttore) reads at load from
 * cfg/direttore_grid.json, next to race.ini.
 *
 * race.ini never carries an AI_LEVEL above 100 — AC does not document one — so a
 * driver's rating above 100 travels here instead. Direttore treats it as that
 * driver's ceiling on a full-speed track (140 = level 1.40, capped at 150 on its
 * side), scales the excess by track fastness (nothing at Monaco) and raises the
 * driver toward it as the car learns the track. Ratings of 100 or less change
 * nothing in Direttore: those drivers run on their race.ini level.
 */
export function buildDirettoreManifest(spec: RaceIniSpec): string {
  const drivers = [spec.player, ...spec.opponents].map(entry => ({
    name: entry.name,
    rating: entry.aiSkill,
    aggression: entry.aiAggression,
  }));

  return JSON.stringify({ drivers }, null, 2) + '\n';
}
