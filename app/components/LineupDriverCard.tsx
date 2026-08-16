import Link from "next/link";
import DriverImage from "./DriverImage";
import FlagIcon from "./FlagIcon";
import { profileAge, type DriverProfile } from "../lib/driver-assets";

export interface LineupDriver {
  name: string;
  nation: string;
  profile: DriverProfile | null;
  portrait: string | null;
  championshipWins: number;
  isReigningChampion: boolean;
}

/**
 * A driver's entry in a season lineup row.
 *
 * Two drivers to a car leave room to read; five do not. The extended variant
 * sets the portrait beside the details, the compact one stacks them, and the
 * lineup picks between them by how many drivers share the car. One or two
 * drivers have height to spare, so their portrait takes all of it.
 */
export default function LineupDriverCard({
  driver,
  extended,
  fillHeight = false,
}: {
  driver: LineupDriver;
  extended: boolean;
  /** Grow the portrait to the card's full inner height instead of fixing it. */
  fillHeight?: boolean;
}) {
  const age = driver.profile ? profileAge(driver.profile) : null;

  return (
    <Link
      href={`/driver/${encodeURIComponent(driver.name)}`}
      className={`relative rounded-lg border transition-all group ${
        extended
          ? `flex gap-4 p-4 text-left ${fillHeight ? "items-stretch" : "items-start"}`
          : "flex flex-col items-center gap-2 p-3 text-center"
      } ${
        driver.isReigningChampion
          ? "bg-gradient-to-br from-amber-500/10 via-zinc-900/50 to-zinc-900/50 border-amber-500/50 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/20"
          : "bg-zinc-900/50 border-zinc-700/50 hover:border-purple-500/50 hover:bg-zinc-900/80"
      }`}
    >
      {/* Reigning Champion Crown Badge */}
      {driver.isReigningChampion && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-amber-400 rounded-full blur-md opacity-60 animate-pulse"></div>
            {/* Badge */}
            <div
              className={`relative flex items-center justify-center bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 rounded-full border-2 border-amber-300 shadow-xl ${
                extended ? "w-12 h-12" : "w-9 h-9"
              }`}
            >
              <svg
                className={`text-zinc-900 drop-shadow-md ${extended ? "w-7 h-7" : "w-5 h-5"}`}
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
            <div
              className={`absolute right-0 z-20 hidden group-hover:block w-max ${
                extended ? "top-14" : "top-11"
              }`}
            >
              <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                👑 REIGNING CHAMPION
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Driver Photo. On a solo or paired card it fills a stretched box, taken
          out of the flow so the portrait's own size can't set the card's height. */}
      {extended && fillHeight ? (
        <div className="relative flex-shrink-0 self-stretch aspect-square">
          <DriverImage
            driverName={driver.name}
            src={driver.portrait}
            className="absolute inset-0 h-full w-full rounded-lg border-2 border-zinc-700 object-cover object-top"
          />
        </div>
      ) : (
        <DriverImage
          driverName={driver.name}
          src={driver.portrait}
          className={
            extended
              ? "w-28 h-28 flex-shrink-0 rounded-lg border-2 border-zinc-700 object-cover object-top"
              : "w-20 h-20 rounded-full border-2 border-zinc-700 object-cover object-top"
          }
        />
      )}

      {/* Driver Info */}
      <div className={`min-w-0 ${extended ? "flex-1" : "w-full"}`}>
        <h3
          className={`font-bold leading-tight text-white group-hover:text-purple-400 transition-colors ${
            extended ? "text-xl" : "text-sm"
          }`}
          title={driver.profile?.name || driver.name}
        >
          {driver.profile?.name || driver.name}
        </h3>
        <div
          className={`flex items-center gap-1.5 mt-1 mb-2 ${
            extended ? "justify-start" : "justify-center"
          }`}
        >
          <FlagIcon nation={driver.nation} />
          {driver.profile?.nationality && (
            <span
              className={`truncate text-zinc-300 ${extended ? "text-sm" : "text-[11px]"}`}
              title={driver.profile.nationality}
            >
              {driver.profile.nationality}
            </span>
          )}
        </div>
        <div className={`flex flex-col gap-0.5 ${extended ? "text-sm" : "text-[11px]"}`}>
          {age !== null && (
            <div>
              <span className="text-zinc-500">Age: </span>
              <span className="text-zinc-300">{age}</span>
            </div>
          )}
          {driver.profile?.placeOfBirth && (
            <div className="truncate" title={driver.profile.placeOfBirth}>
              <span className="text-zinc-500">From: </span>
              <span className="text-zinc-300">{driver.profile.placeOfBirth}</span>
            </div>
          )}
          {driver.championshipWins > 0 && (
            <div className={`mt-1 flex ${extended ? "justify-start" : "justify-center"}`}>
              <span
                className={`inline-flex items-center gap-1 font-bold bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-900 rounded-full shadow-lg ${
                  extended ? "gap-1.5 px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
                }`}
                title={`${driver.championshipWins} Championship ${
                  driver.championshipWins === 1 ? "Win" : "Wins"
                }`}
              >
                <svg
                  className={extended ? "w-3.5 h-3.5" : "w-3 h-3"}
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
}
