/**
 * EntityMap — the genuinely new work over the Python engine, which had no automated
 * person numbering (a human encoded numbers into rule replacements).
 *
 * Responsibilities:
 *  - Merge seeds (names, usernames, email locals, name-shaped path segments) into
 *    person entities via alias tying: a handle `u` ties to a person with name tokens
 *    [first…last] when stripSeps(u) ∈ { first, last, first+last, last+first,
 *    f+last, first+l } (case/diacritic-insensitive). An orphan handle becomes its own
 *    person (skill rule).
 *  - Track evidence strength: weak seeds (GitHub handles, email locals, DB users)
 *    never make an entity sweepable on their own; home-directory usernames and strong
 *    name cues do.
 *  - Persona damper: an entity seen with a fictional-persona cue and no strong
 *    real-person evidence is preserved (its aliases are never swept and its candidates
 *    are downgraded to review). A real name that ALSO has strong evidence is still
 *    redacted (agents/ai-redaction-agent-prototype/.claude/CLAUDE.md, "Order of
 *    operations": a real name that also appears as a persona filename is still a
 *    person).
 *  - Lazy numbering: [NAME_N] indices are assigned in order of first RENDERED
 *    appearance, so numbering is stable and auditable. The map lives only for the
 *    duration of one redactConversations call and is never serialized by the module.
 */

import type { EntitySeed, RuleSpec } from "./engine";
import { FIRST_NAMES, FUNCTION_WORDS, TECH_STOPLIST, USERNAME_STOPLIST, foldToken } from "./gazetteers";

export interface SeedContext {
  /** Global document-order ordinal of the field this seed came from. */
  fieldOrdinal: number;
  /** Offset within the field (tie-break for first-appearance ordering). */
  start: number;
  /** Strong real-person evidence (self-intro, honorific, home-dir username, …). */
  strong: boolean;
  /** The surrounding sentence carried a fictional/persona cue. */
  personaCue?: boolean;
}

export interface PersonEntity {
  /** `person:N` / `org:N` / `location:N` from the module-global SEQ; sweep rule ids embed it. */
  key: string;
  /**
   * First-appearance order: fieldOrdinal × 1_000_000 + offset (offset capped at
   * 999_999 so it cannot carry into the field part), one comparable number.
   * NOTE: written by addSeed / mergeNonPerson but never read anywhere — numbering is
   * lazy via numberFor() in render order, which made this redundant. Kept as a field.
   */
  firstSeen: number;
  /** Folded name tokens, written order, when a name-shaped alias is known. */
  tokens: string[];
  /** All aliases (original casing) keyed by folded form. */
  aliases: Map<string, string>;
  strong: boolean;
  personaCue: boolean;
  /** Assigned [NAME_N] index (lazy, at render time). */
  n?: number;
  kind: "person" | "org" | "location";
}

