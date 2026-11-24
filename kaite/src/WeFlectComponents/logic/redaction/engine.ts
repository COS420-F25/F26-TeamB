/**
 * Span-claiming engine — a faithful port of the `compile_rules` / `redact_text`
 * semantics in agents/ai-redaction-agent-prototype/.claude/skills/redacting-usage-logs/
 * redactlib.py, split into findSpans (pass 1 collects spans before replacements exist)
 * and stitch (pass 2). The split lets session.ts harvest entity seeds and run the
 * entity sweep BETWEEN the two passes, which the Python one-shot could not.
 *
 * Preserved semantics (NOTE: the "parity tests" this referred to are not in this repo;
 * tests/redaction.test.ts covers the behaviour end to end instead):
 *  - Rules are an ORDERED list; array order = priority (specific/composite first).
 *  - A match claims its [start, end) range only if it does not overlap an
 *    already-claimed span (first-claim-wins).
 *  - Literal rules match as plain escaped substrings with NO word boundaries — this is
 *    what catches `jrivera\nrebuilding` and `_`-glued identifiers.
 *  - Zero-length matches are skipped.
 *  - Claimed spans are sorted by start and stitched with their replacements.
 *
 * TS-only extensions over the Python engine:
 *  - `claimGroup`: claim only a capture group's range (uses the `d` flag) so a rule can
 *    anchor on a cue word without swallowing it ("token: [SECRET]").
 *  - `validate`: a post-match gate for checks a regex can't express cleanly.
 *  - `noop` rules: claim territory but render unchanged (the placeholder idempotency
 *    guard and kept-placeholder notes).
 */

export interface EntitySeed {
  /** What kind of entity this seed suggests. */
  kindHint: "person-name" | "person-username" | "person-variant" | "org" | "location";
  /** The raw alias text, e.g. "jrivera", "Jordan Rivera", "tran_maxine". */
  value: string;
  /**
   * Weak seeds (GitHub handles, email local parts, DB usernames) register evidence and
   * tie to entities, but their aliases are swept only if the entity is independently
   * corroborated (a name cue or a home-directory username). Prevents
   * `github.com/microsoft/vscode` from turning every "microsoft" into a person.
   */
  weak?: boolean;
  /**
   * Strong real-person evidence carried by the seed itself (a TitleCase "First Last"
   * path segment whose first token is a known first name). Makes the entity sweepable
   * without a separate prose cue.
   */
  strong?: boolean;
}

/**
 * Corpus-level facts a rule's `validate` may consult. Rules see one field at a time;
 * the session fills this from a pre-pass so a judgement made in one message can be
 * applied consistently in another (the same literal cannot be a software version in
 * turn 1 and a host in turn 3).
 */
export interface RuleContext {
  /** Dotted quads judged version-like anywhere in the conversation. */
  versionLiterals?: ReadonlySet<string>;
  /** Dotted quads judged to be hosts (port / host-side words) anywhere — wins over version. */
  hostLiterals?: ReadonlySet<string>;
}

export interface RuleSpec {
  /** Stable id, e.g. "email", "path_windows_user". */
  id: string;
  /** RedactionKind this rule reports under ("" for pure guards). */
  kind: string;
  /** Regex rule: authored WITHOUT the g flag; the engine re-creates it with g (+d). */
  pattern?: RegExp;
  /** Literal rule: escaped substring match, NO word boundaries. */
  literal?: string;
  /** Literal rule: case-insensitive. */
  ci?: boolean;
  /** Claim only this capture group's range instead of the whole match. */
  claimGroup?: number;
  /** Post-match gate; return false to reject the match. */
  validate?: (m: RegExpExecArray, text: string, ctx: RuleContext) => boolean;
  /** Extract entity seeds (usernames, name-shaped path segments…) from a match. */
  entity?: (m: RegExpExecArray) => EntitySeed[];
  /** Confidence, gated against AUTO_HIDE_THRESHOLD for disposition. */
  confidence: number;
  /**
   * Type-preserving placeholder for this rule — a literal (`"[IPV4]"`) or derived from
   * the match (`postgres://…` → `"[POSTGRESQL_URL]"`, `password: …` → `"[PASSWORD]"`).
   * The value leaves, its category stays, so the conversation remains interpretable.
   * Falls back to the kind's generic placeholder when absent. Not used by numbered
   * entity kinds (name/email/org/location), which the session renders itself.
   */
  placeholder?: string | ((m: RegExpExecArray) => string);
  /** Claim but render unchanged and exclude from category counts. */
  noop?: boolean;
  /**
   * For noop rules: report the kept text on the review screen / findings report
   * ("deliberately not redacted") with this note. Guards without a note (existing
   * placeholders, share links) are silent.
   */
  keptNote?: string;
  /**
   * Review-only: the match is reported as a review candidate (counted on the review
   * screen under its kind, text untouched) instead of being claimed and rendered. Used
   * when a deterministic shape is ambiguous in context (a dotted quad that reads as a
   * software version) — the operator sees it rather than it silently staying.
   */
  reviewOnly?: boolean;
  /**
   * Match and emit entity seeds, but claim NOTHING and render nothing: the matched
   * text stays visible and later rules / the entity sweep may still act inside it.
   * Used by the path rules so `/Users/jrivera/dev/app` keeps its structure and only
   * the swept username becomes `[NAME_N]`.
   */
  seedOnly?: boolean;
  /** Trim trailing sentence punctuation off the claimed span (URLs/paths at end of sentence). */
  trimTrailingPunct?: boolean;
  /**
   * Adjacency guard for generated sweep literals: reject a match whose immediate
   * neighbors are ASCII letters (so `_`, `/`, `\n`, digits, start/end all count as
   * boundaries — per the skill's "re-scan inside delimiters" rule — while "art" never
   * matches inside "start"). Not used by pattern rules.
   */
  letterBoundaryGuard?: boolean;
}

