/**
 * Layer B1 person-name heuristics — local, no network, tuned for programmer chat
 * (CamelCase identifiers, library names, and git noise must not become "names").
 *
 * Strong cues (self-intro, "X here", honorific, Author:, name<email>, signature
 * block, iCal fields, cued citations) auto-hide regardless of gazetteer membership.
 * Weak shapes (roster rows, possessives, bare TitleCase bigrams) are gazetteer-gated
 * and default to review — the spec's own mitigation for "names are hard".
 *
 * Persona damper: a candidate whose sentence carries a fictional/persona cue marks its
 * entity `personaCue`; entities with persona cues and no strong real-person evidence
 * are preserved (hard rule 4, "Preserve fictional personas", in
 * agents/ai-redaction-agent-prototype/.claude/CLAUDE.md). A real name with strong
 * evidence is still redacted even if it also appears as a persona filename (same file,
 * "Order of operations").
 */

import { FIRST_NAMES, FUNCTION_WORDS, TECH_STOPLIST, foldToken } from "./gazetteers";

export interface NameCandidate {
  value: string;
  start: number;
  end: number;
  cue:
    | "self-intro"
    | "name-here"
    | "honorific"
    | "author"
    | "name-email"
    | "signature"
    | "ical"
    | "citation"
    | "citation-weak"
    | "roster"
    | "possessive"
    | "bigram";
  confidence: number;
  strong: boolean;
  personaCue: boolean;
  /** Candidates from the same roster share a group id (for the owner-present boost). */
  rosterGroup?: number;
  /** Any token is in the first-name gazetteer. */
  gazetteer: boolean;
}

// Name shapes. NT is one TitleCase token over Unicode letters (so "Tomás", "O'Brien",
// "Jean-Luc" count). NAME2 demands at least two tokens because a lone capitalised word
// is far more often a sentence start or a product than a person — single tokens enter
// only through the honorific cue (`Dr. Okonkwo`) and the entity layer's alias tying.
// The cue regexes carry `d` (hasIndices) so the candidate span is the captured NAME,
// not the cue words around it, and `u` so the \p{..} classes work. They are
// module-level globals; every scan resets lastIndex before use.
const NT = "\\p{Lu}[\\p{L}'’-]+"; // TitleCase name token
const NAME2 = `${NT}(?:[ ]${NT})+`; // two or more tokens, single spaces

// Strong cues: the sentence itself asserts a person.
const RX_SELF_INTRO = new RegExp(`\\b(?:I'?m|I am|my name is|this is)[ ]+(${NAME2})`, "dgu");
const RX_NAME_HERE = new RegExp(`\\b(${NAME2})[ ]+here\\b`, "dgu");
const RX_HONORIFIC = new RegExp(`\\b(?:Dr|Prof|Professor|Mr|Mrs|Ms|Mx)\\.?[ ]+(${NT}(?:[ ]${NT})?)`, "dgu");
// `Author:` lines (git log, package metadata): loose capture up to the `<` of the
// e-mail, shape-checked later in push().
const RX_AUTHOR_LINE = /\bAuthor:[ \t]*([^<\r\n]+?)[ \t]*</dg;
const RX_NAME_EMAIL = new RegExp(`\\b(${NAME2})[ ]*<[\\w.+-]+@`, "dgu");
// Initial + surname ("J. Rivera", "A.Okonkwo-Smith"): strong only when the field also
// carries a citation cue word; otherwise a 0.6 review row (initials are common in code).
const RX_CITATION = /\b\p{Lu}\.[ ]?\p{Lu}[\p{L}]+(?:-\p{Lu}[\p{L}]+)*/dgu;
const RX_CITATION_CUE = /\b(?:APA|MLA|IEEE|et al|bibliograph\w*|citations?|cite|references?|memo)\b/i;
// Weak shapes: gazetteer-gated, review tier.
const RX_POSSESSIVE = new RegExp(`\\b(${NAME2})['’]s\\b`, "dgu");
const RX_BIGRAM = new RegExp(`\\b${NAME2}\\b`, "dgu");
// Persona cue words looked for in the candidate's sentence (persona damper).
const RX_PERSONA_CUE = /\b(?:fictional|personas?|invented|character|made[- ]up)\b/i;

