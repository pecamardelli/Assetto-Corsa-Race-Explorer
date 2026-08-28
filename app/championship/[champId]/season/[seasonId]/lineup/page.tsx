import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getChampionship } from "../../../../../lib/race-data";
import { getCarData, getCarDetails, getCarPreviewUrl } from "../../../../../lib/car-data";
import { calculateStandings } from "../../../../../lib/standings";
import BackButton from "../../../../../components/BackButton";
import LineupDriverCard, {
  type LineupDriver,
} from "../../../../../components/LineupDriverCard";
import {
  getDriverProfiles,
  resolveDriverPortraits,
} from "../../../../../lib/driver-assets";
import { partitionRoster } from "../../../../../lib/traffic";
import { classOfEntry, isMultiClass, orderedClasses } from "../../../../../lib/racing-classes";

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

  // The entry list is two different things at once on a road series: the drivers
  // contesting the championship, and the traffic they have to get past. Only the
  // first belongs in a lineup — see `app/lib/traffic.ts`.
  const { racing, traffic } = partitionRoster(data.opponents);

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
  const opponentNames = racing.map(o => o.name);
  const [profiles, portraits] = await Promise.all([
    getDriverProfiles(opponentNames, decodedChampId),
    resolveDriverPortraits(opponentNames, decodedChampId),
  ]);

  // A row is a car *in a class*, not a car. The same model is often homologated for
  // more than one of them — the 458, the Vantage and the RSR each ran in both LMGTE
  // Pro and LMGTE Am in 2015 — so keying rows on the car alone would file the Am
  // crews under Pro and show one badge over both.
  const multiClass = isMultiClass(data.opponents);
  const classRank = orderedClasses(data.opponents);
  const carDriverMap = new Map<string, { car: string; raceClass: string; drivers: LineupDriver[] }>();

  for (const opponent of racing) {
    const raceClass = classOfEntry(opponent);
    const key = JSON.stringify([opponent.car, raceClass]);
    const driverInfo: LineupDriver = {
      name: opponent.name,
      nation: opponent.nation,
      profile: profiles.get(opponent.name) ?? null,
      portrait: portraits.get(opponent.name) ?? null,
      championshipWins: championWins.get(opponent.name) || 0,
      isReigningChampion: opponent.name === reigningChampion,
    };

    if (!carDriverMap.has(key)) {
      carDriverMap.set(key, { car: opponent.car, raceClass, drivers: [] });
    }
    carDriverMap.get(key)!.drivers.push(driverInfo);
  }

  // Convert to array and sort by car name
  // Rows are car-and-class, so a model entered in two classes is two rows but one
  // car; the count in the header is of cars.
  const distinctCars = new Set([...carDriverMap.values()].map(row => row.car)).size;

  const carsWithDrivers = Array.from(carDriverMap.entries())
    .map(([key, { car: carName, raceClass, drivers }]) => {
      // The row's stat line quotes the car's own UI specs, so anything a mod
      // leaves out drops off the line rather than showing a blank. A zeroed
      // figure ("0 km/h") is a mod's unfilled field, not a real number.
      const specs = (getCarData(carName)?.specs ?? {}) as Record<string, string>;
      const spec = (value?: string) =>
        value && !/^0[\s.]/.test(value.trim()) ? value.trim() : undefined;
      const stats = [
        { label: "Power", value: [spec(specs.bhp), spec(specs.torque)].filter(Boolean).join(" / ") },
        { label: "Weight", value: spec(specs.weight) },
        { label: "Top Speed", value: spec(specs.topspeed) },
      ].filter((stat) => stat.value);

      return {
        key,
        carName,
        carDetails: getCarDetails(carName),
        preview: getCarPreviewUrl(carName),
        stats,
        drivers,
        raceClass,
      };
    })
    // Fastest class first, then by brand within it — an endurance entry list reads
    // top class downwards, and a GT car among the prototypes reads as a mistake.
    .sort((a, b) => {
      const rank = classRank.indexOf(a.raceClass) - classRank.indexOf(b.raceClass);
      return rank !== 0 ? rank : a.carDetails.brand.localeCompare(b.carDetails.brand);
    });

  // The traffic is tallied by car rather than named. What matters about it is how
  // much of it is out there and what shape it is, not who is behind the wheel.
  const trafficCars = Array.from(
    traffic.reduce(
      (tally, entry) => tally.set(entry.car, (tally.get(entry.car) ?? 0) + 1),
      new Map<string, number>()
    )
  )
    .map(([carName, count]) => ({
      carName,
      count,
      carDetails: getCarDetails(carName),
      preview: getCarPreviewUrl(carName),
    }))
    .sort((a, b) => a.carDetails.brand.localeCompare(b.carDetails.brand));

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Header. The banner is the section's own background rather than a card's
          right-hand column, so it runs the full width of the window and fades in
          over the first 40% of it. */}
      <section className="relative isolate overflow-hidden border-b border-zinc-700">
        {championship.bannerUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={championship.bannerUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 h-full w-full object-cover [-webkit-mask-image:linear-gradient(to_right,transparent_40%,black_85%)] [mask-image:linear-gradient(to_right,transparent_40%,black_85%)]"
          />
        )}
        <div className="w-full px-4 pt-4 pb-8 sm:px-6 lg:px-8 xl:px-12">
          <BackButton
            fallbackUrl={`/championship/${encodeURIComponent(
              decodedChampId
            )}/season/${encodeURIComponent(decodedSeasonId)}`}
          >
            Back to Season
          </BackButton>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold px-2 py-1 rounded bg-purple-500/20 text-purple-400 uppercase">
              Drivers Lineup
            </span>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 uppercase">
              {season.seasonName}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
            {data.name}
          </h1>
          <div className="text-sm text-zinc-400">
            {racing.length} drivers competing in {distinctCars} different cars
            {traffic.length > 0 && (
              <span className="text-zinc-500">
                {" "}· {traffic.length} cars of traffic sharing the road
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {/* One full-width row per car: the preview, then the car's badge over its
            data, then the drivers filling the rest of the row. */}
        <div className="space-y-4">
          {carsWithDrivers.map(({ key, carName, carDetails, preview, stats, drivers, raceClass }) => {
            // Two or three drivers to a car leave room to read, so they get the
            // roomy card; a full works team of five needs the compact one.
            const extended = drivers.length <= 3;

            // The cards split whatever width the car's columns leave, so a pair
            // takes half each instead of sitting in a rank of empty slots.
            const columnClass = [
              "xl:grid-cols-1",
              "xl:grid-cols-2",
              "xl:grid-cols-3",
              "xl:grid-cols-4",
              "xl:grid-cols-5",
            ][Math.min(drivers.length, 5) - 1];

            return (
            <div
              key={key}
              className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 flex flex-col gap-4 xl:flex-row xl:items-stretch"
            >
              {/* Car preview, run to the full height of the row */}
              <Link
                href={`/car/${encodeURIComponent(carName)}`}
                className="relative flex-shrink-0 w-full aspect-video xl:aspect-auto xl:w-64 group"
              >
                {preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={preview}
                    alt={carDetails.name}
                    className="absolute inset-0 h-full w-full object-cover rounded-lg border border-zinc-700 transition-colors group-hover:border-purple-500/60"
                  />
                ) : (
                  <div className="absolute inset-0 rounded-lg border border-dashed border-zinc-700 flex items-center justify-center text-xs text-zinc-600">
                    No preview
                  </div>
                )}
              </Link>

              {/* Car badge over its identity and specs */}
              <Link
                href={`/car/${encodeURIComponent(carName)}`}
                className="flex-shrink-0 w-full xl:w-64 group"
                title={carDetails.name}
              >
                <Image
                  src={`/badges/${carName}.png`}
                  alt={carDetails.brand}
                  width={72}
                  height={72}
                  className="mb-2 rounded-lg transition-transform group-hover:scale-105"
                  // A badge that isn't square keeps its shape rather than being
                  // squeezed into the 72px box.
                  style={{ width: 72, height: "auto" }}
                  unoptimized
                />
                {multiClass && (
                  <div className="mb-1 inline-block rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                    {raceClass}
                  </div>
                )}
                <div className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                  {carDetails.brand}
                </div>
                <div className="text-sm text-zinc-300">
                  {carDetails.model}
                  {carDetails.year && (
                    <span className="text-zinc-500"> · {carDetails.year}</span>
                  )}
                </div>
                {stats.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {stats.map((stat) => (
                      <div key={stat.label}>
                        <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                          {stat.label}
                        </div>
                        <div className="text-xs font-semibold text-zinc-300 whitespace-nowrap">
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Link>

              {/* Drivers, one rank across the rest of the row once the layout
                  goes horizontal. */}
              <div
                className={`flex-1 grid gap-3 ${
                  extended
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-3"
                } ${columnClass}`}
              >
                {drivers.map((driver) => (
                  <LineupDriverCard
                    key={driver.name}
                    driver={driver}
                    extended={extended}
                    fillHeight={drivers.length <= 2}
                  />
                ))}
              </div>
            </div>
            );
          })}
        </div>

        {/* The traffic. Present in every session, entered in none of them: it takes
            a pit box and gets in the way, and the standings never see it. */}
        {trafficCars.length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-lg font-bold text-white">On the road</h2>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-500/20 text-amber-400 uppercase">
                Traffic · not scored
              </span>
            </div>
            <p className="text-sm text-zinc-400 mb-4 max-w-3xl">
              These cars start every round and contest none of them. They fill pit
              boxes and they get in the way; the championship table looks straight
              past them, and the drivers behind them close ranks so a place lost to
              traffic is not a place lost in the standings.
            </p>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {trafficCars.map(({ carName, count, carDetails, preview }) => (
                <Link
                  key={carName}
                  href={`/car/${encodeURIComponent(carName)}`}
                  className="group bg-zinc-800/40 border border-zinc-700/70 rounded-lg overflow-hidden transition-colors hover:border-amber-500/50"
                >
                  <div className="relative aspect-video">
                    {preview ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={preview}
                        alt={carDetails.name}
                        className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-100"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600">
                        No preview
                      </div>
                    )}
                    <span className="absolute top-1.5 right-1.5 rounded bg-zinc-900/80 px-1.5 py-0.5 text-xs font-mono font-semibold text-amber-400">
                      ×{count}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <div className="text-sm font-semibold text-white truncate group-hover:text-amber-400 transition-colors">
                      {carDetails.brand}
                    </div>
                    <div className="text-xs text-zinc-400 truncate">
                      {carDetails.model}
                      {carDetails.year && (
                        <span className="text-zinc-600"> · {carDetails.year}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
