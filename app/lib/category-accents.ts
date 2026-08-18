/**
 * A category's colour, as whole Tailwind class strings.
 *
 * Tailwind only builds classes it can read in the source, so an accent cannot be
 * spliced together from the colour name in categories.json — `text-${accent}-400`
 * would compile to nothing. Every class a category can wear is therefore written
 * out here in full, and categories.json picks one of these stems by name.
 *
 * Shared by the category rows on the front page, the category's own page and the
 * championship cards beneath it, so a category looks the same wherever it turns up.
 */
export interface Accent {
  /** Border and glow on a card at rest and on hover. */
  card: string;
  /** The heading, and the arrow that goes with it, on hover. */
  title: string;
  /** Counts and other figures that should carry the colour outright. */
  count: string;
  /** A thin rule beside a section heading. */
  rule: string;
  /** A small pill: the category's name shown on a page it is not the subject of. */
  chip: string;
}

export const ACCENTS: Record<string, Accent> = {
  cyan: {
    card: 'hover:border-cyan-600 hover:shadow-lg hover:shadow-cyan-500/10',
    title: 'group-hover:text-cyan-400',
    count: 'text-cyan-400',
    rule: 'bg-cyan-500/40',
    chip: 'bg-cyan-500/20 text-cyan-300',
  },
  amber: {
    card: 'hover:border-amber-600 hover:shadow-lg hover:shadow-amber-500/10',
    title: 'group-hover:text-amber-400',
    count: 'text-amber-400',
    rule: 'bg-amber-500/40',
    chip: 'bg-amber-500/20 text-amber-300',
  },
  sky: {
    card: 'hover:border-sky-600 hover:shadow-lg hover:shadow-sky-500/10',
    title: 'group-hover:text-sky-400',
    count: 'text-sky-400',
    rule: 'bg-sky-500/40',
    chip: 'bg-sky-500/20 text-sky-300',
  },
  emerald: {
    card: 'hover:border-emerald-600 hover:shadow-lg hover:shadow-emerald-500/10',
    title: 'group-hover:text-emerald-400',
    count: 'text-emerald-400',
    rule: 'bg-emerald-500/40',
    chip: 'bg-emerald-500/20 text-emerald-300',
  },
  rose: {
    card: 'hover:border-rose-600 hover:shadow-lg hover:shadow-rose-500/10',
    title: 'group-hover:text-rose-400',
    count: 'text-rose-400',
    rule: 'bg-rose-500/40',
    chip: 'bg-rose-500/20 text-rose-300',
  },
  violet: {
    card: 'hover:border-violet-600 hover:shadow-lg hover:shadow-violet-500/10',
    title: 'group-hover:text-violet-400',
    count: 'text-violet-400',
    rule: 'bg-violet-500/40',
    chip: 'bg-violet-500/20 text-violet-300',
  },
  zinc: {
    card: 'hover:border-zinc-500 hover:shadow-lg hover:shadow-zinc-400/10',
    title: 'group-hover:text-zinc-300',
    count: 'text-zinc-300',
    rule: 'bg-zinc-500/40',
    chip: 'bg-zinc-500/20 text-zinc-300',
  },
};

export function accentFor(name: string | undefined): Accent {
  return (name && ACCENTS[name]) || ACCENTS.zinc;
}
