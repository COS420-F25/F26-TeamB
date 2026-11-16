/**
 * Corpus-scoped two-pass redaction session. In this repo the only caller is index.ts
 * (`redactConversationsWithOptions`); the input shape still allows several texts per
 * turn on a prose / tool channel because the engine was written to be fed by other
 * containers as well (the prototype's JSONL harness, which is not part of this repo).
 *
 * Pass 1a: deterministic Layer A spans per field (+ entity seeds from paths/URLs,
 *          read-only username seeding from conversation ids). Paths are seed-only:
 *          their structure stays visible and only swept identifiers inside them change.
 * Pass 1b: Layer B1 candidates (names / orgs / locations) per prose field.
 * Pass 1c: roster boost + persona damper over the B1 candidates. (Alias tying itself
 *          is not a pass: it happens inside `EntityStore.addSeed` as seeds arrive
 *          during 1a / 1b.)
 * Pass 1d: entity literal sweep over unclaimed territory (case-insensitive, no word
 *          boundaries, letter-adjacency guard) — a username discovered in conversation
 *          5 masks its occurrences back in conversation 1.
 * Pass 2:  stitch replacements in document order (numbering = first rendered
 *          appearance), aggregate honest category tallies, Tier-3 conversation flags.
 *
 * Hidden candidates rewrite text; review candidates NEVER touch text — they only
 * count. The entity map lives only inside one call and is never serialized here.
 */

import {
  compileRules,
  findSpans,
  stitch,
  type ClaimedSpan,
  type RuleSpec,
} from "./engine";
import { LAYER_A_RULES, collectVersionJudgements } from "./rules";
import { EntityStore, type PersonEntity } from "./entities";
import { detectNames } from "./names";
import { detectOrgsLocations } from "./orgsLocations";
import { flagConversation } from "./topics";
import { AUTO_HIDE_THRESHOLD, labelFor, placeholderFor } from "./labels";
import { forcedKeepPlaceholder } from "./rules";
import { ccProjectDirUsername } from "./paths";
import type { KeptPlaceholder, RedactionCategory, ReviewFlag } from "./types";

/**
 * Engine options. The app sets only `preserveLiterals` / `redactLiterals` (the two
 * fields of src/types.ts RedactionOptions, via findings.ts `applyDecisions`); the
 * others are unused in this repo and exist so the engine can be driven and tuned
 * without editing code.
 */
export interface RedactOptions {
  /**
   * Known real names seeded as STRONG entities before any text is read — the
   * counterpart of `--name` in agents/ai-redaction-agent-prototype/.claude/skills/
   * redacting-usage-logs/scan_identifiers.py. Never set by the app or its tests.
   */
  knownNames?: string[];
  /** Known usernames / handles to seed (counterpart of `--username`). Never set by the app. */
  knownUsernames?: string[];
  /** Fictional personas (and any operator "keep this"): exact strings never redacted or flagged. */
  preserveLiterals?: string[];
  /**
   * Operator override of a deliberate keep: exact texts from keptPlaceholders that
   * should be hidden after all (review screen, "Redact?" ticked on a Preserved row).
   * Each renders as a typed secret, is counted under "secret", and leaves the kept list.
   */
  redactLiterals?: string[];
  /** Tier-3 maybe-personal conversation flagging (default true). Never set by the app. */
  enableTopicFlags?: boolean;
  /** Confidence gate between "hidden" and "review" (default AUTO_HIDE_THRESHOLD). Never set by the app. */
  autoHideThreshold?: number;
}

/**
 * One text of a turn. "prose" gets Layer A + Layer B1 + topic flags; "tool" gets Layer
 * A only (tool output is structured noise for the name heuristics and the pre-pass).
 * The app sends prose only (index.ts).
 */
export interface SessionText {
  text: string;
  channel: "prose" | "tool";
}

