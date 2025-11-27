import { Championship, DriverStanding, ChampionshipOpponent, RaceSession } from '../types/race';
import { safeNumber } from './format-utils';
import { getCarDetails } from './car-data';

export interface ConstructorStanding {
  carName: string;
  name: string;
  brand: string;
  model: string;
  year: string;
  driverCount: number;
  customPoints: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
  poles: number;
}

export interface AllTimeDriverStats {
  name: string;
  nation: string;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
  poles: number;
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

  // Create a map of opponent data from all championships
  // Prioritize non-ARG nationalities to avoid defaulting to player nation
  const opponentMap = new Map<string, ChampionshipOpponent>();
  championships.forEach((championship) => {
    championship.data.opponents.forEach((opponent) => {
      const existing = opponentMap.get(opponent.name);
      // Always update if we don't have data, or if new nation is not ARG and existing is ARG
      if (!existing || (opponent.nation !== 'ARG' && existing.nation === 'ARG')) {
        opponentMap.set(opponent.name, opponent);
      }
    });
  });

  // Process all race sessions
  sessions.forEach((session) => {
    const drivers = session.data.driver_statistics;
    const sessionInfo = session.data.session_info;
    const filename = session.filename.split('/').pop() || '';
    const isQualifying = filename.includes('session_qualifying');
    const isRace = filename.includes('session_race');

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

    // Award pole position for qualifying sessions
    if (isQualifying && fastestDriverName) {
      const driverStats = statsMap.get(fastestDriverName);
      if (driverStats) {
        driverStats.poles++;
      }
    }

    Object.entries(drivers).forEach(([driverName, stats]) => {
      if (!statsMap.has(driverName)) {
        // Get nation from opponent data, default to Argentina for player
        const opponentData = opponentMap.get(driverName);
        statsMap.set(driverName, {
          name: driverName,
          nation: opponentData?.nation || 'ARG',
          firstPlaces: 0,
          secondPlaces: 0,
          thirdPlaces: 0,
          poles: 0,
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

      // Track abandons (retired from the race)
      // Use the retired flag from the data if available, otherwise fall back to old logic
      const retired = stats.retired !== undefined ? stats.retired : false;
      if (retired) {
        driverStats.abandons++;
      }

      // Track fastest laps (for race sessions only, not practice or qualifying)
      if (driverName === fastestDriverName && isRace) {
        driverStats.fastestLaps++;
      }

      // Track crashes
      driverStats.totalCrashes += crashes;

      // Add custom points only for race sessions
      if (isRace) {
        const totalScore = safeNumber(stats.total_score, 0);
        driverStats.totalPoints += totalScore;
      }

      driverStats.totalRaces++;
    });
  });

  // Count championship wins - only for completed seasons
  championships.forEach((championship) => {
    championship.seasons.forEach((season) => {
      if (season.sessions.length === 0) return;

      // Count completed race sessions
      const completedRaces = season.sessions.filter(session => {
        const filename = session.filename.split('/').pop() || '';
        return filename.includes('session_race');
      }).length;

      // Only count this season if it's completed (all rounds have been raced)
      if (completedRaces !== season.data.rounds.length) return;

      // Create a temporary Championship object for this completed season
      const seasonChampionship: Championship = {
        id: championship.id,
        data: season.data,
        folderName: championship.folderName,
        sessions: season.sessions,
        seasons: [season],
      };

      const standings = calculateStandings(seasonChampionship);
      if (standings.length > 0) {
        const winner = standings[0];
        const driverStats = statsMap.get(winner.name);
        if (driverStats) {
          driverStats.championshipsWon++;
        }
      }
    });
  });

  // Convert to array and sort by total points first, then wins, then podium finishes
  return Array.from(statsMap.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
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
          nation: opponentData?.nation || 'ARG', // Default to Argentina for player
        });
      }
    });
  });

  // Process qualifying sessions for pole positions
  sessions
    .filter((session) => {
      const filename = session.filename.split('/').pop() || '';
      return filename.includes('session_qualifying');
    })
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
    .filter((session) => {
      const filename = session.filename.split('/').pop() || '';
      return filename.includes('session_race');
    })
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

