// Client-safe formatting utilities
export function formatTrackName(trackId: string | undefined): string {
  if (!trackId) return 'Unknown Track';

  return trackId
    .replace('ks_', '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatLapTime(seconds: number | undefined | null): string {
  if (seconds == null || isNaN(seconds) || seconds === 0) return '--:--.---';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, '0')}`;
}

export function formatCarName(carId: string | undefined): string {
  if (!carId) return 'N/A';

  return carId
    .replace(/^(ks_|gd_|rz_|exmods_av_)/, '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getSortedDrivers(driverStats: Record<string, any>) {
  if (!driverStats) return [];

  const drivers = Object.entries(driverStats)
    .map(([name, stats]) => ({
      name,
      position: stats?.position ?? 999,
      ...stats
    }));

  // Separate finished drivers from DNFs
  const finishedDrivers = drivers.filter(d => !d.retired);
  const dnfDrivers = drivers.filter(d => d.retired);

  // Sort finished drivers by position
  finishedDrivers.sort((a, b) => a.position - b.position);

  // Sort DNF drivers by score (descending), then by position as tiebreaker
  dnfDrivers.sort((a, b) => {
    const scoreA = safeNumber(a.total_score, 0);
    const scoreB = safeNumber(b.total_score, 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.position - b.position;
  });

  // Return finished drivers first, then DNFs
  return [...finishedDrivers, ...dnfDrivers];
}

export function safeNumber(value: any, defaultValue: number = 0): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export function safeString(value: any, defaultValue: string = ''): string {
  return value?.toString() ?? defaultValue;
}

/** Hours, minutes and seconds of racing: "1:07:23" over an hour, "47:23" under it. */
export function formatDuration(seconds: number | undefined | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '-';
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const mmss = `${hours > 0 ? String(minutes).padStart(2, '0') : minutes}:${String(secs).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}
