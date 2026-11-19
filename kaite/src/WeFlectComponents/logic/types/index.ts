// KAIte/logic/types/index.ts (copy of src/types.ts)
//
// Shared type contracts for WeFlect, used by BOTH the client (parser,
// redaction engine, summarizer, findings report, UI) and the server
// (server.ts, system-prompt builder, conversation logger). Keeping them in one
// file is what lets the two builds (esbuild bundle + tsc) agree on the wire
// shape without a shared package.
//
// Design notes (v1), grounded in Documents/WeFlect_Specification.md §5a:
//   - The raw ConversationLog never leaves the browser. Only the derived,
//     redacted ReflectionSummary is sent to the server / model.
//   - Classification (domain, purpose) is keyword-based in v1; the spec
//     explicitly accepts that this will misclassify some conversations.
//   - Trust/verification/reliance signals are framed as HYPOTHESES, never
//     conclusions ("absence of visible verification != failure to verify").

import { FramingPreferences } from "../framing";

// ---------------------------------------------------------------------------
// Normalized conversation log (parser output) — client-side only
// ---------------------------------------------------------------------------

/**
 * Only two roles survive parsing: system and tool turns from the source
 * exports are dropped, because the reflection is about what the student
 * asked and what the assistant said.
 */
export type Role = "user" | "assistant";

/** Source export format a ConversationLog was parsed from. */
export type SourceFormat =
  | "chatgpt"
  | "claude-ai"
  | "claude-code"
  | "gemini"
  | "plaintext"
  | "unknown";

/** One message in a conversation, flattened to plain text. */
export interface Turn {
  role: Role;
  /** Plain text of the message; rich content blocks are concatenated by the parser. */
  text: string;
  /** ISO 8601 timestamp if the source provides one. */
  timestamp?: string;
}

/**
 * Per-conversation statistics computed once at parse time (see
 * client/parser/util.ts makeConversation) so the summarizer never re-walks
 * the turns. estimatedDomain is the exception: the summarizer fills it in.
 */
export interface ConversationMetadata {
  /** Estimated task domain (coding, writing, ...). Filled by the summarizer. */
  estimatedDomain?: Domain;
  /** Number of distinct user prompts in this conversation. */
  userPromptCount: number;
  /** Total turns (user + assistant). */
  turnCount: number;
  /** True when the user sent more than one prompt (back-and-forth). */
  multiTurn: boolean;
  /** Mean character length of the user's prompts. */
  avgUserPromptLength: number;
}

/** One parsed conversation, independent of which tool exported it. */
export interface Conversation {
  /** Stable within one import (source id when available, else positional). */
  id: string;
  /** ISO 8601 timestamp of the conversation start, if known. */
  timestamp?: string;
  /** Source title or a derived one; truncated for display by the parser. */
  title: string;
  turns: Turn[];
  metadata: ConversationMetadata;
}

/**
 * Everything imported in one session. `source` is the single format all
 * files shared, or "unknown" when the import mixed formats (client/main.ts).
 * This object never leaves the browser.
 */
export interface ConversationLog {
  source: SourceFormat;
  conversations: Conversation[];
}

// ---------------------------------------------------------------------------
// Redaction contract — implemented by src/client/redaction/ (ported from the
// prototype in agents/ai-redaction-agent-prototype/) and re-exported through
// src/client/redact.ts. This file only declares the shape so the review screen
// and findings report can be typed without importing the engine.
// ---------------------------------------------------------------------------

/**
 * Category key for a redaction tally. Deliberately an open union: the engine
 * emits the kinds listed in client/redaction/labels.ts (name, email, phone,
 * secret, url-token, ip, id, org, location, participant) plus the Tier-3
 * "maybe-personal" flag, and new rule kinds must not require a type change
 * here. There is NO "path" kind in practice — file paths keep their structure
 * and only the identifying segment is redacted as a name/username.
 */
export type RedactionKind = "name" | "email" | "path" | "maybe-personal" | string;

export interface RedactionCategory {
  /** What kind of sensitive content this tally covers. */
  kind: RedactionKind;
  /** Human-readable label, e.g. "Names of people". */
  label: string;
  /**
   * How many DISTINCT finds this category covers — one person/email/key mentioned
   * many times counts once. Occurrence detail lives in appliedOriginals.
   */
  count: number;
  /** "hidden" = redacted automatically; "review" = left for the user to decide. */
  disposition: "hidden" | "review";
}

/**
 * Additive, optional extension: a per-conversation Tier-3 flag. The flagged
 * conversation's text is NEVER modified — the student decides keep/cut/edit.
 */
export interface ReviewFlag {
  conversationId: string;
  kind: "maybe-personal";
  /** e.g. "medical" | "workplace" | "financial-legal" | "mental-health" */
  subkind: string;
  /** Student-facing explanation of why the conversation was flagged. */
  reason: string;
  /** The keep/cut question put to the student on the review screen. */
  question: string;
}