/** A turn as the session sees it; `role` matters only for topic weighting (user 1, assistant 0.5). */
export interface SessionTurn {
  role: "user" | "assistant";
  texts: SessionText[];
}

/** Session input. `id` is scanned for a claude-code project-dir username but is never rewritten. */
export interface SessionConversation {
  id: string;
  title?: string;
  turns: SessionTurn[];
}

export interface SessionResult {
  /** Redacted texts, parallel to the input shape. */
  conversations: Array<{ title?: string; turns: string[][] }>;
  categories: RedactionCategory[];
  reviewFlags: ReviewFlag[];
  keptPlaceholders: KeptPlaceholder[];
  /** Every distinct applied original → its replacement + occurrence count (report/verify). */
  appliedOriginals: Array<{ original: string; replacement: string; kind: string; count: number }>;
  /** Operator-facing entity map (report only — never written into the corpus). */
  personMap: Record<string, string>;
}

/**
 * A flattened unit of text (one title or one turn text) in document order. `ordinal`
 * is the corpus-wide position used for first-seen ordering and as the candidate →
 * field key; `loc` is kept so the redacted text can be written back into the parallel
 * output shape.
 */
interface Field {
  ordinal: number;
  convIndex: number;
  convId: string;
  loc: { type: "title" } | { type: "turn"; turnIndex: number; textIndex: number };
  channel: "prose" | "tool";
  text: string;
  spans: ClaimedSpan[];
  entityBySpan: Map<ClaimedSpan, PersonEntity>;
}

/**
 * A heuristic (Layer B1) or review-only Layer A finding before disposition. Unlike a
 * ClaimedSpan it owns no territory: only candidates at / above the gate become spans
 * (the assembly step before pass 1d); the rest are counted as review rows. `entity`
 * is null when the store rejected the seed (preserved persona, stoplisted, too short)
 * or when the finding was never seeded (review-only orgs / locations, version quads).
 */
interface B1Candidate {
  fieldIdx: number;
  value: string;
  start: number;
  end: number;
  /** "name" | "org" | "location" from Layer B1; any kind from review-only Layer A rules. */
  kind: string;
  confidence: number;
  entity: PersonEntity | null;
  rosterGroup?: number;
  gazetteer?: boolean;
  strong?: boolean;
}

/**
 * Run the whole pipeline over one corpus. The pass order is load-bearing: Layer A must
 * claim before B1 candidates are placed (a name inside an email must not be counted
 * twice), every seed must exist before the sweep rules are generated (a username found
 * in the last conversation masks the first), and rendering is last because placeholder
 * numbers follow render order.
 */
