import Link from "next/link";
import { notFound } from "next/navigation";
import AssistsEditor from "../../../../../components/AssistsEditor";
import BackButton from "../../../../../components/BackButton";
import LineupPicker, {
  type LineupEntry,
} from "../../../../../components/LineupPicker";
import { getCarDetails } from "../../../../../lib/car-data";
import { resolvePlayerName } from "../../../../../lib/driver-assets";
import {
  readSeasonLineup,
  readSeasonPlayerCar,
  resolveAssists,
  resolveTraffic,
} from "../../../../../lib/launch/assists";
import { getChampionship } from "../../../../../lib/race-data";
import { usesTrafficMode } from "../../../../../lib/traffic";

// Always read the config from disk; this page is the editor for it.
export const dynamic = "force-dynamic";

export default async function SeasonPresetsPage({
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

  // The folder the season's files live under, which also names its presets file.
  const seasonFolder = `season_${String(season.seasonNumber).padStart(2, "0")}`;
  const { assists, source } = await resolveAssists(
    championship.folderName,
    seasonFolder
  );
  const { traffic } = await resolveTraffic(championship.folderName, seasonFolder);

  // The lineup: every roster entry, with the player's own marked so the picker keeps it.
  const lineup = await readSeasonLineup(championship.folderName, seasonFolder);
  const playerName = await resolvePlayerName();

  // A road season may put the player in a car of its own choosing; the choosing itself
  // needs a page of its own, so this only reports what it settled on.
  const roadSeason = season.data.rounds.some(usesTrafficMode);
  const playerCar = roadSeason
    ? await readSeasonPlayerCar(championship.folderName, seasonFolder)
    : null;
  const seasonEntry = season.data.opponents.find(
    (entry) => entry.name === playerName || entry.name === "PLAYER"
  );
  const drivenCar = playerCar?.car ?? seasonEntry?.car ?? "";
  const roster: LineupEntry[] = season.data.opponents.map((entry) => ({
    name: entry.name,
    car: getCarDetails(entry.car).name,
    nation: entry.nation,
    traffic: entry.traffic === true,
    player: entry.name === playerName || entry.name === "PLAYER",
  }));

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
        <div className="w-full max-w-4xl px-4 pt-4 pb-8 sm:px-6 lg:px-8 xl:px-12">
          <BackButton
            fallbackUrl={`/championship/${encodeURIComponent(
              decodedChampId
            )}/season/${encodeURIComponent(decodedSeasonId)}`}
          >
            Back to Season
          </BackButton>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 uppercase">
              Game Presets
            </span>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 uppercase">
              {season.seasonName}
            </span>
          </div>
          <h1 className="mb-2 text-4xl font-bold text-white drop-shadow-lg">
            {season.data.name}
          </h1>
          <p className="text-zinc-400">
            Game presets for this season&apos;s launches — who goes out, driving
            aids, realism settings and how busy a road in traffic gets.
          </p>
        </div>
      </section>

      <div className="w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {roadSeason && drivenCar && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Your car</h2>
                <p className="text-sm text-zinc-400">
                  {getCarDetails(drivenCar).name}
                  {playerCar ? " — this season's own pick" : " — from the .champ"}.
                </p>
              </div>
              <Link
                href={`/championship/${encodeURIComponent(
                  decodedChampId
                )}/season/${encodeURIComponent(decodedSeasonId)}/car`}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-400 hover:bg-zinc-700"
              >
                Choose a car…
              </Link>
            </div>
          </div>
        )}
        <LineupPicker
          roster={roster}
          initialExcluded={lineup.excluded}
          scope={{ champId: championship.folderName, seasonId: seasonFolder }}
        />
        <AssistsEditor
          initial={assists}
          initialTraffic={traffic}
          initialSource={source}
          scope={{ champId: championship.folderName, seasonId: seasonFolder }}
        />
      </div>
    </div>
  );
}
