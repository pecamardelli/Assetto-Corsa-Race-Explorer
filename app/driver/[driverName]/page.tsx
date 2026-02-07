import { notFound } from 'next/navigation';
import BackButton from '../../components/BackButton';
import FlagIcon from '../../components/FlagIcon';
import DriverImage from '../../components/DriverImage';
import { getChampionships } from '../../lib/race-data';
import { calculateStandings } from '../../lib/standings';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';

type DriverData = {
  name: string;
  nation: string;
  car: string;
  totalPoints: number;
  totalRaces: number;
  totalWins: number;
  totalPoles: number;
  totalPodiums: number;
  totalFastestLaps: number;
  totalChampionships: number;
  championships: Array<{
    champName: string;
    champId: string;
    seasonName: string;
    seasonId: string;
    position: number;
    points: number;
    wins: number;
    poles: number;
    podiums: number;
    fastestLaps: number;
  }>;
};

type DriverProfile = {
  name: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  features: string;
  gender: string;
};

async function getDriverProfile(driverName: string): Promise<DriverProfile | null> {
  try {
    const profilePath = path.join(process.cwd(), 'app/lib/driver-profiles', `${driverName.replace(/ /g, '_').toLowerCase()}.json`);
    const fileContents = await fs.readFile(profilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return null;
  }
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

export default async function DriverPage({ params }: { params: Promise<{ driverName: string }> }) {
  const { driverName } = await params;
  const decodedDriverName = decodeURIComponent(driverName);

  // Load driver profile
  const profile = await getDriverProfile(decodedDriverName);

  // Get all championships to find driver data
  const championships = await getChampionships();

  // Collect all driver data across championships
  let driverData: DriverData | null = null;

  for (const champ of championships) {
    for (const season of champ.seasons) {
      // Create temporary championship for this season
      const seasonChampionship = {
        id: champ.id,
        data: season.data,
        folderName: champ.folderName,
        sessions: season.sessions,
        seasons: [season],
      };

      const standings = calculateStandings(seasonChampionship);
      const driver = standings.find(d => d.name === decodedDriverName);

      if (driver) {
        if (!driverData) {
          driverData = {
            name: driver.name,
            nation: driver.nation,
            car: driver.car,
            totalPoints: 0,
            totalRaces: 0,
            totalWins: 0,
            totalPoles: 0,
            totalPodiums: 0,
            totalFastestLaps: 0,
            totalChampionships: 0,
            championships: [],
          };
        }

        const position = standings.findIndex(d => d.name === decodedDriverName) + 1;

        driverData.totalPoints += driver.customPoints;
        driverData.totalRaces += driver.racesCompleted;
        driverData.totalWins += driver.wins;
        driverData.totalPoles += driver.poles;
        driverData.totalPodiums += driver.podiums;
        driverData.totalFastestLaps += driver.fastestLaps;

        // Only count championship if season is complete
        const completedRaces = season.sessions.filter(session => {
          const sessionType = session.data.session_type || session.data.session_info.session_type;
          return sessionType === 'race';
        }).length;
        const isSeasonComplete = completedRaces === season.data.rounds.length;
        if (position === 1 && isSeasonComplete) driverData.totalChampionships++;

        driverData.championships.push({
          champName: season.data.name,
          champId: champ.id,
          seasonName: season.seasonName,
          seasonId: season.seasonName.toLowerCase().replace(' ', '_'),
          position,
          points: driver.customPoints,
          wins: driver.wins,
          poles: driver.poles,
          podiums: driver.podiums,
          fastestLaps: driver.fastestLaps,
        });
      }
    }
  }

  // If no race data found, check if driver exists in any championship lineup
  if (!driverData) {
    for (const champ of championships) {
      for (const season of champ.seasons) {
        const opponent = season.data.opponents?.find((o: any) => o.name === decodedDriverName);
        if (opponent) {
          driverData = {
            name: opponent.name,
            nation: opponent.nation,
            car: opponent.car,
            totalPoints: 0,
            totalRaces: 0,
            totalWins: 0,
            totalPoles: 0,
            totalPodiums: 0,
            totalFastestLaps: 0,
            totalChampionships: 0,
            championships: [],
          };
          break;
        }
      }
      if (driverData) break;
    }
  }

  if (!driverData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton>Back</BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 mb-4">
            <div className="flex items-start gap-6 mb-6">
              {/* Profile Picture */}
              <div className="flex-shrink-0">
                <DriverImage driverName={driverData.name} />
              </div>

              {/* Driver Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <FlagIcon nation={driverData.nation} />
                  <h1 className="text-4xl font-bold text-white">
                    {driverData.name}
                  </h1>
                  <Link
                    href={`/driver/${encodeURIComponent(driverData.name)}/edit`}
                    className="ml-auto px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  >
                    Edit Profile
                  </Link>
                </div>
                {profile && (
                  <div className="mt-3 space-y-1.5 text-zinc-400 text-sm">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      <span>Age: {calculateAge(profile.dateOfBirth)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span>From: {profile.placeOfBirth}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Career Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-6">
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase mb-1">Total Points</div>
                <div className="text-2xl font-bold text-white">{driverData.totalPoints.toLocaleString()}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase mb-1">Races</div>
                <div className="text-2xl font-bold text-sky-400">{driverData.totalRaces}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase mb-1">Wins</div>
                <div className="text-2xl font-bold text-amber-400">{driverData.totalWins}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase mb-1">Poles</div>
                <div className="text-2xl font-bold text-purple-400">{driverData.totalPoles}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase mb-1">Podiums</div>
                <div className="text-2xl font-bold text-zinc-300">{driverData.totalPodiums}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase mb-1">Fast Laps</div>
                <div className="text-2xl font-bold text-green-400">{driverData.totalFastestLaps}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase mb-1">Championships</div>
                <div className="text-2xl font-bold text-amber-500">{driverData.totalChampionships}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Championship Participations */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-zinc-900/50 border-b border-zinc-700">
            <h2 className="text-xl font-bold text-white">Championship History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Championship
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Season
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    Wins
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                    Poles
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    Podiums
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                    Fast Laps
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {driverData.championships.map((champ, index) => {
                  const isChampion = champ.position === 1;
                  const isPodium = champ.position <= 3;

                  return (
                    <tr
                      key={`${champ.champId}-${champ.seasonId}-${index}`}
                      className={`hover:bg-zinc-800/80 transition-colors ${
                        isChampion ? 'bg-amber-500/5' : isPodium ? 'bg-zinc-700/10' : ''
                      }`}
                    >
                      <td className="px-4 py-4">
                        <div className="text-white font-medium">{champ.champName}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/championship/${encodeURIComponent(champ.champId)}/season/${encodeURIComponent(champ.seasonId)}/standings`}
                          className="text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          {champ.seasonName}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          champ.position === 1 ? 'bg-amber-500 text-zinc-900' :
                          champ.position === 2 ? 'bg-zinc-400 text-zinc-900' :
                          champ.position === 3 ? 'bg-amber-700 text-white' :
                          'bg-zinc-700 text-white'
                        }`}>
                          {champ.position}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden md:table-cell">
                        {champ.wins > 0 ? (
                          <span className="text-amber-400 font-semibold">{champ.wins}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden md:table-cell">
                        {champ.poles > 0 ? (
                          <span className="text-purple-400 font-semibold">{champ.poles}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden lg:table-cell">
                        {champ.podiums > 0 ? (
                          <span className="text-zinc-300 font-semibold">{champ.podiums}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-white hidden lg:table-cell">
                        {champ.fastestLaps > 0 ? (
                          <span className="text-green-400 font-semibold">{champ.fastestLaps}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`font-bold font-mono ${
                          isChampion ? 'text-amber-400' : 'text-white'
                        }`}>
                          {champ.points.toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
