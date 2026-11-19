// KAIte/react/lib/decisions.ts
//
// The student's review decisions as plain state: a RedactionDecisions object
// that applyDecisions (logic/findings) accepts directly.
//
// One rule for every checkbox: a tick means "this leaves the shared output".
//   section 1 Redact?   ticked by default   -> unticked rows go in preserveOriginals
//   section 2 Redact?   unticked by default -> ticked rows go in redactPreserved
//   section 3 Exclude?  ticked by default   -> ticked rows go in excludeConversations

import { ALWAYS_REDACT_KINDS, RedactionDecisions } from "../../logic/findings";
import type { AppliedOriginal, RedactionResult } from "../../logic/types";

/**
 * The applied redactions the student is asked about (section 1 rows). Kinds
 * that are always redacted are left out: there is nothing to ask.
 */
export function reviewableOriginals(r: RedactionResult): AppliedOriginal[] {
  return (r.appliedOriginals ?? []).filter((a) => !ALWAYS_REDACT_KINDS.has(a.kind));
}

/**
 * The findings panel is shown only when something was redacted or numbered.
 * Known gap, kept from weflect: flags or kept placeholders without any applied
 * redaction are not shown.
 */
export function hasFindings(r: RedactionResult): boolean {
  return !!r.appliedOriginals || !!r.personMap;
}

/**
 * Decisions that match the panel's default ticks. When the panel is hidden
 * there are no checkboxes, so nothing is excluded (the identity decision).
 */
export function defaultDecisions(r: RedactionResult): RedactionDecisions {
  const flagged = hasFindings(r) ? (r.reviewFlags ?? []).map((f) => f.conversationId) : [];
  return {
    preserveOriginals: [],
    redactPreserved: [],
    excludeConversations: [...new Set(flagged)],
  };
}

/** Return `list` with `key` present or absent, without mutating it. */
export function withMember(list: readonly string[], key: string, present: boolean): string[] {
  const rest = list.filter((k) => k !== key);
  return present ? [...rest, key] : rest;
}