/** A RuleSpec paired with the executable regex compileRule built for it. */
export interface CompiledRule {
  spec: RuleSpec;
  regex: RegExp; // always global; has d when claimGroup is used
}

/**
 * One match that owns a [start, end) range of a field (or, for seedOnly / reviewOnly,
 * merely reports it). Mutable on purpose: session.ts rewrites `kind` / `noop` /
 * `placeholder` when the operator overrides a deliberate keep, and fills `replacement`
 * at render time.
 */
export interface ClaimedSpan {
  /** RuleSpec id, or an id minted by session.ts (`b1:<kind>`, `sweep:<entity>:<alias>`). */
  ruleId: string;
  /** RedactionKind reported under ("" for pure guards). */
  kind: string;
  start: number;
  end: number;
  /** Original text of the span — what the findings report lists as the "original". */
  matched: string;
  confidence: number;
  /** Entity seeds the rule extracted; harvested by session.ts even for seed-only spans. */
  seeds: EntitySeed[];
  /** Render unchanged and keep out of the tallies (guards, kept placeholders). */
  noop: boolean;
  /** Type-preserving placeholder chosen by the rule for this match, if any. */
  placeholder?: string;
  /** Noop span the operator should see listed as a deliberate keep, with this note. */
  keptNote?: string;
  /** Seed-only match: carries seeds but owns no territory and is never rendered. */
  seedOnly?: boolean;
  /** Review-only match: becomes a review candidate; owns no territory, never rendered. */
  reviewOnly?: boolean;
  /** Filled during application: the placeholder this span renders as. */
  replacement?: string;
}

/** Make a literal inert inside `new RegExp` — literal rules are plain substring matches. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the executable regex for a spec. Pattern rules keep their authored flags
 * (minus any g/d) plus `g`, and `d` only when a claimGroup needs group offsets —
 * hasIndices has a per-exec cost, so it is opt-in. Literal rules are escaped
 * substrings with no word boundaries (see the file header).
 */
export function compileRule(spec: RuleSpec): CompiledRule {
  let regex: RegExp;
  if (spec.pattern) {
    // Re-create per compile so shared authored regexes never leak lastIndex state.
    let flags = spec.pattern.flags.replace(/[gd]/g, "") + "g";
    if (spec.claimGroup !== undefined) flags += "d";
    regex = new RegExp(spec.pattern.source, flags);
  } else if (spec.literal !== undefined) {
    regex = new RegExp(escapeRegExp(spec.literal), spec.ci ? "gi" : "g");
  } else {
    throw new Error(`rule ${spec.id}: needs pattern or literal`);
  }
  return { spec, regex };
}

/** Compile an ordered rule list; order is preserved because array order is priority. */
export function compileRules(specs: readonly RuleSpec[]): CompiledRule[] {
  return specs.map(compileRule);
}

// Boundary class for letterBoundaryGuard: ASCII letters ONLY, so digits, `_`, `/`,
// `\n` and non-ASCII letters all count as boundaries (see RuleSpec.letterBoundaryGuard).
const ASCII_LETTER = /[A-Za-z]/;