/**
 * Additive, optional extension: an obvious placeholder secret (e.g. `sk-ant-...xxxx`)
 * that was deliberately KEPT in the text and noted, rather than treated as a live key.
 */
export interface KeptPlaceholder {
  conversationId: string;
  /** The exact placeholder-looking token that was left in place. */
  text: string;
  /** Why the engine judged it a placeholder rather than a live secret. */
  note: string;
}

/**
 * Additive, optional extension: one distinct redacted original → its placeholder and
 * occurrence count. REPORT-ONLY: contains original identifiers for the client-side
 * findings report; must never be serialized into anything sent to the server.
 * Enforced by construction rather than by type: client/main.ts posts only
 * `state.summary` (a ReflectionSummary), never the RedactionResult.
 */
export interface AppliedOriginal {
  /** The sensitive text as it appeared in the log. */
  original: string;
  /** The placeholder it became, e.g. `[NAME_2]`. */
  replacement: string;
  kind: RedactionKind;
  /** Occurrences across all conversations. */
  count: number;
}

/**
 * Options for a redaction (re-)run. Used by the review screen's decision loop:
 * un-checking a proposed redaction re-runs redaction with that exact original in
 * `preserveLiterals`, so the operator's "keep this" survives the engine's sweep.
 */
export interface RedactionOptions {
  /** Exact strings the operator chose NOT to redact (case-insensitive match). */
  preserveLiterals?: string[];
  /** Exact kept-placeholder texts the operator chose to redact AFTER ALL (exact match). */
  redactLiterals?: string[];
}

/** Output of one redaction run; the input log is never mutated. */
export interface RedactionResult {
  /** Conversations with sensitive spans replaced by placeholders. */
  conversations: Conversation[];
  /** Per-kind tallies surfaced on the redaction-review screen. */
  categories: RedactionCategory[];
  /** Optional (additive): Tier-3 review flags, one per flagged conversation. */
  reviewFlags?: ReviewFlag[];
  /** Optional (additive): placeholder secrets kept in place + noted. */
  keptPlaceholders?: KeptPlaceholder[];
  /**
   * Optional (additive, REPORT-ONLY): entity number → aliases, e.g.
   * `"person 1": "Jordan Rivera / jrivera"`. Client-side findings report only.
   */
  personMap?: Record<string, string>;
  /** Optional (additive, REPORT-ONLY): distinct applied originals with counts. */
  appliedOriginals?: AppliedOriginal[];
}

// ---------------------------------------------------------------------------
// Derived ReflectionSummary (the ONLY thing sent to the server / model)
// Mirrors Documents/WeFlect_Specification.md §5a "ReflectionSummary".
// ---------------------------------------------------------------------------

/**
 * Task domain a conversation is classified into. Assigned by keyword hits in
 * client/summarize.ts; "other" is the fallback when nothing matches.
 */
export type Domain =
  | "coding"
  | "writing"
  | "research"
  | "studying"
  | "brainstorming"
  | "debugging"
  | "design"
  | "presenting"
  | "career"
  | "personal"
  | "other";

/**
 * Why a conversation happened, as guessed from prompt length and cue words
 * (client/summarize.ts classifyPurpose). Coarser than Domain on purpose: the
 * agent uses it to open a conversation, not to make claims.
 */
export type Purpose =
  | "quick-questions"
  | "learning"
  | "getting-help"
  | "brainstorming";

/** AI-use intensity and timing metrics. */
export interface IntensityMetrics {
  conversationCount: number;
  userPromptCount: number;
  avgPromptsPerConversation: number;
  totalTurnCount: number;
  /** Share of conversations that were a single user prompt (0..1). */
  singleTurnRatio: number;
  /** Share of conversations with back-and-forth (0..1). */
  multiTurnRatio: number;
  /** ISO date of earliest conversation, if known. */
  firstDate?: string;
  /** ISO date of latest conversation, if known. */
  lastDate?: string;
}

/** One bubble in the "where AI shows up" visualization. */
export interface DomainBubble {
  domain: Domain;
  label: string;
  /** Number of conversations classified into this domain. */
  count: number;
  /** Share of all conversations (0..1) — drives bubble size. */
  share: number;
  /**
   * A few representative (already-redacted) conversation titles. Shown only
   * as a hover tooltip on the dashboard (client/ui.ts); reflection.ts leaves
   * them out of the system prompt so no title text reaches the model.
   */
  examples: string[];
}

/** One row of the purpose breakdown; shares sum to 1 over all purposes. */
export interface PurposeBreakdown {
  purpose: Purpose;
  /** Student-facing label from client/summarize.ts PURPOSE_LABELS. */
  label: string;
  count: number;
  /** Share of all conversations (0..1). */
  share: number;
}

/**
 * Work-split / ownership signal on a 0..1 scale:
 *   0.0 = AI-led, 0.5 = even collaboration, 1.0 = clearly you.
 * A reflection tool, NOT a grade.
 */
