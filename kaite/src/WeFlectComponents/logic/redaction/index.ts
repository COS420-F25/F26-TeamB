/**
 * Redactor — WeFlect redaction module (Layer A + B1). Public drop-in surface.
 *
 * Contract: `redactConversations(log) → RedactionResult` with `REDACTION_IS_STUB = false`.
 * The result/option types are the app's own (src/types.ts, re-exported through
 * ./types); the app reaches this module only via src/client/redact.ts — main.ts for
 * the first run, findings.ts `applyDecisions` for the operator's re-run. The engine
 * is a port of the Python prototype in agents/ai-redaction-agent-prototype/ (design:
 * agents/ai-redaction-agent-prototype/docs/SPEC.md). "Layer A" is the deterministic
 * rule table (rules.ts); "Layer B1" the local name / org / location heuristics.
 *
 * Fully local: no network calls, no runtime dependencies, nothing serialized.
 * Internal structures (Candidate spans, the EntityMap) are deliberately NOT exported
 * from this file so raw identifiers cannot leak through the public surface; a test
 * that needs an internal imports its module directly (tests/review.test.ts imports
 * `forcedKeepPlaceholder` from ./rules).
 */

import { runSession, type RedactOptions, type SessionConversation } from "./session";
import type { ConversationLog, RedactionResult } from "./types";

export type { RedactOptions } from "./session";
export type {
  ConversationLog,
  Conversation,
  Turn,
  SourceFormat,
  RedactionResult,
  RedactionCategory,
  RedactionKind,
  ReviewFlag,
  KeptPlaceholder,
  AppliedOriginal,
} from "./types";

/** Real redaction is wired in; the review screen drops its stub notice. */
export const REDACTION_IS_STUB = false;

/** First-run redaction with default options (what main.ts calls on upload). */
export function redactConversations(log: ConversationLog): RedactionResult {
  return redactConversationsWithOptions(log, {});
}

/**
 * Redaction honoring operator decisions from the review screen (`preserveLiterals`,
 * `redactLiterals`; see src/client/findings.ts `applyDecisions`). Always a full re-run
 * over the whole log rather than a patch of the first result: entity numbering, the
 * sweep literals and the tallies are corpus-wide, so one kept name can renumber
 * everything else.
 */
export function redactConversationsWithOptions(
  log: ConversationLog,
  options: RedactOptions = {},
): RedactionResult {
  // Adapter: the session model allows several texts per turn on a "prose" or "tool"
  // channel (the name / topic heuristics run on prose only). The app's Turn is one
  // text, so each turn becomes a single prose text; the tool channel is never used
  // by the app.
  const sessionInput: SessionConversation[] = log.conversations.map((conv) => ({
    id: conv.id,
    title: conv.title,
    turns: conv.turns.map((t) => ({
      role: t.role,
      texts: [{ text: t.text, channel: "prose" as const }],
    })),
  }));

  const result = runSession(sessionInput, options);

  // Re-map by parallel index: runSession returns conversations / turns / texts in
  // exactly the input shape (SessionResult.conversations), so position is the join
  // key and `[0]` is the single prose text built above. The `?? conv.title` /
  // `?? t.text` fallbacks are defensive only — the session never drops an entry —
  // and would leave text UNREDACTED if the shapes ever diverged, so no caller may
  // rely on them.
  const conversations = log.conversations.map((conv, i) => {
    const red = result.conversations[i]!;
    return {
      ...conv,
      title: red.title ?? conv.title,
      turns: conv.turns.map((t, j) => ({
        ...t,
        text: red.turns[j]?.[0] ?? t.text,
      })),
    };
  });

  const out: RedactionResult = {
    conversations,
    categories: result.categories,
  };
  // The additive fields of RedactionResult (src/types.ts) are omitted when empty rather
  // than set to [], so a consumer written against the stub-era shape sees no key at all.
  if (result.reviewFlags.length > 0) out.reviewFlags = result.reviewFlags;

  if (result.keptPlaceholders.length > 0) out.keptPlaceholders = result.keptPlaceholders;
  // Report-only extensions (contain original identifiers — client-side use only).
  if (Object.keys(result.personMap).length > 0) out.personMap = result.personMap;
  if (result.appliedOriginals.length > 0) out.appliedOriginals = result.appliedOriginals;
  return out;
}