export function runSession(
  conversations: readonly SessionConversation[],
  options: RedactOptions = {},
): SessionResult {
  const threshold = options.autoHideThreshold ?? AUTO_HIDE_THRESHOLD;
  const enableTopics = options.enableTopicFlags ?? true;
  // Deliberate asymmetry: preserve matches case-insensitively (the operator un-ticks a
  // name once, and the case-insensitive sweep must not reinstate "jrivera" after
  // "Jordan Rivera" was kept), while redactLiterals is an exact, case-sensitive match
  // because each value is one of this engine's own keptPlaceholders texts and secrets
  // are case-sensitive (tests/review.test.ts: "the override is an exact-text match").
  const preserve = (options.preserveLiterals ?? []).map((s) => s.toLowerCase());
  const isPreservedLiteral = (v: string): boolean => preserve.includes(v.toLowerCase());
  const forceRedact = new Set(options.redactLiterals ?? []);

  const store = new EntityStore(options.preserveLiterals ?? []);
  const layerA = compileRules(LAYER_A_RULES);

  // Option seeds (strong, pre-document).
  for (const n of options.knownNames ?? []) {
    store.addSeed({ kindHint: "person-name", value: n }, { fieldOrdinal: -1, start: 0, strong: true });
  }
  for (const u of options.knownUsernames ?? []) {
    store.addSeed({ kindHint: "person-username", value: u }, { fieldOrdinal: -1, start: 0, strong: true });
  }

  // ---- flatten fields in document order ----
  const fields: Field[] = [];
  conversations.forEach((conv, convIndex) => {
    // Read-only username seeding from claude-code style conversation ids
    // (`c--Users-piedu--claude`): the id itself is preserved per the contract.
    if (/--Users-/.test(conv.id)) {
      const user = ccProjectDirUsername(conv.id);
      if (user) {
        store.addSeed(
          { kindHint: "person-username", value: user },
          { fieldOrdinal: fields.length, start: 0, strong: true },
        );
      }
    }
    if (conv.title !== undefined) {
      fields.push({
        ordinal: fields.length,
        convIndex,
        convId: conv.id,
        loc: { type: "title" },
        channel: "prose",
        text: conv.title,
        spans: [],
        entityBySpan: new Map(),
      });
    }
    conv.turns.forEach((turn, turnIndex) => {
      turn.texts.forEach((t, textIndex) => {
        fields.push({
          ordinal: fields.length,
          convIndex,
          convId: conv.id,
          loc: { type: "turn", turnIndex, textIndex },
          channel: t.channel,
          text: t.text,
          spans: [],
          entityBySpan: new Map(),
        });
      });
    });
  });

  const candidates: B1Candidate[] = [];

  // ---- pre-pass: corpus-level judgements shared by all fields ----
  // A dotted quad that reads as a software version in any prose field is treated as a
  // version everywhere (same literal, same disposition), like the name sweep — unless
  // some occurrence is explicitly host-marked (:port, route table, ssh…), in which case
  // it is a host everywhere. Safe direction on conflict.
  const versionLiterals = new Set<string>();
  const hostLiterals = new Set<string>();
  for (const field of fields) {
    if (field.channel !== "prose") continue;
    const j = collectVersionJudgements(field.text);
    for (const v of j.version) versionLiterals.add(v);
    for (const h of j.host) hostLiterals.add(h);
  }
  for (const h of hostLiterals) versionLiterals.delete(h);
  const ruleCtx = { versionLiterals, hostLiterals };

  // ---- pass 1a: Layer A ----
  for (const field of fields) {
    const spans = findSpans(field.text, layerA, [], ruleCtx);
    for (const span of spans) {
      // Review-only matches (version-like dotted quads) are counted, never rewritten.
      if (span.reviewOnly) {
        if (!isPreservedLiteral(span.matched)) {
          candidates.push({
            fieldIdx: field.ordinal,
            value: span.matched,
            start: span.start,
            end: span.end,
            kind: span.kind,
            confidence: span.confidence,
            entity: null,
          });
        }
        continue;
      }
      for (const seed of span.seeds) {
        const strong = !seed.weak && (seed.kindHint === "person-username" || seed.strong === true);
        const entity = store.addSeed(seed, {
          fieldOrdinal: field.ordinal,
          start: span.start,
          strong,
        });
        if (entity && (span.kind === "name" || span.kind === "org" || span.kind === "location")) {
          field.entityBySpan.set(span, entity);
        }
      }
      // Seed-only matches (paths) own no territory: seeds harvested above, text kept.
      if (span.seedOnly) continue;
      // Drop spans whose exact text the operator marked preserve (placeholders etc.).
      if (!span.noop && isPreservedLiteral(span.matched)) continue;
      field.spans.push(span);
    }
  }

  // ---- pass 1b: Layer B1 candidates ----
  for (const field of fields) {
    if (field.channel !== "prose") continue;
    for (const c of detectNames(field.text)) {
      if (isPreservedLiteral(c.value)) continue;
      const entity = store.addSeed(
        { kindHint: "person-name", value: c.value },
        {
          fieldOrdinal: field.ordinal,
          start: c.start,
          strong: c.strong,
          personaCue: c.personaCue,
        },
      );
      candidates.push({
        fieldIdx: field.ordinal,
        value: c.value,
        start: c.start,
        end: c.end,
        kind: "name",
        confidence: c.confidence,
        entity,
        rosterGroup: c.rosterGroup,
        gazetteer: c.gazetteer,
        strong: c.strong,
      });
    }
    for (const c of detectOrgsLocations(field.text)) {
      if (isPreservedLiteral(c.value)) continue;
      const hidden = c.confidence >= threshold;
      const entity = hidden
        ? store.addSeed(
            { kindHint: c.kind, value: c.value },
            { fieldOrdinal: field.ordinal, start: c.start, strong: true },
          )
        : null;
      candidates.push({
        fieldIdx: field.ordinal,
        value: c.value,
        start: c.start,
        end: c.end,
        kind: c.kind,
        confidence: c.confidence,
        entity,
      });
    }
  }

  // ---- pass 1c: roster boost + persona damper resolution ----
  const rosterGroups = new Map<number, B1Candidate[]>();
  for (const c of candidates) {
    if (c.rosterGroup !== undefined) {
      const list = rosterGroups.get(c.rosterGroup) ?? [];
      list.push(c);
      rosterGroups.set(c.rosterGroup, list);
    }
  }
  // Roster boost: a roster row alone is review-tier (0.6, names.ts), but a roster that
  // contains someone already known to be real ("anchored" by a strong entity) or a row
  // with a gazetteer first name is a list of people — lift those rows to 0.85, the
  // signature / iCal tier, which clears the 0.8 gate without outranking cued evidence
  // (0.9 / 0.95) when spans overlap. The lifted entity becomes sweepable too.
  for (const group of rosterGroups.values()) {
    const anchored = group.some((c) => c.entity?.strong);
    for (const c of group) {
      if (!c.entity) continue;
      if (anchored || c.gazetteer) {
        c.confidence = Math.max(c.confidence, 0.85);
        if (!store.isPreserved(c.entity)) c.entity.strong = true;
      }
    }
  }
  // Persona damper: 0.5 is the weak-shape tier (names.ts bigram / possessive), the lowest
  // confidence the detector emits, so a persona reads as "possible name, please review"
  // and never auto-hides even when a strong cue ("I'm Maxine Tran") produced it.
  for (const c of candidates) {
    if (c.entity && c.kind === "name" && store.isPreserved(c.entity)) {
      c.confidence = Math.min(c.confidence, 0.5); // persona damper: review, never hidden
    }
  }

  // ---- assemble hidden spans per field, then pass 1d sweep ----
  const byField = new Map<number, Field>();
  for (const f of fields) byField.set(f.ordinal, f);

  // Highest confidence first: when two hidden candidates overlap inside one field (a
  // 0.95 `Author:` capture and a 0.85 roster row over the same text) the stronger one
  // takes the territory and the weaker is dropped by the overlap test below — B1 has
  // no array-order priority like Layer A, so confidence is its priority.
  const hiddenCands = candidates
    .filter((c) => c.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence);
  for (const c of hiddenCands) {
    const field = byField.get(c.fieldIdx)!;
    const overlaps = field.spans.some((s) => c.start < s.end && c.end > s.start);
    if (overlaps) continue;
    const span: ClaimedSpan = {
      ruleId: `b1:${c.kind}`,
      kind: c.kind,
      start: c.start,
      end: c.end,
      matched: c.value,
      confidence: c.confidence,
      seeds: [],
      noop: false,
    };
    field.spans.push(span);
    if (c.entity) field.entityBySpan.set(span, c.entity);
  }

  const sweepSpecs = store.sweepRules();
  const entityByRuleId = new Map<string, string>();
  for (const s of sweepSpecs) entityByRuleId.set(s.id, s.entityKey);
  const entityByKey = new Map<string, PersonEntity>();
  for (const e of store.allEntities()) entityByKey.set(e.key, e);
  const sweepCompiled = compileRules(sweepSpecs as RuleSpec[]);

  for (const field of fields) {
    const swept = findSpans(field.text, sweepCompiled, field.spans);
    for (const span of swept) {
      const key = entityByRuleId.get(span.ruleId);
      const entity = key ? entityByKey.get(key) : undefined;
      field.spans.push(span);
      if (entity) field.entityBySpan.set(span, entity);
    }
  }

  // ---- pass 2: render in document order, aggregate ----
  const emailIndex = new Map<string, number>();
  // Typed placeholders are numbered per TYPE by distinct value ([GITHUB_TOKEN_1],
  // [GITHUB_TOKEN_2], [IPV4_1]…) so a reader can tell "the same key again" from "a
  // different key". Keyed by exact matched text (secrets are case-sensitive).
  const typedIndex = new Map<string, Map<string, number>>();
  // Category tallies count DISTINCT finds, not occurrences — one email (or person,
  // via their entity) seen 300 times counts once. Entity kinds dedupe by entity so
  // aliases collapse; everything else dedupes by lowercased matched text.
  // appliedOriginals keeps the per-occurrence detail for the findings report.
  const hiddenUnique = new Map<string, Set<string>>();
  const markUnique = (map: Map<string, Set<string>>, kind: string, key: string): void => {
    let set = map.get(kind);
    if (!set) {
      set = new Set();
      map.set(kind, set);
    }
    set.add(key);
  };
  const appliedByOriginal = new Map<
    string,
    { original: string; replacement: string; kind: string; count: number }
  >();
  const keptPlaceholders: KeptPlaceholder[] = [];
  const keptSeen = new Set<string>();

  const render = (field: Field) => (span: ClaimedSpan): string => {
    let replacement: string;
    let uniqueKey = `t:${span.matched.toLowerCase()}`;
    if (span.kind === "email") {
      const key = span.matched.toLowerCase();
      if (!emailIndex.has(key)) emailIndex.set(key, emailIndex.size + 1);
      replacement = placeholderFor("email", emailIndex.get(key)!);
    } else if (span.kind === "name" || span.kind === "org" || span.kind === "location") {
      const entity = field.entityBySpan.get(span) ?? store.entityForAlias(span.matched);
      replacement = entity
        ? placeholderFor(span.kind, store.numberFor(entity))
        : placeholderFor(span.kind);
      if (entity) uniqueKey = `e:${entity.key}`;
    } else {
      // Type-preserving: the rule's own placeholder ([POSTGRESQL_URL], [GITHUB_TOKEN],
      // [PASSWORD], [IPV4], [STUDENT_ID]) when it names one, else the kind's generic —
      // numbered per type by distinct value.
      const base = (span.placeholder ?? placeholderFor(span.kind)).replace(/^\[|\]$/g, "");
      let byValue = typedIndex.get(base);
      if (!byValue) {
        byValue = new Map();
        typedIndex.set(base, byValue);
      }
      if (!byValue.has(span.matched)) byValue.set(span.matched, byValue.size + 1);
      replacement = `[${base}_${byValue.get(span.matched)!}]`;
    }
    span.replacement = replacement;
    markUnique(hiddenUnique, span.kind, uniqueKey);
    const lower = span.matched.toLowerCase();
    const applied = appliedByOriginal.get(lower);
    if (applied) applied.count++;
    else appliedByOriginal.set(lower, { original: span.matched, replacement, kind: span.kind, count: 1 });
    return replacement;
  };

  const redactedByOrdinal = new Map<number, string>();
  for (const field of fields) {
    for (const span of field.spans) {
      if (span.noop && span.keptNote && forceRedact.has(span.matched)) {
        // Operator overrode this deliberate keep: from here on it is an ordinary typed
        // secret — render() numbers it, counts it, and lists it in appliedOriginals; the
        // kept note goes so it drops off the Preserved list. Exact-text match: the value
        // came from this engine's own keptPlaceholders.
        span.noop = false;
        span.kind = "secret";
        span.placeholder = forcedKeepPlaceholder(span.matched);
        delete span.keptNote;
        continue;
      }
      if (span.noop && span.keptNote) {
        // One Preserved row per (conversation, text); the join character below is a
        // literal NUL (invisible in most editors) so an id can never collide with a
        // placeholder text containing a space or other separator.
        const dedupe = `${field.convId} ${span.matched}`;
        if (!keptSeen.has(dedupe)) {
          keptSeen.add(dedupe);
          keptPlaceholders.push({
            conversationId: field.convId,
            text: span.matched,
            note: span.keptNote,
          });
        }
      }
    }
    redactedByOrdinal.set(field.ordinal, stitch(field.text, field.spans, render(field)));
  }

  // Review tallies: candidates below the gate whose entity is not already swept
  // (a strong entity's stray occurrences are caught by the sweep, not re-counted).
  // Deduped the same way as hidden tallies: by entity, else by lowercased value.
  const reviewUnique = new Map<string, Set<string>>();
  for (const c of candidates) {
    if (c.confidence >= threshold) continue;
    if (c.entity && c.entity.strong && !store.isPreserved(c.entity)) continue;
    markUnique(reviewUnique, c.kind, c.entity ? `e:${c.entity.key}` : `t:${c.value.toLowerCase()}`);
  }

  // ---- Tier-3 conversation flags (text untouched) ----
  const reviewFlags: ReviewFlag[] = [];
  if (enableTopics) {
    conversations.forEach((conv) => {
      const proseTurns = conv.turns.map((t) => ({
        role: t.role,
        text: t.texts
          .filter((x) => x.channel === "prose")
          .map((x) => x.text)
          .join("\n"),
      }));
      const flag = flagConversation(conv.title, proseTurns);
      if (flag) {
        reviewFlags.push({
          conversationId: conv.id,
          kind: "maybe-personal",
          subkind: flag.subkind,
          reason: flag.reason,
          question: flag.question,
        });
      }
    });
  }

  // ---- categories ----
  const categories: RedactionCategory[] = [];
  for (const [kind, uniques] of hiddenUnique) {
    // Pure guards (kind "") are noop or seed-only and never reach render(), so nothing
    // should land here; the skip is defensive so a future non-noop guard cannot create
    // a nameless category.
    if (kind === "") continue;
    categories.push({ kind, label: labelFor(kind, "hidden"), count: uniques.size, disposition: "hidden" });
  }
  for (const [kind, uniques] of reviewUnique) {
    categories.push({ kind, label: labelFor(kind, "review"), count: uniques.size, disposition: "review" });
  }
  if (reviewFlags.length > 0) {
    categories.push({
      kind: "maybe-personal",
      label: labelFor("maybe-personal", "review"),
      count: reviewFlags.length,
      disposition: "review",
    });
  }
  // Hidden rows first (what actually changed), then review rows; within a disposition
  // the biggest bucket first so the review screen leads with what matters most.
  categories.sort((a, b) =>
    a.disposition === b.disposition ? b.count - a.count : a.disposition === "hidden" ? -1 : 1,
  );


  // ---- reassemble parallel output shape ----
  const outConvs: Array<{ title?: string; turns: string[][] }> = conversations.map((conv) => ({
    title: conv.title,
    turns: conv.turns.map((t) => t.texts.map((x) => x.text)),
  }));
  for (const field of fields) {
    const red = redactedByOrdinal.get(field.ordinal)!;
    const conv = outConvs[field.convIndex]!;
    if (field.loc.type === "title") conv.title = red;
    else conv.turns[field.loc.turnIndex]![field.loc.textIndex] = red;
  }

  return {
    conversations: outConvs,
    categories,
    reviewFlags,
    keptPlaceholders,
    appliedOriginals: [...appliedByOriginal.values()],
    personMap: store.personMap(),
  };
}
