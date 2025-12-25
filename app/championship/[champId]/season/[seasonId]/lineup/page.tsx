import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getChampionship } from "../../../../../lib/race-data";
import { getCarDetails } from "../../../../../lib/car-data";
import BackButton from "../../../../../components/BackButton";
import FlagIcon from "../../../../../components/FlagIcon";
import DriverImage from "../../../../../components/DriverImage";
import { promises as fs } from "fs";
import path from "path";

type DriverProfile = {
  name: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  features: string;
  gender: string;
};

async function getDriverProfile(
  driverName: string
): Promise<DriverProfile | null> {
  try {
    const profilePath = path.join(
      process.cwd(),
      "app/lib/driver-profiles",
      `${driverName.replace(/ /g, "_").toLowerCase()}.json`
    );
    const fileContents = await fs.readFile(profilePath, "utf8");
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

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

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

  // Group drivers by car
  const carDriverMap = new Map<
    string,
    Array<{ name: string; nation: string; profile: DriverProfile | null }>
  >();

  for (const opponent of data.opponents) {
    const profile = await getDriverProfile(opponent.name);
    const driverInfo = {
      name: opponent.name,
      nation: opponent.nation,
      profile,
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
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-zinc-700">
                <Image
                  src={`/badges/${carName}.png`}
                  alt={carDetails.brand}
                  width={60}
                  height={60}
                  className="rounded-lg"
                  unoptimized
                />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white">
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
              </div>

              {/* Drivers List */}
              <div className="space-y-4">
                {drivers.map((driver) => {
                  const age = driver.profile?.dateOfBirth
                    ? calculateAge(driver.profile.dateOfBirth)
                    : null;

                  return (
                    <Link
                      key={driver.name}
                      href={`/driver/${encodeURIComponent(driver.name)}`}
                      className="flex items-start gap-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-700/50 hover:border-purple-500/50 hover:bg-zinc-900/80 transition-all group"
                    >
                      {/* Driver Photo */}
                      <div className="flex-shrink-0">
                        <DriverImage driverName={driver.name} />
                      </div>

                      {/* Driver Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                            {driver.profile?.name || driver.name}
                          </h3>
                          <FlagIcon nation={driver.nation} />
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
