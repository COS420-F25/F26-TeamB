/**
 * Layer B1 org / location heuristics.
 *
 * Everything here is REVIEW-ONLY (confidence below AUTO_HIDE_THRESHOLD): counted on the
 * review screen, never rewritten. Institutions ("University of Maine") are context a
 * reader needs (which campus / which cohort) and the study site is already public, so
 * they are surfaced rather than hidden. Employer shapes collide with product names.
 *
 * Course codes ("COS 498", "STA-301") are deliberately NOT detected at all: they are
 * the strongest signal of what a conversation was about, and the report's limitations
 * section names them as kept.
 *
 * The uniform 0.6 below is what makes the file review-only: it sits under labels.ts
 * AUTO_HIDE_THRESHOLD (0.8). Lowering that gate to 0.6 or below would silently start
 * HIDING institutions; keep the two in step. (session.ts still seeds an entity for any
 * candidate that clears the gate, so the hidden path exists if the policy changes.)
 */

/** One finding. `cue` names the heuristic that fired — diagnostic only; session.ts reads kind / value / offsets / confidence and ignores it. */
export interface OrgLocationCandidate {
  value: string;
  start: number;
  end: number;
  kind: "org" | "location";
  cue: "university" | "employer" | "location-cue" | "ssid";
  confidence: number;
}

// "University of X [Y]" or "X [Y] University / College / Institute" (one or two
// TitleCase tokens). `u` for the \p{..} classes; module-level globals, so each scan
// resets lastIndex first.
const RX_UNIVERSITY = /\b(?:University|College|Institute) of \p{Lu}[\p{L}]+(?: \p{Lu}[\p{L}]+)?|\b\p{Lu}[\p{L}]+(?: \p{Lu}[\p{L}]+)? (?:University|College|Institute)\b/gu;

// One or two TitleCase tokens before a corporate suffix. Product names collide with
// this shape ("Rapid Systems", "Unity Technologies"), one reason the file is review-only.
const RX_EMPLOYER = /\b\p{Lu}[\p{L}]+(?: \p{Lu}[\p{L}]+)? (?:Systems|Labs|Laboratories|Technologies|Solutions|Consulting|Inc\.?|LLC|Ltd\.?|Corp\.?|GmbH)\b/gu;

// Residence cues followed by a TitleCase place (one or two tokens). `d` for group
// offsets so only the place, not the cue phrase, becomes the candidate.
const RX_LOCATION_CUE = /\b(?:live in|living in|based in|moved to|born in|grew up in|commut(?:e|ing) (?:to|from))[ ]+(\p{Lu}[\p{L}]+(?: \p{Lu}[\p{L}]+)?)/dgu;

// Two alternatives: a quoted name after an ssid / wifi / router cue (group 1), or a
// bare `NAME WiFi` (group 2) — hence `gi[1] ?? gi[2]` below. A home network name is a
// location proxy (wardriving databases map SSIDs to street addresses).
// NOTE: no `i` flag, so the cue words match lowercase only (`ssid:`, `wifi`) — an
// upper-case `SSID: "x"` is missed — while the bare form requires the name to start
// with an uppercase letter or digit. Whether the lowercase-only cue is intended is not
// recorded.
const RX_SSID = /\b(?:ssid|wi-?fi(?: network)?|network name|router)\s*[:=]?\s*["']([^"'\n]{2,32})["']|\b([A-Z0-9][\w-]{2,15})\s+(?:WiFi|Wi-Fi)\b/dg;

/** Org / location candidates in one prose field, deduped to one per text region. */
export function detectOrgsLocations(text: string): OrgLocationCandidate[] {
  const out: OrgLocationCandidate[] = [];
  let m: RegExpExecArray | null;

  RX_UNIVERSITY.lastIndex = 0;
  while ((m = RX_UNIVERSITY.exec(text)) !== null) {
    out.push({
      value: m[0],
      start: m.index,
      end: m.index + m[0].length,
      kind: "org",
      cue: "university",
      confidence: 0.6, // keep visible; surfaced as a review count
    });
  }

  RX_EMPLOYER.lastIndex = 0;
  while ((m = RX_EMPLOYER.exec(text)) !== null) {
    out.push({
      value: m[0],
      start: m.index,
      end: m.index + m[0].length,
      kind: "org",
      cue: "employer",
      confidence: 0.6,
    });
  }

  RX_LOCATION_CUE.lastIndex = 0;
  while ((m = RX_LOCATION_CUE.exec(text)) !== null) {
    const idx = (m as RegExpExecArray & { indices?: Array<[number, number] | undefined> }).indices?.[1];
    if (!idx) continue;
    out.push({
      value: text.slice(idx[0], idx[1]),
      start: idx[0],
      end: idx[1],
      kind: "location",
      cue: "location-cue",
      confidence: 0.6,
    });
  }

  RX_SSID.lastIndex = 0;
  while ((m = RX_SSID.exec(text)) !== null) {
    const gi = (m as RegExpExecArray & { indices?: Array<[number, number] | undefined> }).indices;
    const idx = gi?.[1] ?? gi?.[2];
    if (!idx) continue;
    out.push({
      value: text.slice(idx[0], idx[1]),
      start: idx[0],
      end: idx[1],
      kind: "location",
      cue: "ssid",
      confidence: 0.6,
    });
  }

  // Dedup as in names.ts: sort by start, then confidence descending, and keep the first
  // of any overlapping pair. All confidences are equal today, so in practice the
  // earlier-starting candidate wins (a university match beats an employer match that
  // begins inside it).
  out.sort((a, b) => a.start - b.start || b.confidence - a.confidence);
  const dedup: OrgLocationCandidate[] = [];

  for (const c of out) {
    const prev = dedup[dedup.length - 1];
    if (prev && c.start < prev.end && c.end > prev.start) continue;
    dedup.push(c);
  }
  return dedup;
}