/**
 * Find all claimed spans in `text`. Rules are applied in array order (priority);
 * a match is claimed only if it does not overlap any already-claimed span
 * (including `preclaimed` spans from an earlier pass, e.g. the entity sweep runs
 * with pass-1 claims pre-loaded).
 */
export function findSpans(
  text: string,
  rules: readonly CompiledRule[],
  preclaimed: readonly ClaimedSpan[] = [],
  ctx: RuleContext = {},
): ClaimedSpan[] {
  // Claims sorted by start for binary-search overlap checks.
  const claims: ClaimedSpan[] = [...preclaimed].sort((a, b) => a.start - b.start);
  const fresh: ClaimedSpan[] = [];

  const overlaps = (s: number, e: number): boolean => {
    // Find first claim with end > s; overlap iff its start < e. Claims are sorted and
    // pairwise disjoint, so that one claim is the only candidate. Binary search keeps
    // this O(log n): the entity sweep runs one literal rule per alias over every field
    // with all pass-1 claims preloaded, so this probe is the hot path.
    let lo = 0;
    let hi = claims.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (claims[mid]!.end <= s) lo = mid + 1;
      else hi = mid;
    }
    return lo < claims.length && claims[lo]!.start < e;
  };

  const insert = (span: ClaimedSpan): void => {
    // Lower-bound insert by start so `claims` stays sorted for the next `overlaps` probe.
    let lo = 0;
    let hi = claims.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (claims[mid]!.start < span.start) lo = mid + 1;
      else hi = mid;
    }
    claims.splice(lo, 0, span);
  };

  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        rule.regex.lastIndex++; // avoid infinite loop on zero-length matches
        continue;
      }
      let start = m.index;
      let end = m.index + m[0].length;
      if (rule.spec.claimGroup !== undefined) {
        const idx = (m as RegExpExecArray & { indices?: Array<[number, number] | undefined> })
          .indices?.[rule.spec.claimGroup];
        if (!idx) continue; // group did not participate
        [start, end] = idx;
        if (end <= start) continue;
      }
      // Order matters: `validate` sees the raw match (m.index is still the whole-match
      // offset even when claimGroup narrowed the span) BEFORE trimming, the boundary
      // guard and the overlap check, so a gate can inspect the text exactly as the
      // regex matched it. Trimming then shrinks the span, the guard tests the trimmed
      // edges, and overlap is last because it is the only step that depends on what
      // earlier rules claimed.
      if (rule.spec.validate && !rule.spec.validate(m, text, ctx)) continue;

      if (rule.spec.trimTrailingPunct) {
        while (end > start && ".,;:!?".includes(text[end - 1]!)) end--;
        if (end <= start) continue;
      }
      if (rule.spec.letterBoundaryGuard) {
        const before = start > 0 ? text[start - 1]! : "";
        const after = end < text.length ? text[end]! : "";
        if (ASCII_LETTER.test(before) || ASCII_LETTER.test(after)) continue;
      }
      if (overlaps(start, end)) continue;
      const span: ClaimedSpan = {
        ruleId: rule.spec.id,
        kind: rule.spec.kind,
        start,
        end,
        matched: text.slice(start, end),
        confidence: rule.spec.confidence,
        seeds: rule.spec.entity ? rule.spec.entity(m) : [],
        noop: rule.spec.noop ?? false,
      };
      if (rule.spec.keptNote) span.keptNote = rule.spec.keptNote;
      if (rule.spec.placeholder !== undefined) {
        span.placeholder =
          typeof rule.spec.placeholder === "function" ? rule.spec.placeholder(m) : rule.spec.placeholder;
      }
      if (rule.spec.seedOnly) {
        span.seedOnly = true;
        fresh.push(span); // seeds harvested by the caller; no claim, no render
        continue;
      }
      if (rule.spec.reviewOnly) {
        span.reviewOnly = true;
        fresh.push(span); // caller turns it into a review candidate; no claim, no render
        continue;
      }
      insert(span);
      fresh.push(span);
    }
  }
  return fresh;
}

/**
 * Rebuild `text` with each span replaced by `render(span)` (noop spans render as
 * themselves). Spans must not overlap; they are sorted by start here.
 */
export function stitch(
  text: string,
  spans: readonly ClaimedSpan[],
  render: (span: ClaimedSpan) => string,
): string {
  if (spans.length === 0) return text;
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let last = 0;
  for (const span of sorted) {
    parts.push(text.slice(last, span.start));
    parts.push(span.noop ? span.matched : render(span));
    last = span.end;
  }
  parts.push(text.slice(last));
  return parts.join("");
}
