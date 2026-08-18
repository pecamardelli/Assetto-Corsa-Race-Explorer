export interface CrashData {
  total_crash_intensity: number;
  crash_intensities_g: number[];
  average_crash_g: number;
  worst_crash_g: number;
  total_crashes: number;
}

export interface ScoreBreakdown {
  base_score: number;
  crash_penalty_percent: number;
  crash_factor: number;
  position_factor: number;
  speed_factor: number;
}

export interface DriverStatistics {
  average_speed_mph?: number;
  distance_covered_miles?: number;
  crashes?: CrashData;
  best_lap?: number;
  total_time_formatted?: string;
  average_speed_kmh?: number;
  max_speed_kmh?: number;
  max_speed_mph?: number;
  score_breakdown?: ScoreBreakdown;
  times_overtaken?: number;
  lap_times?: number[];
  distance_covered_km?: number;
  laps_completed?: number;
  partial_lap_completion?: number;
  car_name?: string;
  total_time_seconds?: number;
  total_score?: number;
  average_lap?: number;
  overtakes_made?: number;
  net_positions_gained?: number;
  position?: number;
  nation?: string;
  car?: string;
  retired?: boolean;
}

export interface CrashPenaltyConfig {
  penalty_percent_per_g: number;
  max_penalty_per_crash_g: number;
}

export interface SessionInfo {
  track_length_km?: number;
  total_cars?: number;
  track_config?: string;
  best_total_time_seconds?: number;
  date: string;
  track_length_miles?: number;
  crash_penalty_config?: CrashPenaltyConfig;
  race_laps?: number;
  track: string;
  session_duration_seconds?: number;
  track_length_meters?: number;
  session_duration_formatted?: string;
  scoring_formula?: string;
  session_type?: 'practice' | 'qualifying' | 'race';
  // False when the driver quit before the session ran its course, so the stats are
  // a partial record. Absent on sessions recorded before this was tracked.
  finished?: boolean;
  // The round this session was run for, stamped when the result is filed. Absent on
  // results filed before rounds were recorded.
  round?: number;
  // Set only when the round was too big for its track and had to be run in batches,
  // in which case this names the batch. Every group of a round shares its `round`,
  // and the standings classify them as one race.
  group?: string;
  // How many batches the round was divided into when this one ran, so a round can
  // be told from the outside whether every batch of it is in yet. Absent on results
  // filed before the count was recorded, where two batches are taken to be all of
  // them. Never trust it to be the number of results on file: a batch raced twice
  // leaves two.
  group_count?: number;
  // The groups a merged round was assembled from. Only ever set on the synthetic
  // session the standings build; never written to disk.
  groups?: string[];
}

export interface CarData {
  name?: string;
  brand?: string;
  class?: string;
  specs?: Record<string, any>;
  [key: string]: any;
}

export interface RaceData {
  session_info: SessionInfo;
  driver_statistics: Record<string, DriverStatistics>;
  cars?: Record<string, CarData>;
  session_type?: 'practice' | 'qualifying' | 'race';
}

export interface RaceSession {
  filename: string;
  data: RaceData;
  raceType?: string;
  championship?: string;
  trackDetails?: {
    identifier: string;
    name: string;
    country: string;
    city: string;
    length: string;
  };
}

export interface ChampionshipRules {
  practice: number;
  qualifying: number;
  points: number[];
  penalties: boolean;
  jumpstart: number;
}

export interface ChampionshipOpponent {
  name: string;
  nation: string;
  car: string;
  skin: string;
  ballast: number;
  restrictor: number;
  // True for a car that shares the road without contesting the championship: the
  // traffic a road series is driven through. It starts, it gets in the way, and the
  // standings look straight past it — see `app/lib/traffic.ts`.
  traffic?: boolean;
}

export interface ChampionshipRound {
  track: string;
  laps: number;
  weather: number;
  surface: number;
}

export interface ChampionshipData {
  name: string;
  rules: ChampionshipRules;
  opponents: ChampionshipOpponent[];
  rounds: ChampionshipRound[];
  maxCars: number;
  changedByCm: boolean;
}

export interface Season {
  seasonName: string;
  seasonNumber: number;
  data: ChampionshipData;
  sessions: RaceSession[];
}

export interface Championship {
  id: string;
  data: ChampionshipData;
  folderName: string;
  sessions: RaceSession[];
  seasons: Season[];
  // Set only when a banner.webp has been dropped into the championship's folder.
  bannerUrl?: string;
  // The category it races under, or undefined when categories.json does not place
  // it — in which case the front page files it under "Unsorted".
  categoryId?: string;
}

/**
 * A shelf on the front page: the kind of racing a championship is, rather than the
 * era or the machinery. Defined in app/data/championship/categories.json, which is
 * also what decides the order they appear in and which championships they hold.
 */
export interface ChampionshipCategory {
  id: string;
  name: string;
  /** One line, shown on the category card under the name. */
  description: string;
  /** Tailwind colour stem the card and its headings are tinted with, e.g. "amber". */
  accent: string;
  /**
   * A banner under public/, when the category has one of its own. Without it the
   * category borrows the banner of the first championship in it that has one, so a
   * new category looks finished without needing new artwork.
   */
  banner?: string;
  /** Championship folder names, in the order they should be listed. */
  championships: string[];
}

export interface DriverStanding {
  name: string;
  points: number;
  customPoints: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  racesCompleted: number;
  car: string;
  nation: string;
}
