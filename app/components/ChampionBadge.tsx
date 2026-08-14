import Image from 'next/image';

interface ChampionBadgeProps {
  name: string;
  /**
   * Portrait URL already resolved on the server (see lib/driver-assets).
   * `null` means the driver has no portrait, so the initial stands in for one.
   */
  portrait: string | null;
}

/**
 * The champion of a completed season, wherever one is summarised: their portrait,
 * then their name over its legend, then the trophy closing the row.
 */
export default function ChampionBadge({ name, portrait }: ChampionBadgeProps) {
  return (
    <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
      {portrait ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={portrait}
          alt=""
          aria-hidden="true"
          className="h-11 w-11 shrink-0 rounded-full border border-yellow-500/30 object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-yellow-500/30 bg-zinc-800 text-base font-semibold text-zinc-500">
          {name.charAt(0)}
        </div>
      )}

      <div className="min-w-0 text-sm">
        <div className="text-yellow-500 font-semibold truncate">{name}</div>
        <div className="text-yellow-400/70 text-xs">Champion</div>
      </div>

      <Image
        src="/trophy.svg"
        alt="Champion"
        width={24}
        height={24}
        className="shrink-0 drop-shadow-lg"
      />
    </div>
  );
}
