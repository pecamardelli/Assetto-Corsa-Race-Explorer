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
}

export interface RaceData {
  session_info: SessionInfo;
  driver_statistics: Record<string, DriverStatistics>;
}

export interface RaceSession {
  filename: string;
  data: RaceData;
  raceType?: string;
  championship?: string;
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

export interface Championship {
  id: string;
  data: ChampionshipData;
  folderName: string;
  sessions: RaceSession[];
}