// Line-based cues: a sign-off / `--` / "Sent from" marker followed within 3 lines by a
// name-only line (signature block); iCal / vCard field prefixes; roster rows (numbered,
// bulleted, or `| n |` table rows) holding a bare name. RX_ROSTER_LINE carries `d` to
// locate the name inside the row prefix.
const RX_SIG_MARKER = /^\s*>?\s*(?:-{2,}|—|_{2,}|Sent from\b.*|Regards,?|Best(?: regards)?,?|Cheers,?|Thanks,?|Sincerely,?)\s*$/i;
const RX_NAME_ONLY_LINE = new RegExp(`^\\s*>?\\s*(${NT}(?:[ ]${NT}){1,2})\\s*$`, "u");
const RX_ICAL_LINE = /^(?:SUMMARY|DESCRIPTION|ATTENDEE|ORGANIZER|CN)[:;=]/;
const RX_ROSTER_LINE = new RegExp(`^\\s*(?:\\d+[.)][ ]+|[-*•][ ]+|\\|\\s*\\d+\\s*\\|\\s*)(${NAME2})\\s*\\|?\\s*$`, "du");

/** Shape of RegExpExecArray.indices (the `d` flag), typed locally so the cast does not depend on the lib the app targets. */
interface GroupIndices {
  indices?: Array<[number, number] | undefined>;
}