export function calculateConstructorStandings(championship: Championship): ConstructorStanding[] {
  const { sessions } = championship;

  // Map to store constructor standings
  const constructorsMap = new Map<string, ConstructorStanding>();

  // Map to track unique drivers per constructor
  const constructorDriversMap = new Map<string, Set<string>>();

  // Process qualifying sessions for pole positions
  sessions
    .filter((session) => {
      const filename = session.filename.split('/').pop() || '';
      return filename.includes('session_qualifying');
    })
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

      // Award pole position to constructor
      if (poleDriver) {
        const poleDriverStats = drivers[poleDriver];
        const carName = poleDriverStats.car_name;
        if (carName) {
          if (!constructorsMap.has(carName)) {
            const carDetails = getCarDetails(carName);
            constructorsMap.set(carName, {
              carName: carName,
              name: carDetails.name,
              brand: carDetails.brand,
              model: carDetails.model,
              year: carDetails.year,
              driverCount: 0,
              customPoints: 0,
              wins: 0,
              podiums: 0,
              fastestLaps: 0,
              poles: 0,
            });
            constructorDriversMap.set(carName, new Set());
          }
          const constructor = constructorsMap.get(carName)!;
          constructor.poles++;

          // Track unique driver
          constructorDriversMap.get(carName)!.add(poleDriver);
        }
      }
    });

  // Process race sessions for points, wins, podiums, and fastest laps
  sessions
    .filter((session) => {
      const filename = session.filename.split('/').pop() || '';
      return filename.includes('session_race');
    })
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

      // Award fastest lap to constructor
      if (fastestLapDriver) {
        const fastestDriverStats = drivers[fastestLapDriver];
        const carName = fastestDriverStats.car_name;
        if (carName) {
          if (!constructorsMap.has(carName)) {
            const carDetails = getCarDetails(carName);
            constructorsMap.set(carName, {
              carName: carName,
              name: carDetails.name,
              brand: carDetails.brand,
              model: carDetails.model,
              year: carDetails.year,
              driverCount: 0,
              customPoints: 0,
              wins: 0,
              podiums: 0,
              fastestLaps: 0,
              poles: 0,
            });
            constructorDriversMap.set(carName, new Set());
          }
          const constructor = constructorsMap.get(carName)!;
          constructor.fastestLaps++;

          // Track unique driver
          constructorDriversMap.get(carName)!.add(fastestLapDriver);
        }
      }

      // Aggregate points from all drivers per constructor
      Object.entries(drivers).forEach(([driverName, stats]) => {
        const carName = stats.car_name;
        if (!carName) return;

        // Initialize constructor if not exists
        if (!constructorsMap.has(carName)) {
          const carDetails = getCarDetails(carName);
          constructorsMap.set(carName, {
            carName: carName,
            name: carDetails.name,
            brand: carDetails.brand,
            model: carDetails.model,
            year: carDetails.year,
            driverCount: 0,
            customPoints: 0,
            wins: 0,
            podiums: 0,
            fastestLaps: 0,
            poles: 0,
          });
          constructorDriversMap.set(carName, new Set());
        }

        const constructor = constructorsMap.get(carName)!;
        const position = stats.position ?? 999;

        // Track unique driver
        constructorDriversMap.get(carName)!.add(driverName);

        // Add custom points (total_score from the session)
        constructor.customPoints += safeNumber(stats.total_score, 0);

        // Track wins and podiums
        if (position === 1) constructor.wins++;
        if (position <= 3) constructor.podiums++;
      });
    });

  // Update driver counts
  constructorsMap.forEach((constructor, carName) => {
    constructor.driverCount = constructorDriversMap.get(carName)?.size || 0;
  });

  // Convert map to array and sort by custom points (desc), then wins (desc), then podiums (desc)
  return Array.from(constructorsMap.values()).sort((a, b) => {
    if (b.customPoints !== a.customPoints) return b.customPoints - a.customPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    return a.name.localeCompare(b.name);
  });
}
