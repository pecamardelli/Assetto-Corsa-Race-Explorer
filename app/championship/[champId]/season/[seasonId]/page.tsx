import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getChampionship } from "../../../../lib/race-data";
import { getTrackDetails } from "../../../../lib/track-data";
import { getCarName } from "../../../../lib/car-data";
import { calculateStandings } from "../../../../lib/standings";
import { Championship, RaceSession } from "../../../../types/race";
import BackButton from "../../../../components/BackButton";
import FlagIcon from "../../../../components/FlagIcon";
import RoundLaunchButtons, {
  LaunchProvider,
} from "../../../../components/RaceLauncher";

/**
 * Marks a session the driver left before it ran its course, so a partial result is
 * not mistaken for a real one. Sessions recorded before this was tracked carry no
 * flag at all and stay unmarked.
 */
function UnfinishedBadge({ session }: { session: RaceSession | null }) {
  if (!session || session.data.session_info.finished !== false) return null;

  return (
    <span
      className="inline-flex items-center px-2 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-semibold"
      title="Assetto Corsa was closed before this session ended"
    >
      Unfinished
    </span>
  );
}

export default async function SeasonPage({
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

  const { data, sessions } = season;

  // Count only race sessions (not practice or qualifying)
  const completedRaces = sessions.filter((session) => {
    const sessionType =
      session.data.session_type || session.data.session_info.session_type;
    return sessionType === "race";
  }).length;

  // Check if season is completed and get champion
  const isCompleted = completedRaces === data.rounds.length;
  let champion: string | null = null;

  if (isCompleted && sessions.length > 0) {
    // Create a temporary Championship object for this season only
    const seasonChampionship: Championship = {
      id: "temp",
      data: season.data,
      folderName: "temp",
      sessions: season.sessions,
      seasons: [season],
    };

    const standings = calculateStandings(seasonChampionship);
    champion = standings.length > 0 ? standings[0].name : null;
  }

  // Get season start and end dates from race sessions
  let startDate: string | null = null;
  let endDate: string | null = null;

  if (sessions.length > 0) {
    // Sort sessions by date to get first and last
    const sortedSessions = [...sessions].sort((a, b) => {
      const dateA = new Date(a.data.session_info.date).getTime();
      const dateB = new Date(b.data.session_info.date).getTime();
      return dateA - dateB;
    });

    const firstSession = sortedSessions[0];
    const lastSession = sortedSessions[sortedSessions.length - 1];

    // Format dates
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    startDate = formatDate(firstSession.data.session_info.date);
    endDate = formatDate(lastSession.data.session_info.date);
  }

  // Match rounds with sessions based on track name and session type
  const roundsWithSessions = data.rounds.map((round, index) => {
    // Match by track name (the full round.track includes config, e.g., "ks_brands_hatch-indy")
    const trackWithConfig = round.track; // e.g., "ks_brands_hatch-indy"

    // Parse track name and config for getTrackDetails
    const parts = trackWithConfig.split("-");
    const trackConfig = parts.length > 1 ? parts[parts.length - 1] : undefined;
    const baseTrackName =
      parts.length > 1 ? parts.slice(0, -1).join("-") : trackWithConfig;

    // Get track details
    const trackDetails = getTrackDetails(baseTrackName, trackConfig);

    // Find practice, qualifying, and race sessions for this round
    const practiceSessions = sessions.filter((session) => {
      const filename = session.filename.split("/").pop() || "";
      const sessionType =
        session.data.session_type || session.data.session_info.session_type;
      return filename.includes(trackWithConfig) && sessionType === "practice";
    });

    const qualifyingSessions = sessions.filter((session) => {
      const filename = session.filename.split("/").pop() || "";
      const sessionType =
        session.data.session_type || session.data.session_info.session_type;
      return filename.includes(trackWithConfig) && sessionType === "qualifying";
    });

    const raceSessions = sessions.filter((session) => {
      const filename = session.filename.split("/").pop() || "";
      const sessionType =
        session.data.session_type || session.data.session_info.session_type;
      return filename.includes(trackWithConfig) && sessionType === "race";
    });

    return {
      round,
      roundNumber: index + 1,
      trackDetails,
      practice: practiceSessions.length > 0 ? practiceSessions[0] : null,
      qualifying: qualifyingSessions.length > 0 ? qualifyingSessions[0] : null,
      race: raceSessions.length > 0 ? raceSessions[0] : null,
      hasAnySessions:
        practiceSessions.length > 0 ||
        qualifyingSessions.length > 0 ||
        raceSessions.length > 0,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton
            fallbackUrl={`/championship/${encodeURIComponent(
              decodedChampId
            )}/seasons`}
          >
            Back to Seasons
          </BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 uppercase">
                  {season.seasonName}
                </span>
                {startDate && endDate && (
                  <span className="text-xs text-zinc-400">
                    {startDate} - {endDate}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/championship/${encodeURIComponent(
                    decodedChampId
                  )}/seasons`}
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-green-500/20 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  All Seasons
                </Link>
                <Link
                  href={`/championship/${encodeURIComponent(
                    decodedChampId
                  )}/season/${encodeURIComponent(decodedSeasonId)}/lineup`}
                  className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/20 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Drivers Lineup
                </Link>
                <Link
                  href={`/championship/${encodeURIComponent(
                    decodedChampId
                  )}/season/${encodeURIComponent(decodedSeasonId)}/standings`}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-amber-500/20 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Driver Standings
                </Link>
                <Link
                  href={`/championship/${encodeURIComponent(
                    decodedChampId
                  )}/season/${encodeURIComponent(
                    decodedSeasonId
                  )}/constructors`}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/20 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  Constructor Standings
                </Link>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">{data.name}</h1>
            <div className="text-xl text-green-400 mb-4">
              {season.seasonName}
              {isCompleted && (
                <span className="ml-2 text-sm text-green-400">• Completed</span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm items-center">
              <div>
                <span className="text-zinc-500 block mb-1">Total Rounds</span>
                <span className="text-white font-medium">
                  {data.rounds.length}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Drivers</span>
                <span className="text-white font-medium">
                  {data.opponents.length}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Completed</span>
                <span className="text-white font-medium">
                  {completedRaces}/{data.rounds.length}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Qualifying</span>
                <span className="text-white font-medium">
                  {data.rules.qualifying} min
                </span>
              </div>
              {isCompleted && champion && (
                <div className="col-span-2 md:col-span-1">
                  <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                    <Image
                      src="/trophy.svg"
                      alt="Champion"
                      width={24}
                      height={24}
                      className="drop-shadow-lg"
                    />
                    <div className="text-sm">
                      <div className="text-yellow-500 font-semibold">
                        {champion}
                      </div>
                      <div className="text-yellow-400/70 text-xs">Champion</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rounds List */}
        <LaunchProvider
          champId={decodedChampId}
          seasonId={decodedSeasonId}
        >
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-zinc-700">
            <h2 className="text-2xl font-bold text-white">
              Championship Rounds
            </h2>
          </div>

          <div className="divide-y divide-zinc-700">
            {roundsWithSessions.map(
              ({
                round,
                roundNumber,
                trackDetails,
                practice,
                qualifying,
                race,
                hasAnySessions,
              }) => {
                // Get the race date (prefer race session, fall back to qualifying, then practice)
                const sessionForDate = race || qualifying || practice;
                const raceDate = sessionForDate
                  ? new Date(
                      sessionForDate.data.session_info.date
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : null;

                // A round that already has a race behind it has nothing left to
                // launch. One the driver quit out of still does.
                const raceCompleted =
                  !!race && race.data.session_info.finished !== false;

                return (
                  <div key={roundNumber} className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Track Info and Sessions.
                          Two columns: markers on the left (round badge, flag,
                          status icon) all sharing one edge, text on the right. */}
                      <div className="flex-1 grid grid-cols-[auto_1fr] items-center justify-items-start gap-x-3 gap-y-3">
                        {/* Round Number Badge */}
                        <div
                          className={`rounded px-3 py-1 text-xs font-bold ${
                            hasAnySessions
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-zinc-700/50 text-zinc-500"
                          }`}
                        >
                          R{roundNumber}
                        </div>

                        <div className="flex w-full items-center gap-3">
                          {/* Track Name */}
                          <div
                            className={`font-semibold text-lg flex-1 ${
                              hasAnySessions ? "text-white" : "text-zinc-400"
                            }`}
                          >
                            {trackDetails.name}
                          </div>

                          {/* Launch controls */}
                          <RoundLaunchButtons
                            round={roundNumber}
                            raceCompleted={raceCompleted}
                          />

                          {/* Race Date */}
                          {raceDate && (
                            <div className="text-xs text-zinc-400 bg-zinc-900/50 px-2 py-1 rounded">
                              {raceDate}
                            </div>
                          )}
                        </div>

                        {/* Country Flag */}
                        <div>
                          {trackDetails.country && (
                            <FlagIcon nation={trackDetails.country} />
                          )}
                        </div>

                        <div
                          className={`flex w-full items-center gap-3 text-sm ${
                            hasAnySessions ? "text-zinc-400" : "text-zinc-500"
                          }`}
                        >
                          {trackDetails.country && (
                            <span>
                              {trackDetails.city || trackDetails.country}
                            </span>
                          )}
                          {trackDetails.length && (
                            <>
                              <span>•</span>
                              <span>{trackDetails.length}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            {round.laps} {round.laps === 1 ? "lap" : "laps"}
                          </span>
                        </div>

                        {/* Session Links. Nothing sits in the marker column when
                            the round has been run, so it stays empty. */}
                        {hasAnySessions ? (
                          <>
                            <div />
                            <div className="flex w-full flex-wrap items-center gap-2">
                            {practice && (
                              <Link
                                href={`/race/${encodeURIComponent(
                                  practice.filename
                                )}`}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                  />
                                </svg>
                                Practice
                              </Link>
                            )}
                            {qualifying && (
                              <Link
                                href={`/race/${encodeURIComponent(
                                  qualifying.filename
                                )}`}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-all"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Qualifying
                              </Link>
                            )}
                            <UnfinishedBadge session={qualifying} />
                            {race &&
                              (() => {
                                // Find the race winner (position 1)
                                const drivers = race.data.driver_statistics;
                                const winner = Object.entries(drivers).find(
                                  ([_, stats]) => stats.position === 1
                                );
                                const winnerName = winner ? winner[0] : null;
                                const winnerCar =
                                  winner && winner[1].car_name
                                    ? getCarName(winner[1].car_name)
                                    : null;

                                return (
                                  <>
                                    <Link
                                      href={`/race/${encodeURIComponent(
                                        race.filename
                                      )}`}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all"
                                    >
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M5 3l14 9-14 9V3z"
                                        />
                                      </svg>
                                      Race
                                    </Link>
                                    <UnfinishedBadge session={race} />
                                    <Link
                                      href={`/fastest-lap/${encodeURIComponent(
                                        race.filename
                                      )}`}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-all"
                                    >
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M13 10V3L4 14h7v7l9-11h-7z"
                                        />
                                      </svg>
                                      Fastest Lap
                                    </Link>
                                    {winnerName && (
                                      <div className="inline-flex items-center gap-2 text-amber-400 text-sm font-medium">
                                        <Image
                                          src="/trophy.svg"
                                          alt="Winner"
                                          width={16}
                                          height={16}
                                          className="drop-shadow-lg"
                                        />
                                        <span className="font-semibold">
                                          {winnerName}
                                        </span>
                                        {winnerCar && (
                                          <span className="text-amber-400/70">
                                            • {winnerCar}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-5 h-5 text-zinc-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-zinc-500 text-sm font-medium">
                              Not Started
                            </span>
                          </>
                        )}
                      </div>

                      {/* Track Preview Image */}
                      <div className="flex-shrink-0">
                        <Image
                          src={`/track-previews/${trackDetails.identifier}.png`}
                          alt={trackDetails.name}
                          width={200}
                          height={112}
                          className="rounded-lg"
                          unoptimized
                        />
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
        </LaunchProvider>
      </div>
    </div>
  );
}