// Handle folding for tying: drop separators so "j.rivera", "j_rivera", "J-Rivera" and
// "jrivera" compare equal against the variant table.
const stripSeps = (s: string): string => s.replace(/[._\s'’-]+/g, "");

/** Canonical alias key: trimmed, lowercased, diacritics stripped (gazetteers.ts foldToken). */
function foldAlias(s: string): string {
  return foldToken(s.trim());
}

/** Split a name-shaped value on whitespace / `.` / `_` / `-` and fold each token ("tran_maxine" → ["tran", "maxine"]). */
function nameTokens(value: string): string[] {
  return value
    .split(/[\s._-]+/)
    .map(foldToken)
    .filter((t) => t.length > 0);
}

/**
 * The handle shapes a name [first…last] explains — the tying table in the file header:
 * first, last, first+last, last+first, f+last, first+l. Compared against stripSeps'd
 * aliases, so separators in the handle never matter.
 */
function variantSet(tokens: string[]): Set<string> {
  const out = new Set<string>();
  if (tokens.length === 0) return out;
  const first = stripSeps(tokens[0]!);
  const last = stripSeps(tokens[tokens.length - 1]!);
  out.add(first);
  out.add(last);
  if (tokens.length >= 2) {
    out.add(first + last);
    out.add(last + first);
    if (first.length > 0) out.add(first[0]! + last);
    if (last.length > 0) out.add(first + last[0]!);
  }
  return out;
}

// Entity key counter. Module-global rather than per store, so a key never repeats
// across the stores created by successive runs in one page session (applyDecisions
// builds a fresh store each time). Nothing today requires cross-store uniqueness; the
// rationale beyond "never ambiguous" is not recorded.
let SEQ = 0;

/**
 * The entity map for one run. Holds person / org / location entities, the alias →
 * entity index used for tying and render-time lookup, the operator's preserve list,
 * and the per-kind placeholder counters.
 */
export class EntityStore {
  private entities: PersonEntity[] = [];
  private byAlias = new Map<string, PersonEntity>();
  private preserve: Set<string>;
  private nextNumber: Record<"person" | "org" | "location", number> = {
    person: 1,
    org: 1,
    location: 1,
  };

  constructor(preserveLiterals: readonly string[] = []) {
    this.preserve = new Set(preserveLiterals.map((s) => foldAlias(s)));
  }

  /** Returns the entity the seed merged into, or null when the seed is rejected. */
  addSeed(seed: EntitySeed, ctx: SeedContext): PersonEntity | null {
    const value = seed.value.trim();
    // Under 3 chars cannot be swept safely ("al", "jo" occur inside too many words even
    // with the letter guard) and sweepRules() skips such aliases anyway; reject early.
    if (value.length < 3) return null;
    const folded = foldAlias(value);
    if (this.preserve.has(folded)) return null;

    if (seed.kindHint === "org" || seed.kindHint === "location") {
      return this.mergeNonPerson(seed.kindHint, value, folded, ctx);
    }

    const isNameShaped = seed.kindHint === "person-name";
    if (seed.kindHint === "person-username" && USERNAME_STOPLIST.has(folded)) return null;

    // NOTE: both branches are identical — nameTokens applies to every seed kind; the
    // conditional is a leftover of an earlier split and is left as-is (comments-only pass).
    const tokens = isNameShaped ? nameTokens(value) : nameTokens(value);
    const strippedWhole = stripSeps(folded);

    // 1. Exact alias match.
    let target = this.byAlias.get(folded) ?? null;

    // 2. Token-set / variant tying against existing person entities.
    if (!target) {
      for (const e of this.entities) {
        if (e.kind !== "person") continue;
        // A lone surname / first name ("Dr. Okonkwo", "Priya's") binds to the
        // FIRST-ESTABLISHED person carrying that token (entities are in creation order).
        // When two people share the token the earlier one wins — documented in the
        // report's limitations; neither failure mode leaks, so this is an output-quality call.
        if (isNameShaped && tokens.length === 1 && e.tokens.includes(tokens[0]!)) {
          target = e;
          break;
        }
        if (isNameShaped || tokens.length >= 2) {
          // Name-shaped or multi-token variant: equal token multisets tie.
          if (e.tokens.length >= 2 && sameTokens(e.tokens, tokens)) {
            target = e;
            break;
          }
          // Or this name's variants explain one of the entity's single-token aliases.
          if (e.tokens.length === 0) {
            const vs = variantSet(tokens);
            let tied = false;
            for (const aliasFold of e.aliases.keys()) {
              if (vs.has(stripSeps(aliasFold))) {
                tied = true;
                break;
              }
            }
            if (tied) {
              target = e;
              break;
            }
          }
        } else {
          // Single-token handle: tie when it's a variant of the entity's name tokens.
          if (e.tokens.length >= 2 && variantSet(e.tokens).has(strippedWhole)) {
            target = e;
            break;
          }
        }
      }
    }

    // Single-token seeds that are WEAK (GitHub handle, e-mail local, DB user) never
    // CREATE an entity — they only tie to an existing one above. A strong orphan
    // (home-dir username, --username option) always gets its own person. A non-weak,
    // non-strong single token would still create one, but today every non-weak
    // `person-username` seed arrives strong (session.ts pass 1a), so that path is
    // effectively unused.
    if (!target && !isNameShaped && tokens.length < 2 && !ctx.strong) {
      if (seed.weak) return null;
    }
    // Gazetteer gate for name-shaped path segments / variants arriving with no cue:
    // require a recognizable first name so `midterm_retake` never becomes a person.
    if (!target && !ctx.strong && (seed.kindHint === "person-variant" || (isNameShaped && seed.weak))) {
      const gazetteerHit = tokens.some((t) => FIRST_NAMES.has(t));
      if (!gazetteerHit) return null;
    }

    if (!target) {
      target = {
        key: `person:${SEQ++}`,
        firstSeen: ctx.fieldOrdinal * 1_000_000 + Math.min(ctx.start, 999_999),
        tokens: [],
        aliases: new Map(),
        strong: false,
        personaCue: false,
        kind: "person",
      };
      this.entities.push(target);
    }

    if (!target.aliases.has(folded)) target.aliases.set(folded, value);
    this.byAlias.set(folded, target);
    if (isNameShaped && tokens.length >= 2 && target.tokens.length === 0) {
      target.tokens = tokens;
    }
    if (ctx.strong && !seed.weak) target.strong = true;
    if (ctx.personaCue) target.personaCue = true;
    const seen = ctx.fieldOrdinal * 1_000_000 + Math.min(ctx.start, 999_999);
    if (seen < target.firstSeen) target.firstSeen = seen;
    return target;
  }

  /**
   * Org / location entities: keyed by kind + folded alias with NO variant tying (an
   * organisation has no first / last shape), so "UMaine" and "University of Maine" are
   * two entities. Strength comes from the caller — session.ts seeds only candidates
   * that already cleared the gate, as strong.
   */
  private mergeNonPerson(
    kind: "org" | "location",
    value: string,
    folded: string,
    ctx: SeedContext,
  ): PersonEntity {
    let target = this.byAlias.get(`${kind}:${folded}`) ?? null;
    if (!target) {
      target = {
        key: `${kind}:${SEQ++}`,
        firstSeen: ctx.fieldOrdinal * 1_000_000 + Math.min(ctx.start, 999_999),
        tokens: [],
        aliases: new Map(),
        strong: ctx.strong,
        personaCue: false,
        kind,
      };
      this.entities.push(target);
      this.byAlias.set(`${kind}:${folded}`, target);
    }
    if (!target.aliases.has(folded)) target.aliases.set(folded, value);
    if (ctx.strong) target.strong = true;
    return target;
  }

  /** Exact-alias lookup for render time (sweep spans, and any span whose entity was not recorded at claim time). */
  entityForAlias(alias: string): PersonEntity | undefined {
    return this.byAlias.get(foldAlias(alias));
  }

  /** Entity is preserved: persona cue with no strong real-person evidence. */
  isPreserved(e: PersonEntity): boolean {
    return e.personaCue && !e.strong;
  }

  /** Lazy [KIND_N] number, assigned in first-render order. */
  numberFor(e: PersonEntity): number {
    if (e.n === undefined) {
      e.n = this.nextNumber[e.kind]++;
    }
    return e.n;
  }

  /** Every entity in creation order (session.ts maps sweep rule ids back to entities through this). */
  allEntities(): readonly PersonEntity[] {
    return this.entities;
  }

  /**
   * Generate the pass-1d sweep: one case-insensitive literal rule per alias of every
   * SWEEPABLE person entity (strong, not persona-preserved), with the letter-boundary
   * guard so `\n`-, `_`- and `/`-glued occurrences are caught but "art" never matches
   * inside "start". Sorted longest-alias-first so "Jordan Rivera" outranks "jordan".
   */
  sweepRules(): Array<RuleSpec & { entityKey: string }> {
    const rules: Array<RuleSpec & { entityKey: string }> = [];
    for (const e of this.entities) {
      if (e.kind !== "person") continue;
      if (!e.strong || this.isPreserved(e)) continue;
      for (const [folded, original] of e.aliases) {
        if (folded.length < 3) continue;
        if (FUNCTION_WORDS.has(folded) || TECH_STOPLIST.has(folded)) continue;
        if (USERNAME_STOPLIST.has(folded)) continue;
        // Never sweep placeholder tokens harvested from already-redacted input
        // ([REDACTED_PERSON_1_USER] in a path is not a person).
        if (/redacted/i.test(original)) continue;
        rules.push({
          id: `sweep:${e.key}:${folded}`,
          kind: "name",
          literal: original,
          ci: true,
          letterBoundaryGuard: true,
          confidence: 1,
          entityKey: e.key,
        });
      }
    }
    rules.sort((a, b) => (b.literal?.length ?? 0) - (a.literal?.length ?? 0));
    return rules;
  }

  /** Operator-facing person/entity map (report only; never written into the corpus). */
  personMap(): Record<string, string> {
    const out: Record<string, string> = {};
    const numbered = this.entities
      .filter((e) => e.n !== undefined)
      .sort((a, b) => a.n! - b.n!);
    for (const e of numbered) {
      const label = e.kind === "person" ? `person ${e.n}` : `${e.kind} ${e.n}`;
      out[label] = [...e.aliases.values()].join(" / ");
    }
    return out;
  }
}

/** Equal token multisets regardless of order: "Rivera Jordan" (a last_first path segment) ties to "Jordan Rivera". */
function sameTokens(a: readonly string[], b: readonly string[]): boolean {

  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((t, i) => t === sb[i]);
}
