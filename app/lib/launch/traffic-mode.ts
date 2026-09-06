/**
 * Setting the car count and the cast list on the Test Drive mode before a launch.
 *
 * The mode keeps its settings in its own folder inside the Assetto Corsa install, not
 * in `Documents`, and CSP reads that file directly — there is no user-side override to
 * write instead. So the launcher edits the installed file, which means two rules.
 *
 * One: **change the keys asked for and nothing else.** Every other setting there was
 * tuned by hand and several of them are load-bearing (`AI_AVOIDANCE`, `LANE_KEEPING`).
 * Rewriting the file from a template would silently revert them, so this is a
 * line-level substitution that keeps unknown keys, ordering, comments, spacing and line
 * endings exactly as they were.
 *
 * Two: back it up first, on the same one-deep policy as `race.ini` and `assists.ini`.
 */

/** Split a line into its content and its terminator, so the terminator survives. */
function splitEol(line: string): [content: string, eol: string] {
  const match = /\r?\n$/.exec(line);
  return match ? [line.slice(0, match.index), match[0]] : [line, ''];
}

/**
 * Replace one `KEY=value` in an existing settings.ini, leaving the rest of the file
 * byte-identical apart from that one value.
 *
 * Appends the key under the `[SETTINGS]` header if the file lacks it, so a hand-trimmed
 * file still ends up with what the launch asked for.
 */
export function setTrafficKey(existing: string, key: string, value: string): string {
  // Split after each newline so every element carries its own terminator. Note that a
  // JavaScript `$` without the `m` flag anchors to the end of the *string*, not to the
  // end of a line before a trailing newline the way Perl and Python do, so matching
  // against these lines has to strip the terminator by hand first.
  const lines = existing.split(/(?<=\n)/);
  const pattern = new RegExp(`^(\\s*${key}\\s*=\\s*)([^;]*)(.*)$`);

  let replaced = false;
  const out = lines.map(line => {
    if (replaced) return line;

    const [content, eol] = splitEol(line);
    // key, separator, then the value up to an optional `;` comment.
    const match = pattern.exec(content);
    if (!match) return line;

    replaced = true;
    // Whatever sat between the old value and its comment is spacing, not value, and
    // putting it back is what keeps `100 ; Number of…` from becoming `102; Number of…`.
    // An empty old value has no spacing to keep, so a comment that followed it directly
    // gets one space, or the new value would run into the `;`.
    const spacing = /\s*$/.exec(match[2])?.[0] ?? '';
    const gap = spacing === '' && match[3].startsWith(';') ? ' ' : spacing;
    return `${match[1]}${value}${gap}${match[3]}${eol}`;
  });

  if (replaced) return out.join('');

  const eol = existing.includes('\r\n') ? '\r\n' : '\n';

  // Appending to the end of the file would drop the key into whatever section happens
  // to be last, so put it directly under the [SETTINGS] header when there is one.
  const header = lines.findIndex(line => /^\s*\[SETTINGS\]/.test(line));
  if (header !== -1) {
    const before = lines.slice(0, header + 1).join('');
    const after = lines.slice(header + 1).join('');
    const gap = before.endsWith('\n') ? '' : eol;
    return `${before}${gap}${key}=${value}${eol}${after}`;
  }

  const gap = existing === '' || existing.endsWith('\n') ? '' : eol;
  return `${existing}${gap}[SETTINGS]${eol}${key}=${value}${eol}`;
}

/** The car count (`TRAFFIC_DENSITY`). */
export function setTrafficDensity(existing: string, cars: number): string {
  return setTrafficKey(existing, 'TRAFFIC_DENSITY', String(Math.round(cars)));
}

/**
 * The cast list (`TRAFFIC_CARS`): `id:weight,id:weight,...`, or empty for every
 * installed model. See `traffic-fleet.ts` for where it comes from and the mode's
 * `castFleet` for how it is read.
 */
export function setTrafficCars(existing: string, spec: string): string {
  return setTrafficKey(existing, 'TRAFFIC_CARS', spec);
}