/** Fenced-code and inline-backtick ranges — weak name cues are suppressed inside. */
function codeRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const fence = /```[\s\S]*?(?:```|$)/g;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) ranges.push([m.index, m.index + m[0].length]);
  const tick = /`[^`\n]+`/g;
  while ((m = tick.exec(text)) !== null) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

function inRanges(ranges: ReadonlyArray<[number, number]>, pos: number): boolean {
  return ranges.some(([s, e]) => pos >= s && pos < e);
}

/** A line dense with code punctuation is not prose. */
function looksLikeCodeLine(line: string): boolean {
  if (/^\s{4,}/.test(line)) return true;
  const dense = (line.match(/[(){};=<>$]/g) ?? []).length;
  return dense >= 4;
}

/**
 * The sentence (`.`, `!`, `?` or newline bounded) around [start, end), capped at 200
 * characters each way so a pasted wall of unpunctuated text cannot pick up a persona
 * cue from a distant paragraph or make the per-candidate scan expensive.
 */
function sentenceAround(text: string, start: number, end: number): string {
  let s = start;
  for (let i = start - 1; i >= 0 && start - i < 200; i--) {
    const ch = text[i]!;
    if (ch === "." || ch === "!" || ch === "?" || ch === "\n") {
      s = i + 1;
      break;
    }
    s = i;
  }
  let e = end;
  for (let i = end; i < text.length && i - end < 200; i++) {
    const ch = text[i]!;
    e = i + 1;
    if (ch === "." || ch === "!" || ch === "?" || ch === "\n") break;
  }
  return text.slice(s, e);
}

/** Folded tokens of a candidate (lowercase, diacritics stripped) for gazetteer / stoplist lookups. */
function tokensOf(value: string): string[] {
  return value.split(/[ ]+/).map(foldToken).filter(Boolean);
}

/** Job-title words: a "name-only" signature/iCal line of these is a title, not a person. */
const JOB_WORDS = new Set([
  "senior", "staff", "engineer", "engineering", "developer", "manager", "director",
  "professor", "scientist", "analyst", "consultant", "lead", "principal", "junior",
  "intern", "officer", "president", "founder", "head", "chief", "architect", "designer",
  "researcher", "student", "assistant", "associate", "coordinator", "specialist",
  "administrator", "instructor", "advisor", "postdoc",
]);

function hasJobWord(value: string): boolean {
  return tokensOf(value).some((t) => JOB_WORDS.has(t));
}

/** Any token is a known first name — the recall aid that gates the weak shapes. */
function hasGazetteerToken(value: string): boolean {
  return tokensOf(value).some((t) => FIRST_NAMES.has(t));
}

// Function words and tech vocabulary. A WEAK-shape candidate containing ANY such token
// ("The Button", "Hello World") is dropped (anyStopToken); strong cues are dropped only
// when EVERY token is one (allStopTokens, below) because "Ruby Chen" is still a person.
const isStopToken = (t: string): boolean => FUNCTION_WORDS.has(t) || TECH_STOPLIST.has(t);

function anyStopToken(value: string): boolean {
  return tokensOf(value).some(isStopToken);
}

/**
 * Every token is a product / tech / function word: "Claude Code", "Visual Studio Code",
 * "Railway Postgres". Such a candidate is never a person even under a strong cue —
 * the assistant introducing itself ("I'm Claude Code") is the canonical trap. A real
 * surname among the tokens ("Ruby Chen", "Mark Okonkwo") keeps the candidate.
 */
function allStopTokens(value: string): boolean {
  const tokens = tokensOf(value);
  return tokens.length > 0 && tokens.every(isStopToken);
}

/** "Priya's" → "Priya": the name token class admits apostrophes, so trim a possessive. */
function stripPossessive(value: string): string {
  return value.replace(/['’]s$/u, "");
}

// Roster group ids. Module-global and never reset: ids only need to be distinct within
// one runSession call (session.ts groups candidates by id), and monotonic growth across
// calls keeps that true without any per-call bookkeeping.
let rosterSeq = 0;

/**
 * Person-name candidates in one prose field, at most one per text region (highest
 * confidence wins, persona cues OR-ed across the overlap). Confidence tiers, against
 * labels.ts AUTO_HIDE_THRESHOLD = 0.8: 0.95 `Author:` / `Name <email>` (machine
 * written, near certain); 0.9 self-intro / honorific; 0.85 "X here", signature, iCal,
 * cued citation; 0.6 uncued citation and roster rows (review unless session.ts boosts
 * the roster); 0.5 bare bigrams / possessives (always review). The exact values are
 * tuning choices from the prototype's fixtures; the pipeline relies on the tier ORDER
 * (session.ts places the roster boost at 0.85 and the persona damper at 0.5 relative
 * to these).
 */
export function detectNames(text: string): NameCandidate[] {
  const out: NameCandidate[] = [];
  const code = codeRanges(text);

  const push = (
    rawValue: string,
    start: number,
    cue: NameCandidate["cue"],
    confidence: number,
    strong: boolean,
    rosterGroup?: number,
  ): void => {
    const value = stripPossessive(rawValue);
    if (value.length === 0) return;
    // Already-redacted placeholders are never name candidates.
    if (/REDACTED/i.test(value)) return;
    // Product / tech vocabulary is never a person, whatever the cue.
    if (allStopTokens(value)) return;
    // The Author: capture is loose ([^<]+? up to the <email>); code fragments like
    // "`, name`" sneak in. Require a name-plausible shape: letters (plus space,
    // dot, hyphen, apostrophe), starting with a letter — "jrivera" and
    // "J. R. Tolkien" pass, punctuation-bearing code does not.
    if (cue === "author" && !/^[\p{L}][\p{L}'’. -]{0,60}$/u.test(value)) return;
    const end = start + value.length;
    const personaCue = RX_PERSONA_CUE.test(sentenceAround(text, start, end));
    out.push({
      value,
      start,
      end,
      cue,
      confidence,
      strong,
      personaCue,
      rosterGroup,
      gazetteer: hasGazetteerToken(value),
    });
  };

  const groupSpan = (m: RegExpExecArray, group: number): [number, number] | null => {
    const idx = (m as RegExpExecArray & GroupIndices).indices?.[group];
    return idx ?? null;
  };

  const scan = (
    rx: RegExp,
    group: number,
    cue: NameCandidate["cue"],
    confidence: number,
    strong: boolean,
  ): void => {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      if (m[0].length === 0) {
        rx.lastIndex++;
        continue;
      }
      const span = group === 0 ? [m.index, m.index + m[0].length] as [number, number] : groupSpan(m, group);
      if (!span) continue;
      const value = text.slice(span[0], span[1]);
      push(value, span[0], cue, confidence, strong);
    }
  };

  // Strong cues (not gazetteer-gated, allowed even near code).
  scan(RX_SELF_INTRO, 1, "self-intro", 0.9, true);
  scan(RX_NAME_HERE, 1, "name-here", 0.85, true);
  scan(RX_HONORIFIC, 1, "honorific", 0.9, true);
  scan(RX_AUTHOR_LINE, 1, "author", 0.95, true);
  scan(RX_NAME_EMAIL, 1, "name-email", 0.95, true);

  // Citations: strong when a citation cue is present in the field.
  const citationCue = RX_CITATION_CUE.test(text);
  scan(RX_CITATION, 0, citationCue ? "citation" : "citation-weak", citationCue ? 0.85 : 0.6, citationCue);

  // Line-based cues: signature blocks, iCal fields, roster rows.
  let offset = 0;
  const lines = text.split("\n");
  const lineStarts: number[] = [];
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  let rosterRun: Array<{ value: string; start: number }> = [];
  const flushRoster = (): void => {
    // Three consecutive rows: one or two bulleted TitleCase bigrams are ordinary prose
    // ("- Visual Studio"); three in a row is the roster shape (team / attendee lists)
    // that leaked names in the prototype's prior run (SPEC.md §1, "pasted roster text").
    if (rosterRun.length >= 3) {
      const group = rosterSeq++;
      for (const r of rosterRun) push(r.value, r.start, "roster", 0.6, false, group);
    }
    rosterRun = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineStart = lineStarts[i]!;

    // Signature: a name-only line within 3 lines after a signature marker. Three lines
    // covers "Best,\n\nJordan" (blank line between) plus a title line; wider would
    // reach back into the message body and pair unrelated TitleCase lines with a sign-off.
    const nameOnly = RX_NAME_ONLY_LINE.exec(line);
    if (nameOnly && nameOnly[1]) {
      let sig = false;
      for (let j = Math.max(0, i - 3); j < i; j++) {
        if (RX_SIG_MARKER.test(lines[j]!)) {
          sig = true;
          break;
        }
      }
      if (sig && !hasJobWord(nameOnly[1])) {
        const col = line.indexOf(nameOnly[1]);
        push(nameOnly[1], lineStart + col, "signature", 0.85, true);
      }
    }

    // iCal / vCard structured lines.
    if (RX_ICAL_LINE.test(line)) {
      const rx = new RegExp(`\\b${NAME2}\\b`, "gu");
      let m: RegExpExecArray | null;
      while ((m = rx.exec(line)) !== null) {
        if (hasJobWord(m[0])) continue;
        push(m[0], lineStart + m.index, "ical", 0.85, true);
      }
    }

    // Roster runs (numbered / bulleted / table rows of bare names).
    const roster = RX_ROSTER_LINE.exec(line);
    if (roster && roster[1]) {
      const idx = (roster as RegExpExecArray & GroupIndices).indices?.[1];
      const col = idx ? idx[0] : line.indexOf(roster[1]);
      rosterRun.push({ value: roster[1], start: lineStart + col });
    } else if (rosterRun.length > 0 && !/^\s*(?:\|[-\s|:]*\|?|\s*)$/.test(line) && !/^\s*\|\s*#?\s*\|\s*\w*\s*\|?\s*$/.test(line)) {
      // Any other line ends the run — except a markdown table separator (`|---|---|`),
      // a blank line, or a one-word header row (`| # | Name |`), which sit between or
      // above roster rows without breaking the list.
      flushRoster();
    }
  }
  flushRoster();

  // Weak shapes: possessives and bare bigrams — gazetteer-gated, review-tier,
  // suppressed inside code contexts and stoplisted tokens.
  const weakScan = (rx: RegExp, group: number, cue: NameCandidate["cue"]): void => {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      if (m[0].length === 0) {
        rx.lastIndex++;
        continue;
      }
      const span = group === 0 ? [m.index, m.index + m[0].length] as [number, number] : groupSpan(m, group);
      if (!span) continue;
      const value = text.slice(span[0], span[1]);
      if (inRanges(code, span[0])) continue;
      const lineIdx = lineOf(lineStarts, span[0]);
      if (lineIdx >= 0 && looksLikeCodeLine(lines[lineIdx]!)) continue;
      if (anyStopToken(value)) continue;
      if (!hasGazetteerToken(value)) continue;
      push(value, span[0], cue, 0.5, false);
    }
  };
  weakScan(RX_POSSESSIVE, 1, "possessive");
  weakScan(RX_BIGRAM, 0, "bigram");

  // Dedup: keep the highest-confidence candidate per overlapping region; OR persona cues.
  out.sort((a, b) => a.start - b.start || b.confidence - a.confidence);
  const dedup: NameCandidate[] = [];
  for (const c of out) {
    const prev = dedup[dedup.length - 1];
    if (prev && c.start < prev.end && c.end > prev.start) {
      prev.personaCue = prev.personaCue || c.personaCue;
      if (c.confidence > prev.confidence) {
        c.personaCue = c.personaCue || prev.personaCue;
        dedup[dedup.length - 1] = c;
      }
      continue;
    }
    dedup.push(c);
  }
  return dedup;
}

/** Index of the line containing `pos` (binary search over line starts; called once per weak-shape match). */
function lineOf(lineStarts: readonly number[], pos: number): number {

  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
