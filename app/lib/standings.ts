import { Championship, DriverStanding, ChampionshipOpponent, RaceSession } from '../types/race';
import { safeNumber } from './format-utils';

export interface AllTimeDriverStats {
  name: string;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
  abandons: number;
  fastestLaps: number;
  totalCrashes: number;
  championshipsWon: number;
  totalRaces: number;
  totalPoints: number;
  podiums: number;
}

export function calculateAllTimeStats(
  sessions: RaceSession[],
  championships: Championship[]
): AllTimeDriverStats[] {
  const statsMap = new Map<string, AllTimeDriverStats>();

  // Process all race sessions
  sessions.forEach((session) => {
    const drivers = session.data.driver_statistics;
    const sessionInfo = session.data.session_info;

    // Find the fastest lap in this session
    let fastestLapTime = Infinity;
    let fastestDriverName = '';

    Object.entries(drivers).forEach(([driverName, stats]) => {
      const bestLap = safeNumber(stats.best_lap);
      if (bestLap > 0 && bestLap < fastestLapTime) {
        fastestLapTime = bestLap;
        fastestDriverName = driverName;
      }
    });

    Object.entries(drivers).forEach(([driverName, stats]) => {
      if (!statsMap.has(driverName)) {
        statsMap.set(driverName, {
          name: driverName,
          firstPlaces: 0,
          secondPlaces: 0,
          thirdPlaces: 0,
          abandons: 0,
          fastestLaps: 0,
          totalCrashes: 0,
          championshipsWon: 0,
          totalRaces: 0,
          totalPoints: 0,
          podiums: 0,
        });
      }

      const driverStats = statsMap.get(driverName)!;
      const position = safeNumber(stats.position, 999);
      const lapsCompleted = safeNumber(stats.laps_completed, 0);
      const raceLaps = safeNumber(sessionInfo.race_laps, 0);
      const crashes = safeNumber(stats.crashes?.total_crashes, 0);

      // Track positions
      if (position === 1) driverStats.firstPlaces++;
      if (position === 2) driverStats.secondPlaces++;
      if (position === 3) driverStats.thirdPlaces++;
      if (position <= 3) driverStats.podiums++;

      // Track abandons (didn't complete the race)
      if (raceLaps > 0 && lapsCompleted < raceLaps && position > 3) {
        driverStats.abandons++;
      }

      // Track fastest laps
      if (driverName === fastestDriverName) {
        driverStats.fastestLaps++;
      }

      // Track crashes
      driverStats.totalCrashes += crashes;

      driverStats.totalRaces++;
    });
  });

  // Count championship wins
  championships.forEach((championship) => {
    if (championship.sessions.length === 0) return;

    const standings = calculateStandings(championship);
    if (standings.length > 0) {
      const winner = standings[0];
      const driverStats = statsMap.get(winner.name);
      if (driverStats) {
        driverStats.championshipsWon++;
      }
    }
  });

  // Convert to array and sort by first places, then second places, then third places
  return Array.from(statsMap.values()).sort((a, b) => {
    if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
    if (b.secondPlaces !== a.secondPlaces) return b.secondPlaces - a.secondPlaces;
    if (b.thirdPlaces !== a.thirdPlaces) return b.thirdPlaces - a.thirdPlaces;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    return a.name.localeCompare(b.name);
  });
}

export function calculateStandings(championship: Championship): DriverStanding[] {
  const { data, sessions } = championship;
  const pointsTable = data.rules.points;

  // Initialize standings map - we'll populate it from session data
  const standingsMap = new Map<string, DriverStanding>();

  // Create a map of opponent data for quick lookup
  const opponentMap = new Map<string, ChampionshipOpponent>();
  data.opponents.forEach((opponent: ChampionshipOpponent) => {
    opponentMap.set(opponent.name, opponent);
  });

  // Initialize standings by finding all drivers that appear in any session
  sessions.forEach((session) => {
    const drivers = session.data.driver_statistics;
    Object.entries(drivers).forEach(([driverName, stats]) => {
      if (!standingsMap.has(driverName)) {
        // Get opponent data if available, otherwise use defaults
        const opponentData = opponentMap.get(driverName);
        standingsMap.set(driverName, {
          name: driverName,
          points: 0,
          customPoints: 0,
          wins: 0,
          podiums: 0,
          poles: 0,
          fastestLaps: 0,
          racesCompleted: 0,
          car: stats.car_name || opponentData?.car || 'unknown',
          nation: opponentData?.nation || 'UN',
        });
      }
    });
  });

  // Process qualifying sessions for pole positions
  sessions
    .filter((session) => session.data.session_info.session_type === 'qualifying')
    .forEach((session) => {
      const drivers = session.data.driver_statistics;

      // Find the driver with the fastest lap (pole position)
      let fastestLap = Infinity;
      let poleDriver = '';

      Object.entries(drivers).forEach(([driverName, stats]) => {
        const bestLap = safeNumber(stats.best_lap);
        if (bestLap > 0 && bestLap < fastestLap) {
          fastestLap = bestLap;
          poleDriver = driverName;
        }
      });

      // Award pole position
      if (poleDriver) {
        const standing = standingsMap.get(poleDriver);
        if (standing) standing.poles++;
      }
    });

  // Process race sessions for points, wins, podiums, and fastest laps
  sessions
    .filter((session) => session.data.session_info.session_type === 'race')
    .forEach((session) => {
      const drivers = session.data.driver_statistics;

      // Find the driver with the fastest lap
      let fastestLap = Infinity;
      let fastestLapDriver = '';

      Object.entries(drivers).forEach(([driverName, stats]) => {
        const bestLap = safeNumber(stats.best_lap);
        if (bestLap > 0 && bestLap < fastestLap) {
          fastestLap = bestLap;
          fastestLapDriver = driverName;
        }
      });

      // Award fastest lap
      if (fastestLapDriver) {
        const standing = standingsMap.get(fastestLapDriver);
        if (standing) standing.fastestLaps++;
      }

      Object.entries(drivers).forEach(([driverName, stats]) => {
        const standing = standingsMap.get(driverName);
        if (!standing) return; // Driver not in championship

        const position = stats.position ?? 999;

        // Award points based on position
        if (position <= pointsTable.length) {
          standing.points += pointsTable[position - 1];
        }

        // Add custom points (total_score from the session)
        standing.customPoints += safeNumber(stats.total_score, 0);

        // Track wins and podiums
        if (position === 1) standing.wins++;
        if (position <= 3) standing.podiums++;

        standing.racesCompleted++;
      });
    });

  // Convert map to array and sort by custom points (desc), then wins (desc), then podiums (desc)
  return Array.from(standingsMap.values()).sort((a, b) => {
    if (b.customPoints !== a.customPoints) return b.customPoints - a.customPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    return a.name.localeCompare(b.name);
  });
}
