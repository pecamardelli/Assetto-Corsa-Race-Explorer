import { Championship, DriverStanding, ChampionshipOpponent, RaceSession } from '../types/race';
import { safeNumber } from './format-utils';
import { getCarDetails } from './car-data';
import { mergeGroupedRounds } from './round-groups';
import { classifyScoring, fastestLapDriver, trafficNames } from './traffic';

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

export interface AllTimeConstructorStats {
  carName: string;
  name: string;
  brand: string;
  model: string;
  year: string;
  driverCount: number;
  totalPoints: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
  poles: number;
  championshipsWon: number;
  totalRaces: number;
}

export function calculateAllTimeStats(
  allSessions: RaceSession[],
  championships: Championship[]
): AllTimeDriverStats[] {
  // A round run in groups scores once, as the one race it was.
  const sessions = mergeGroupedRounds(allSessions);

  const statsMap = new Map<string, AllTimeDriverStats>();

  // The cars that were only ever on the road to be overtaken. Gathered across every
  // championship, since these sessions come from all of them at once.
  const traffic = trafficNames(
    championships.flatMap(championship => championship.seasons.map(season => season.data.opponents))
  );

  // Create a map of opponent data from all championships and all seasons
  // Prioritize non-ARG nationalities to avoid defaulting to player nation
  // Keep the first non-ARG nation found to maintain consistency across seasons
  const opponentMap = new Map<string, ChampionshipOpponent>();
  championships.forEach((championship) => {
    // Process opponents from all seasons in this championship
    championship.seasons.forEach((season) => {
      season.data.opponents.forEach((opponent) => {
        const existing = opponentMap.get(opponent.name);
        // Only update if we don't have data, or if new nation is not ARG and existing is ARG
        if (!existing) {
          opponentMap.set(opponent.name, opponent);
        } else if (opponent.nation !== 'ARG' && existing.nation === 'ARG') {
          opponentMap.set(opponent.name, opponent);
        }
        // If we already have a non-ARG nation, keep it (don't override)
      });
    });
  });

  // Process all race sessions
  sessions.forEach((session) => {
    const drivers = session.data.driver_statistics;
    const sessionInfo = session.data.session_info;
    // Check both root level and session_info for session_type
    const sessionType = session.data.session_type || sessionInfo.session_type;
    const isQualifying = sessionType === 'qualifying';
    const isRace = sessionType === 'race';

    // Find the fastest lap in this session
    const fastestDriverName = fastestLapDriver(drivers, traffic);

    // Award pole position for qualifying sessions
    if (isQualifying && fastestDriverName) {
      const driverStats = statsMap.get(fastestDriverName);
      if (driverStats) {
        driverStats.poles++;
      }
    }

    // Traffic is dropped here and the drivers behind it close ranks, so a race won
    // behind a lorry is recorded as a win.
    classifyScoring(drivers, traffic).forEach(({ name: driverName, stats, position }) => {
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
      const crashes = safeNumber(stats.crashes?.total_crashes, 0);

      // Track positions (only for race sessions)
      if (isRace) {
        if (position === 1) driverStats.firstPlaces++;
        if (position === 2) driverStats.secondPlaces++;
        if (position === 3) driverStats.thirdPlaces++;
        if (position <= 3) driverStats.podiums++;
      }

      // Track abandons (retired from the race - only for race sessions)
      if (isRace) {
        const retired = stats.retired !== undefined ? stats.retired : false;
        if (retired) {
          driverStats.abandons++;
        }
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
        driverStats.totalRaces++;
      }
    });
  });

  // Count championship wins - only for completed seasons
  championships.forEach((championship) => {
    championship.seasons.forEach((season) => {
      if (season.sessions.length === 0) return;

      // Count completed race sessions
      const completedRaces = season.sessions.filter(session => {
        const sessionType = session.data.session_type || session.data.session_info.session_type;
        return sessionType === 'race';
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
  const { data } = championship;
  // A round run in groups scores once, as the one race it was.
  const sessions = mergeGroupedRounds(championship.sessions);
  const pointsTable = data.rules.points;

  // Initialize standings map - we'll populate it from session data
  const standingsMap = new Map<string, DriverStanding>();

  // Create a map of opponent data for quick lookup
  const opponentMap = new Map<string, ChampionshipOpponent>();
  data.opponents.forEach((opponent: ChampionshipOpponent) => {
    opponentMap.set(opponent.name, opponent);
  });

  // The road's traffic, which starts every round and contests none of them. Both
  // scopes are asked because this is called with a whole championship and with a
  // single season dressed up as one.
  const traffic = trafficNames([
    data.opponents,
    ...championship.seasons.map(season => season.data.opponents),
  ]);

  // Initialize standings by finding all drivers that appear in any session
  sessions.forEach((session) => {
    const drivers = session.data.driver_statistics;
    Object.entries(drivers).forEach(([driverName, stats]) => {
      if (traffic.has(driverName)) return;
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
      const sessionType = session.data.session_type || session.data.session_info.session_type;
      return sessionType === 'qualifying';
    })
    .forEach((session) => {
      const drivers = session.data.driver_statistics;

      // Find the driver with the fastest lap (pole position)
      const poleDriver = fastestLapDriver(drivers, traffic);

      // Award pole position
      if (poleDriver) {
        const standing = standingsMap.get(poleDriver);
        if (standing) standing.poles++;
      }
    });

  // Process race sessions for points, wins, podiums, and fastest laps
  sessions
    .filter((session) => {
      const sessionType = session.data.session_type || session.data.session_info.session_type;
      return sessionType === 'race';
    })
    .forEach((session) => {
      const drivers = session.data.driver_statistics;

      // Find the driver with the fastest lap
      const fastest = fastestLapDriver(drivers, traffic);

      // Award fastest lap
      if (fastest) {
        const standing = standingsMap.get(fastest);
        if (standing) standing.fastestLaps++;
      }

      // Positions here are the ones left after the traffic is taken out, so the
      // points go to the driver who actually finished sixth of those racing.
      classifyScoring(drivers, traffic).forEach(({ name: driverName, stats, position }) => {
        const standing = standingsMap.get(driverName);
        if (!standing) return; // Driver not in championship

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

        // Update driver's car to the one used in this race
        // Since sessions are sorted chronologically, the last race will have the most recent car
        if (stats.car_name) {
          standing.car = stats.car_name;
        }
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
  // A round run in groups scores once, as the one race it was.
  const sessions = mergeGroupedRounds(championship.sessions);

  // Map to store constructor standings
  const constructorsMap = new Map<string, ConstructorStanding>();

  // Map to track unique drivers per constructor
  const constructorDriversMap = new Map<string, Set<string>>();

  // No constructors' title for the Fiat that spent the season being overtaken.
  const traffic = trafficNames([
    championship.data.opponents,
    ...championship.seasons.map(season => season.data.opponents),
  ]);

  // Process qualifying sessions for pole positions
  sessions
    .filter((session) => {
      const sessionType = session.data.session_type || session.data.session_info.session_type;
      return sessionType === 'qualifying';
    })
    .forEach((session) => {
      const drivers = session.data.driver_statistics;

      // Find the driver with the fastest lap (pole position)
      const poleDriver = fastestLapDriver(drivers, traffic);

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
      const sessionType = session.data.session_type || session.data.session_info.session_type;
      return sessionType === 'race';
    })
    .forEach((session) => {
      const drivers = session.data.driver_statistics;

      // Find the driver with the fastest lap
      const fastest = fastestLapDriver(drivers, traffic);

      // Award fastest lap to constructor
      if (fastest) {
        const fastestDriverStats = drivers[fastest];
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
          constructorDriversMap.get(carName)!.add(fastest);
        }
      }

      // Aggregate points from all drivers per constructor
      classifyScoring(drivers, traffic).forEach(({ name: driverName, stats, position }) => {
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

export function calculateAllTimeConstructorStats(
  allSessions: RaceSession[],
  championships: Championship[]
): AllTimeConstructorStats[] {
  // A round run in groups scores once, as the one race it was.
  const sessions = mergeGroupedRounds(allSessions);

  const statsMap = new Map<string, AllTimeConstructorStats>();
  const constructorDriversMap = new Map<string, Set<string>>();
  const raceSessionsMap = new Map<string, Set<string>>(); // Track which races each constructor participated in

  // Traffic across every championship these sessions were drawn from.
  const traffic = trafficNames(
    championships.flatMap(championship => championship.seasons.map(season => season.data.opponents))
  );

  // Process qualifying sessions for pole positions
  sessions
    .filter((session) => {
      const sessionType = session.data.session_type || session.data.session_info.session_type;
      return sessionType === 'qualifying';
    })
    .forEach((session) => {
      const drivers = session.data.driver_statistics;

      // Find the driver with the fastest lap (pole position)
      const poleDriver = fastestLapDriver(drivers, traffic);

      // Award pole position to constructor
      if (poleDriver) {
        const poleDriverStats = drivers[poleDriver];
        const carName = poleDriverStats.car_name;
        if (carName) {
          if (!statsMap.has(carName)) {
            const carDetails = getCarDetails(carName);
            statsMap.set(carName, {
              carName: carName,
              name: carDetails.name,
              brand: carDetails.brand,
              model: carDetails.model,
              year: carDetails.year,
              driverCount: 0,
              totalPoints: 0,
              wins: 0,
              podiums: 0,
              fastestLaps: 0,
              poles: 0,
              championshipsWon: 0,
              totalRaces: 0,
            });
            constructorDriversMap.set(carName, new Set());
            raceSessionsMap.set(carName, new Set());
          }
          const constructor = statsMap.get(carName)!;
          constructor.poles++;

          // Track unique driver
          constructorDriversMap.get(carName)!.add(poleDriver);
        }
      }
    });

  // Process race sessions

  sessions
    .filter((session) => {
      const sessionType = session.data.session_type || session.data.session_info.session_type;
      return sessionType === 'race';
    })
    .forEach((session) => {
      const drivers = session.data.driver_statistics;
      const sessionId = session.filename; // Use filename as unique identifier

      // Find the driver with the fastest lap
      const fastest = fastestLapDriver(drivers, traffic);

      // Award fastest lap to constructor
      if (fastest) {
        const fastestDriverStats = drivers[fastest];
        const carName = fastestDriverStats.car_name;
        if (carName) {
          if (!statsMap.has(carName)) {
            const carDetails = getCarDetails(carName);
            statsMap.set(carName, {
              carName: carName,
              name: carDetails.name,
              brand: carDetails.brand,
              model: carDetails.model,
              year: carDetails.year,
              driverCount: 0,
              totalPoints: 0,
              wins: 0,
              podiums: 0,
              fastestLaps: 0,
              poles: 0,
              championshipsWon: 0,
              totalRaces: 0,
            });
            constructorDriversMap.set(carName, new Set());
            raceSessionsMap.set(carName, new Set());
          }
          const constructor = statsMap.get(carName)!;
          constructor.fastestLaps++;

          // Track unique driver
          constructorDriversMap.get(carName)!.add(fastest);
        }
      }

      // Aggregate points from all drivers per constructor
      classifyScoring(drivers, traffic).forEach(({ name: driverName, stats, position }) => {
        const carName = stats.car_name;
        if (!carName) return;

        // Initialize constructor if not exists
        if (!statsMap.has(carName)) {
          const carDetails = getCarDetails(carName);
          statsMap.set(carName, {
            carName: carName,
            name: carDetails.name,
            brand: carDetails.brand,
            model: carDetails.model,
            year: carDetails.year,
            driverCount: 0,
            totalPoints: 0,
            wins: 0,
            podiums: 0,
            fastestLaps: 0,
            poles: 0,
            championshipsWon: 0,
            totalRaces: 0,
          });
          constructorDriversMap.set(carName, new Set());
          raceSessionsMap.set(carName, new Set());
        }

        const constructor = statsMap.get(carName)!;

        // Track unique driver
        constructorDriversMap.get(carName)!.add(driverName);

        // Track unique race sessions
        if (!raceSessionsMap.get(carName)!.has(sessionId)) {
          raceSessionsMap.get(carName)!.add(sessionId);
        }

        // Add custom points (total_score from the session)
        constructor.totalPoints += safeNumber(stats.total_score, 0);

        // Track wins and podiums
        if (position === 1) constructor.wins++;
        if (position <= 3) constructor.podiums++;
      });
    });

  // Update driver counts and race counts
  statsMap.forEach((constructor, carName) => {
    constructor.driverCount = constructorDriversMap.get(carName)?.size || 0;
    constructor.totalRaces = raceSessionsMap.get(carName)?.size || 0;
  });

  // Count constructor championships - only for completed seasons
  championships.forEach((championship) => {
    championship.seasons.forEach((season) => {
      if (season.sessions.length === 0) return;

      // Count completed race sessions
      const completedRaces = season.sessions.filter(session => {
        const sessionType = session.data.session_type || session.data.session_info.session_type;
        return sessionType === 'race';
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

      const standings = calculateConstructorStandings(seasonChampionship);
      if (standings.length > 0) {
        const winner = standings[0];
        const constructorStats = statsMap.get(winner.carName);
        if (constructorStats) {
          constructorStats.championshipsWon++;
        }
      }
    });
  });

  // Convert to array and sort by total points, then wins, then podiums
  return Array.from(statsMap.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    return a.name.localeCompare(b.name);
  });
}
