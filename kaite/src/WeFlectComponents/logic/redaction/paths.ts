/**
 * Path detection + OS-username extraction.
 *
 * Design notes:
 *  - Windows separators: `[\\/]{1,2}` accepts single, doubled (JSON-escaped text
 *    pasted into a conversation), and forward-slash drive paths.
 *  - Drive-letter rules use a lookbehind so `https://` (the `s:` + `//`) is never
 *    mistaken for a drive path.
 *  - Segments-with-spaces: an INTERMEDIATE segment (one followed by another separator
 *    on the same line) may contain spaces (`.../Box-Box/Maxine Tran/checkpoints/...`);
 *    the FINAL segment may not, so a path never swallows the rest of the sentence.
 *  - Every claimed path's segments are scanned for name-shaped pieces
 *    (`tran_maxine`, `Maxine Tran`) which are emitted as entity seeds — gated later by
 *    the gazetteer / entity tying, so `notes_to_self.txt` seeds nothing that survives.
 */

import type { EntitySeed } from "./engine";
import { FIRST_NAMES, USERNAME_STOPLIST, foldToken } from "./gazetteers";

// Windows segment characters: anything a filename may hold except the separators, the
// NTFS-illegal characters and line breaks. WSEGNS ("no space") additionally excludes
// the space; see the header for which segments may contain one. Written as strings
// (not regex literals) because they are spliced into larger patterns below — hence
// the doubled backslashes.
const WSEG = `[^\\\\/:*?"<>|\\r\\n]`;
const WSEGNS = `[^\\\\/:*?"<>|\\r\\n ]`;
const WSEP = `[\\\\/]{1,2}`;
// A segment that may contain spaces only when another separator follows on this line.
const WSEG_SPACED = `(?:${WSEGNS}| (?=${WSEG}*${WSEP}))+`;

// POSIX segment characters. Terminators (quotes, brackets, punctuation-then-space)
// are excluded from the no-space variant so prose punctuation ends the path; the
// spaced variant (PSEG) may keep `,` / `;` because another `/` must follow on the line.
const PSEGNS = `[^\\\\/\\s:'"\`\\)\\]>,;]`;
const PSEG = `[^\\\\/\\r\\n:'"\`\\)\\]>]`;
const PSEG_SPACED = `(?:${PSEGNS}| (?=${PSEG}*/))+`;

/** `C:\Users\<user>\...` (or `C:/Users/<user>/...`) — captures the username. */
export const RX_WINDOWS_USER = new RegExp(
  `(?<![A-Za-z0-9])[A-Za-z]:${WSEP}Users${WSEP}(${WSEGNS}+)(?:${WSEP}${WSEG_SPACED})*`,
);

/** Any other drive path: `D:\backups\mtran\...`. */
export const RX_WINDOWS_ANY = new RegExp(
  `(?<![A-Za-z0-9])[A-Za-z]:${WSEP}${WSEGNS}+(?:${WSEP}${WSEG_SPACED})*`,
);

/** `/home/<user>/...` or `/Users/<user>/...` — captures the username. Internal dots
 * allowed but a trailing dot is left to the sentence (`/home/jrivera.` keeps its period). */
export const RX_POSIX_HOME = new RegExp(
  `(?<![\\w.-])(?:/home|/Users)/([A-Za-z0-9_-]+(?:[.][A-Za-z0-9_-]+)*)(?:/${PSEG_SPACED})*`,
);

/** Conservative deep-POSIX roots (avoids nuking `/usr/bin/python`-style noise). */
export const RX_POSIX_DEEP = new RegExp(
  `(?<![\\w.-])/(?:mnt|srv|opt|var|data|media|shared|export)(?:/${PSEG_SPACED})+`,
);

/** `~/...` home-relative paths. */
export const RX_TILDE = new RegExp(`(?<![\\w.-])~(?:/${PSEG_SPACED})+`);

/** Claude Code project-dir strings in text: `c--Users-piedu--claude`. */
export const RX_CC_PROJECTDIR = /\b[A-Za-z]--Users-[A-Za-z0-9._-]+/;

