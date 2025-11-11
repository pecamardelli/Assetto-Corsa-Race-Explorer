import { Championship, DriverStanding, ChampionshipOpponent } from '../types/race';

export function calculateStandings(championship: Championship): DriverStanding[] {
  const { data, sessions } = championship;
  const pointsTable = data.rules.points;

  // Initialize standings for all opponents
  const standingsMap = new Map<string, DriverStanding>();

  data.opponents.forEach((opponent: ChampionshipOpponent) => {
    standingsMap.set(opponent.name, {
      name: opponent.name,
      points: 0,
      wins: 0,
      podiums: 0,
      racesCompleted: 0,
      car: opponent.car,
      nation: opponent.nation,
    });
  });

  // Process each completed session
  sessions.forEach((session) => {
    const drivers = session.data.driver_statistics;

    Object.entries(drivers).forEach(([driverName, stats]) => {
      const standing = standingsMap.get(driverName);
      if (!standing) return; // Driver not in championship

      const position = stats.position ?? 999;

      // Award points based on position
      if (position <= pointsTable.length) {
        standing.points += pointsTable[position - 1];
      }

      // Track wins and podiums
      if (position === 1) standing.wins++;
      if (position <= 3) standing.podiums++;

      standing.racesCompleted++;
    });
  });

  // Convert map to array and sort by points (desc), then wins (desc), then podiums (desc)
  return Array.from(standingsMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    return a.name.localeCompare(b.name);
  });
}
