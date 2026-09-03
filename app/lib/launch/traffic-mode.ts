/**
 * Setting the car count on the Test Drive mode before a launch.
 *
 * The mode keeps its settings in its own folder inside the Assetto Corsa install, not
 * in `Documents`, and CSP reads that file directly — there is no user-side override to
 * write instead. So the launcher edits the installed file, which means two rules.
 *
 * One: **change the one key and nothing else.** Every other setting there was tuned by
 * hand and several of them are load-bearing (`AI_AVOIDANCE`, `LANE_KEEPING`). Rewriting
 * the file from a template would silently revert them, so this is a line-level
 * substitution that keeps unknown keys, ordering, comments, spacing and line endings
 * exactly as they were.
 *
 * Two: back it up first, on the same one-deep policy as `race.ini` and `assists.ini`.
 */

const KEY = 'TRAFFIC_DENSITY';

/** Split a line into its content and its terminator, so the terminator survives. */
function splitEol(line: string): [content: string, eol: string] {
  const match = /\r?\n$/.exec(line);
  return match ? [line.slice(0, match.index), match[0]] : [line, ''];
}

/**
 * Replace the `TRAFFIC_DENSITY` value in an existing settings.ini, leaving the rest of
 * the file byte-identical apart from that one number.
 *
 * Appends the key under the `[SETTINGS]` header if the file lacks it, so a hand-trimmed
 * file still ends up with the count the launch asked for.
 */
export function setTrafficDensity(existing: string, cars: number): string {
  const value = String(Math.round(cars));
  // Split after each newline so every element carries its own terminator. Note that a
  // JavaScript `$` without the `m` flag anchors to the end of the *string*, not to the
  // end of a line before a trailing newline the way Perl and Python do, so matching
  // against these lines has to strip the terminator by hand first.
  const lines = existing.split(/(?<=\n)/);

  let replaced = false;
  const out = lines.map(line => {
    if (replaced) return line;

    const [content, eol] = splitEol(line);
    // key, separator, then the value up to an optional `;` comment.
    const match = /^(\s*TRAFFIC_DENSITY\s*=\s*)([^;]*)(.*)$/.exec(content);
    if (!match) return line;

    replaced = true;
    // Whatever sat between the old value and its comment is spacing, not value, and
    // putting it back is what keeps `100 ; Number of…` from becoming `102; Number of…`.
    const spacing = /\s*$/.exec(match[2])?.[0] ?? '';
    return `${match[1]}${value}${spacing}${match[3]}${eol}`;
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
    return `${before}${gap}${KEY}=${value}${eol}${after}`;
  }

  const gap = existing === '' || existing.endsWith('\n') ? '' : eol;
  return `${existing}${gap}[SETTINGS]${eol}${KEY}=${value}${eol}`;
}
