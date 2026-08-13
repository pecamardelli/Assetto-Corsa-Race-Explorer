/**
 * The look of one row in a round's actions menu, shared by the entries the menu
 * builds itself and by the ones a component contributes (the race setup editor
 * keeps its own row so the settings load on the click that opens it).
 */

export const MENU_ITEM_CLASS =
  'flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-medium ' +
  'text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed ' +
  'disabled:opacity-40 disabled:hover:bg-transparent';

/** A row's 24x24 stroked icon, the only splash of colour in the list. */
export function MenuItemIcon({ path, tone }: { path: string; tone: string }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 ${tone}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}
