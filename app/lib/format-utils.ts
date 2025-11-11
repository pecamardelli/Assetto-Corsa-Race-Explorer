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

  return Object.entries(driverStats)
    .map(([name, stats]) => ({
      name,
      position: stats?.position ?? 999,
      ...stats
    }))
    .sort((a, b) => a.position - b.position);
}

export function safeNumber(value: any, defaultValue: number = 0): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export function safeString(value: any, defaultValue: string = ''): string {
  return value?.toString() ?? defaultValue;
}