export interface OwnershipSignal {
  value: number;
  label: "AI-led" | "Mostly AI" | "Even collaboration" | "Mostly you" | "Clearly you";
}

/** How the student writes prompts, averaged over every user turn. */
export interface PromptingBehavior {
  /** Mean user prompt length in characters. */
  avgUserPromptLength: number;
  /** Share of user prompts that look specific / context-rich (0..1). */
  specificityRatio: number;
}

/** How the student responds to answers, as shares of conversations. */
export interface InteractionBehavior {
  /**
   * Share of conversations with a follow-up after the first answer (0..1).
   * Currently identical to IntensityMetrics.multiTurnRatio; kept as its own
   * field so the prompt can name it by meaning.
   */
  followUpRate: number;
  /** Share where the user revised or pushed back (0..1). */
  revisionRate: number;
  /** Share where the user asked the AI to explain (0..1). */
  explanationSeekingRate: number;
  /**
   * Share accepted in one shot with no further turns (0..1). Currently
   * identical to IntensityMetrics.singleTurnRatio (client/summarize.ts).
   */
  oneShotAcceptanceRate: number;
}

/**
 * Trust / verification / reliance signals. Every field is a HYPOTHESIS to be
 * explored in conversation, never a conclusion about the student.
 */
export interface RelianceSignals {
  /**
   * Revision rate below the threshold in client/summarize.ts. Pushback and
   * revision requests are the only checking behaviour visible in a log, so
   * their absence is used as a (weak) proxy for low verification.
   */
  lowVisibleVerification: boolean;
  /** Conversation count at or above a fixed floor — a volume signal, not a judgment. */
  highRepeatedReliance: boolean;
  /** Explanation-seeking rate below the threshold ("why does this work?" style prompts). */
  limitedExplanationSeeking: boolean;
  /** Same test as lowVisibleVerification, named for the other reading of the same evidence. */
  limitedRevisionOrChallenge: boolean;
  /** Free-text caveat reminding the agent these are not conclusions. */
  caveat: string;
}

/**
 * The derived profile: the complete payload the server and model ever see.
 * Produced by client/summarize.ts from the REDACTED conversations, rendered
 * into the system prompt by reflection.ts, and drawn on the dashboard by
 * client/ui.ts. Adding a field here means deciding whether the model should
 * see it (reflection.ts) and whether it is safe to send.
 */
export interface ReflectionSummary {
  intensity: IntensityMetrics;
  domains: DomainBubble[];
  purposes: PurposeBreakdown[];
  ownership: OwnershipSignal;
  prompting: PromptingBehavior;
  interaction: InteractionBehavior;
  reliance: RelianceSignals;
  /**
   * Whether the logs contain any collaboration / group-work signal. Tells the
   * agent whether to draw on evidence or ask about group work in general
   * terms ("Connect" was the name of the former middle phase; the prompt is
   * now free-form but the distinction still applies).
   */
  hasCollaborationSignal: boolean;
}

// ---------------------------------------------------------------------------
// Client <-> server wire types
// ---------------------------------------------------------------------------

/** Body of POST /api/session. */
export interface CreateSessionRequest {
  reflectionSummary: ReflectionSummary;
  /**
   * User's consent-screen choice for recording the reflection conversation.
   * Defaults to true when absent; the server's LOG_CONVERSATIONS env var can
   * still disable logging globally.
   */
  logConversation?: boolean;
  /**
   * Conversation-framing preferences chosen on the framing screen (1–5 Likert
   * per dimension, see src/framing.ts). Optional: absent for older clients,
   * in which case the system prompt is built without a framing section.
   */
  framing?: FramingPreferences;
}

/** Response of POST /api/session: the only credential for later turns. */
export interface CreateSessionResponse {
  sessionId: string;
}

/**
 * Body of POST /api/message.
 * NOTE: unused — server.ts types the body inline and client/ui.ts builds the
 * JSON literal; kept as documentation of the wire shape.
 */
export interface SendMessageRequest {
  sessionId: string;
  text: string;
}

/**
 * SSE event payloads streamed back from POST /api/message, one JSON object
 * per `data:` line. "delta" carries display text, "evidence" a marker the
 * model attached, "turn_end" closes the turn, "error" aborts it.
 * NOTE: "phase" is no longer emitted — the prompt dropped phase markers
 * (see server.ts MARKER_RE) and client/ui.ts has no handler for it.
 */
export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "phase"; phase: ReflectionPhase }
  | { type: "evidence"; text: string }
  | { type: "turn_end" }
  | { type: "error"; message: string };

/**
 * The former three-phase structure of the reflection (understand → connect →
 * integrate). Still used by the conversation log and eval transcripts to
 * record any phase markers a prompt emits; the production prompt emits none.
 */
export type ReflectionPhase = "understand" | "connect" | "integrate";