/** Extract the username from a `c--Users-<user>-...` / `c--Users-<user>--...` string. */
export function ccProjectDirUsername(dir: string): string | null {
  // Strict form: the username (no hyphens — claude-code writes path separators as `-`)
  // ends at `--` (an empty component), at `-X` (the next component) or at the end.
  const m = /--Users-([A-Za-z0-9._]+?)(?:--|-[A-Za-z0-9._]|$)/.exec(dir);
  if (!m) {
    // Reached only when the strict form cannot terminate, e.g. a trailing lone `-`
    // (`c--Users-jrivera-`): take the longest run of username characters instead.
    const loose = /--Users-([A-Za-z0-9._]+)/.exec(dir);
    return loose ? (loose[1] ?? null) : null;
  }
  return m[1] ?? null;
}

/**
 * Seed for a captured home-directory username — the strongest real-person signal a
 * log offers (session.ts marks it strong, so it sweeps). A stoplisted account (root,
 * runner, ubuntu…) seeds nothing, and neither does a name under 3 chars: "jo" would be
 * swept inside "John" and "major" despite the letter guard being there for `_`/`/`.
 */
function usernameSeed(value: string | undefined): EntitySeed[] {
  if (!value) return [];
  const v = value.trim();
  if (v.length < 3 || USERNAME_STOPLIST.has(v.toLowerCase())) return [];
  return [{ kindHint: "person-username", value: v }];
}

/** TitleCase "First Last" (2 tokens) — used for path segments only. */
const RX_SEG_TITLE_PAIR = /^\p{Lu}[\p{L}'’-]+ \p{Lu}[\p{L}'’-]+$/u;
/** `last_first` / `first_last` two-token underscore shape. */
const RX_SEG_UNDERSCORE_PAIR = /^[A-Za-z]+_[A-Za-z]+$/;

/**
 * Scan a claimed path's segments for name-shaped pieces. These are SEEDS only —
 * the entity layer decides (gazetteer / tie to a known person) whether they become
 * redactable aliases, so `notes_to_self` or `midterm_retake` never survive on shape
 * alone.
 */
export function pathSegmentSeeds(path: string): EntitySeed[] {
  const seeds: EntitySeed[] = [];
  const segments = path.split(/[\\/]+/);
  for (const rawSeg of segments) {
    const seg = rawSeg.replace(/\.[A-Za-z0-9]{1,6}$/, ""); // drop a file extension
    // Under 5 chars cannot hold two name tokens worth tying ("a_b"); this also skips
    // most `src` / `bin` / `lib` noise before the regex tests run.
    if (!seg || seg.length < 5) continue;
    // Well-known roots and profile folders are never a person even when they fit a
    // shape ("Program Files" matches the "First Last" pair; "Documents" is TitleCase).
    if (/^(?:Users|home|mnt|srv|opt|var|data|media|shared|export|Documents|Downloads|Desktop|Library|Program Files|AppData)$/i.test(seg)) {
      continue;
    }

    if (RX_SEG_TITLE_PAIR.test(seg)) {
      // A "First Last" directory with a recognizable first name is a person: strong,
      // so the sweep masks it inside the (otherwise visible) path.
      const first = foldToken(seg.split(" ")[0] ?? "");
      seeds.push({ kindHint: "person-name", value: seg, strong: FIRST_NAMES.has(first) });
    } else if (RX_SEG_UNDERSCORE_PAIR.test(seg)) {
      seeds.push({ kindHint: "person-variant", value: seg });
    }
  }
  return seeds;
}

/** Combined entity extractor for path rules that also capture a username (group 1). */
export function pathEntityExtractor(m: RegExpExecArray): EntitySeed[] {
  return [...usernameSeed(m[1]), ...pathSegmentSeeds(m[0])];
}

/** Entity extractor for path rules without a username group. */
export function pathSegmentsOnlyExtractor(m: RegExpExecArray): EntitySeed[] {
  return pathSegmentSeeds(m[0]);
}

/** Entity extractor for Claude Code project-dir strings. */
export function ccProjectDirExtractor(m: RegExpExecArray): EntitySeed[] {
  return usernameSeed(ccProjectDirUsername(m[0]) ?? undefined);
}
