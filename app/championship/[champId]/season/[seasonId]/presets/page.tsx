import { notFound } from "next/navigation";
import AssistsEditor from "../../../../../components/AssistsEditor";
import BackButton from "../../../../../components/BackButton";
import { resolveAssists } from "../../../../../lib/launch/assists";
import { getChampionship } from "../../../../../lib/race-data";

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        <div className="mb-8">
          <BackButton
            fallbackUrl={`/championship/${encodeURIComponent(
              decodedChampId
            )}/season/${encodeURIComponent(decodedSeasonId)}`}
          >
            Back to Season
          </BackButton>

          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6">
            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 uppercase">
              {season.seasonName}
            </span>
            <h1 className="mt-3 mb-2 text-4xl font-bold text-white">
              {season.data.name}
            </h1>
            <p className="text-zinc-400">
              Game presets for this season&apos;s launches — driving aids and
              realism settings.
            </p>
          </div>
        </div>

        <AssistsEditor
          initial={assists}
          initialSource={source}
          scope={{ champId: championship.folderName, seasonId: seasonFolder }}
        />
      </div>
    </div>
  );
}
