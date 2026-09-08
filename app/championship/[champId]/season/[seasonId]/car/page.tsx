import { notFound } from "next/navigation";
import BackButton from "../../../../../components/BackButton";
import CarPicker, { type ChampCar } from "../../../../../components/CarPicker";
import { getCarDetails } from "../../../../../lib/car-data";
import { resolvePlayerName } from "../../../../../lib/driver-assets";
import { readSeasonPlayerCar } from "../../../../../lib/launch/assists";
import { readInstalledCars } from "../../../../../lib/launch/car-catalog";
import { getChampionship } from "../../../../../lib/race-data";
import { usesTrafficMode } from "../../../../../lib/traffic";

/**
 * The car this season's rounds are driven in.
 *
 * Only offered on a road season — one whose rounds go out in the Test Drive mode. A
 * championship is its cars as much as its drivers: swapping one out mid-season would
 * make nonsense of a constructors' table and of every result already on file against
 * the old one. A Challenge has neither, and the car is the whole question it asks.
 */

// The pick is read off disk and written back by this page's own picker.
export const dynamic = "force-dynamic";

export default async function SeasonCarPage({
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

  const season = championship.seasons.find(
    (s) =>
      s.seasonName.toLowerCase().replace(" ", "_") ===
      decodedSeasonId.toLowerCase()
  );

  if (!season) {
    notFound();
  }

  const seasonFolder = `season_${String(season.seasonNumber).padStart(2, "0")}`;
  const roadSeason = season.data.rounds.some(usesTrafficMode);

  const playerName = await resolvePlayerName();
  const seasonEntry = season.data.opponents.find(
    (entry) => entry.name === playerName || entry.name === "PLAYER"
  );

  // The install is only read for a season that may actually pick from it.
  const [cars, pick] = roadSeason
    ? await Promise.all([
        readInstalledCars(),
        readSeasonPlayerCar(championship.folderName, seasonFolder),
      ])
    : [[], null];

  const champCar: ChampCar | null = seasonEntry
    ? {
        id: seasonEntry.car,
        name: getCarDetails(seasonEntry.car).name,
        skin: seasonEntry.skin ?? "",
      }
    : null;

  const seasonUrl = `/championship/${encodeURIComponent(
    decodedChampId
  )}/season/${encodeURIComponent(decodedSeasonId)}`;

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
          <BackButton fallbackUrl={seasonUrl}>Back to Season</BackButton>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded bg-cyan-500/20 px-2 py-1 text-xs font-semibold uppercase text-cyan-400">
              Your Car
            </span>
            <span className="rounded bg-green-500/20 px-2 py-1 text-xs font-semibold uppercase text-green-400">
              {season.seasonName}
            </span>
          </div>
          <h1 className="mb-2 text-4xl font-bold text-white drop-shadow-lg">
            {season.data.name}
          </h1>
          <p className="max-w-3xl text-zinc-400">
            The car you take out for every round of this season, chosen from
            everything Assetto Corsa has installed. The season&apos;s .champ file
            is left alone — dropping the pick puts you back in the car it entered
            you in.
          </p>
        </div>
      </section>

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {!roadSeason ? (
          <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
            This season is not run in the Test Drive mode, so its cars are the
            championship&apos;s and not yours to swap. Edit the .champ file if a
            car needs changing here.
          </p>
        ) : !champCar ? (
          <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
            This season has no entry for &ldquo;{playerName}&rdquo;, so there is no
            seat to put a car in. Set AC_PLAYER_NAME, or add the driver to the
            .champ.
          </p>
        ) : (
          <CarPicker
            scope={{ champId: championship.folderName, seasonId: seasonFolder }}
            cars={cars}
            champCar={champCar}
            initialPick={pick}
            playerName={playerName}
          />
        )}
      </div>
    </div>
  );
}
