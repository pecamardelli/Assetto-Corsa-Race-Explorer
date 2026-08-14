import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getChampionship } from "../../../../../lib/race-data";
import { getCarDetails } from "../../../../../lib/car-data";
import { calculateStandings } from "../../../../../lib/standings";
import BackButton from "../../../../../components/BackButton";
import FlagIcon from "../../../../../components/FlagIcon";
import DriverImage from "../../../../../components/DriverImage";
import {
  getDriverProfiles,
  resolveDriverPortraits,
  profileAge,
  type DriverProfile,
} from "../../../../../lib/driver-assets";

export default async function LineupPage({
  params,
}: {
  params: Promise<{ champId: string; seasonId: string }>;
}) {
  const { champId, seasonId } = await params;
  const decodedChampId = decodeURIComponent(champId);
  const decodedSeasonId = decodeURIComponent(seasonId);

  const championship = await getChampionship(decodedChampId);

  if (!championship) {
    notFound();
  }

  // Find the specific season
  const season = championship.seasons.find(
    (s) =>
      s.seasonName.toLowerCase().replace(" ", "_") ===
      decodedSeasonId.toLowerCase()
  );

  if (!season) {
    notFound();
  }

  const { data } = season;

  // Calculate champions across all seasons in this championship
  const championWins = new Map<string, number>();
  let reigningChampion: string | null = null;

  // Find the index of the current season
  const currentSeasonIndex = championship.seasons.findIndex(
    (s) =>
      s.seasonName.toLowerCase().replace(" ", "_") ===
      decodedSeasonId.toLowerCase()
  );

  // Get all seasons before the current one (sorted by their order in the array)
  const previousSeasons = championship.seasons
    .slice(0, currentSeasonIndex)
    .map((s, index) => ({
      season: s,
      originalIndex: index,
      standings: calculateStandings({
        id: championship.id,
        data: s.data,
        folderName: championship.folderName,
        sessions: s.sessions,
        seasons: [s],
      })
    }))
    .filter(s => s.standings.length > 0);

  // Get reigning champion (from the most recent previous season with race data)
  if (previousSeasons.length > 0) {
    const previousChampion = previousSeasons[previousSeasons.length - 1];
    reigningChampion = previousChampion.standings[0].name;
  }

  // Count championship wins only from finished seasons (before the current one)
  const finishedSeasons = championship.seasons.slice(0, currentSeasonIndex);
  for (const s of finishedSeasons) {
    const seasonChampionship = {
      id: championship.id,
      data: s.data,
      folderName: championship.folderName,
      sessions: s.sessions,
      seasons: [s],
    };

    const standings = calculateStandings(seasonChampionship);
    if (standings.length > 0) {
      const championName = standings[0].name;
      championWins.set(championName, (championWins.get(championName) || 0) + 1);
    }
  }

  // Group drivers by car. Profiles and portraits resolve against this championship,
  // so a series that ships its own overrides wins over the global versions.
  const opponentNames = data.opponents.map(o => o.name);
  const [profiles, portraits] = await Promise.all([
    getDriverProfiles(opponentNames, decodedChampId),
    resolveDriverPortraits(opponentNames, decodedChampId),
  ]);

  const carDriverMap = new Map<
    string,
    Array<{ name: string; nation: string; profile: DriverProfile | null; portrait: string | null; championshipWins: number; isReigningChampion: boolean }>
  >();

  for (const opponent of data.opponents) {
    const driverInfo = {
      name: opponent.name,
      nation: opponent.nation,
      profile: profiles.get(opponent.name) ?? null,
      portrait: portraits.get(opponent.name) ?? null,
      championshipWins: championWins.get(opponent.name) || 0,
      isReigningChampion: opponent.name === reigningChampion,
    };

    if (!carDriverMap.has(opponent.car)) {
      carDriverMap.set(opponent.car, []);
    }
    carDriverMap.get(opponent.car)!.push(driverInfo);
  }

  // Convert to array and sort by car name
  const carsWithDrivers = Array.from(carDriverMap.entries())
    .map(([carName, drivers]) => ({
      carName,
      carDetails: getCarDetails(carName),
      drivers,
    }))
    .sort((a, b) => a.carDetails.brand.localeCompare(b.carDetails.brand));

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {/* Header */}
        <div className="mb-8">
          <BackButton
            fallbackUrl={`/championship/${encodeURIComponent(
              decodedChampId
            )}/season/${encodeURIComponent(decodedSeasonId)}`}
          >
            Back to Season
          </BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
            <h1 className="text-4xl font-bold text-white mb-2">
              Drivers Lineup
            </h1>
            <div className="text-xl text-purple-400 mb-4">
              {data.name} - {season.seasonName}
            </div>
            <div className="text-sm text-zinc-400">
              {data.opponents.length} drivers competing in {carsWithDrivers.length} different cars
            </div>
          </div>
        </div>

        {/* Cars and Drivers Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {carsWithDrivers.map(({ carName, carDetails, drivers }) => (
            <div
              key={carName}
              className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6"
            >
              {/* Car Header */}
              <Link
                href={`/car/${encodeURIComponent(carName)}`}
                className="flex items-center gap-4 mb-6 pb-4 border-b border-zinc-700 group cursor-pointer"
              >
                <Image
                  src={`/badges/${carName}.png`}
                  alt={carDetails.brand}
                  width={60}
                  height={60}
                  className="rounded-lg transition-transform group-hover:scale-105"
                  unoptimized
                />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">
                    {carDetails.brand}
                  </h2>
                  <div className="text-lg text-zinc-300">{carDetails.model}</div>
                  {carDetails.year && (
                    <div className="text-sm text-zinc-500">{carDetails.year}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-zinc-500">Drivers</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {drivers.length}
                  </div>
                </div>
              </Link>

              {/* Drivers List */}
              <div className="space-y-4">
                {drivers.map((driver) => {
                  const age = driver.profile ? profileAge(driver.profile) : null;

                  return (
                    <Link
                      key={driver.name}
                      href={`/driver/${encodeURIComponent(driver.name)}`}
                      className={`relative flex items-start gap-4 p-4 rounded-lg border transition-all group ${
                        driver.isReigningChampion
                          ? 'bg-gradient-to-br from-amber-500/10 via-zinc-900/50 to-zinc-900/50 border-amber-500/50 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/20'
                          : 'bg-zinc-900/50 border-zinc-700/50 hover:border-purple-500/50 hover:bg-zinc-900/80'
                      }`}
                    >
                      {/* Reigning Champion Crown Badge */}
                      {driver.isReigningChampion && (
                        <div className="absolute -top-2 -right-2 z-10">
                          <div className="relative">
                            {/* Glow effect */}
                            <div className="absolute inset-0 bg-amber-400 rounded-full blur-md opacity-60 animate-pulse"></div>
                            {/* Badge */}
                            <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 rounded-full border-2 border-amber-300 shadow-xl">
                              <svg
                                className="w-7 h-7 text-zinc-900 drop-shadow-md"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                              </svg>
                              {/* Sparkle decorations */}
                              <div className="absolute -top-1 -left-1 w-2 h-2 bg-white rounded-full animate-ping"></div>
                              <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-amber-200 rounded-full animate-pulse"></div>
                            </div>
                            {/* Tooltip */}
                            <div className="absolute top-14 right-0 hidden group-hover:block w-max">
                              <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                                👑 REIGNING CHAMPION
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Driver Photo */}
                      <div className="flex-shrink-0">
                        <DriverImage driverName={driver.name} src={driver.portrait} />
                      </div>

                      {/* Driver Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                            {driver.profile?.name || driver.name}
                          </h3>
                          <FlagIcon nation={driver.nation} />
                          {driver.profile && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                              driver.profile.isFictional === false
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}>
                              {driver.profile.isFictional === false ? 'REAL' : 'AI'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 text-sm">
                          {age !== null && (
                            <div>
                              <span className="text-zinc-500">Age: </span>
                              <span className="text-zinc-300">{age}</span>
                            </div>
                          )}
                          {driver.profile?.placeOfBirth && (
                            <div>
                              <span className="text-zinc-500">From: </span>
                              <span className="text-zinc-300">
                                {driver.profile.placeOfBirth}
                              </span>
                            </div>
                          )}
                          {driver.profile?.nationality && (
                            <div>
                              <span className="text-zinc-500">Nationality: </span>
                              <span className="text-zinc-300">
                                {driver.profile.nationality}
                              </span>
                            </div>
                          )}
                          {driver.championshipWins > 0 && (
                            <div className="mt-1">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-900 rounded-full shadow-lg"
                                title={`${driver.championshipWins} Championship ${driver.championshipWins === 1 ? 'Win' : 'Wins'}`}
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span>{driver.championshipWins}× CHAMPION</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
