// KAIte/react/lib/format.ts
//
// Display helpers for the profile dashboard.

import type { ReflectionSummary } from "../../logic/types";

/** 0..1 ratio -> whole-number percent string for display and CSS widths. */
export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** One decimal place, with a trailing ".0" dropped (so 3, not "3.0"). */
export function round(x: number): string {
  return (Math.round(x * 10) / 10).toString();
}

/**
 * Picks ONE affirming observation to show under the dashboard. Checks run in
 * priority order and the first threshold met wins; the fallback deliberately
 * avoids implying a "right" pattern.
 */
export function strengthNote(s: ReflectionSummary): string {
  if (s.interaction.followUpRate >= 0.4) {
    return "You often go back and forth with AI rather than taking the first answer — that back-and-forth is where a lot of your thinking shows up.";
  }
  if (s.interaction.explanationSeekingRate >= 0.2) {
    return "You regularly ask the AI to explain things, not just produce them — a sign you're working to understand, not only to finish.";
  }
  if (s.prompting.specificityRatio >= 0.4) {
    return "Your prompts tend to be specific and context-rich, which usually means you're steering the work rather than handing it over.";
  }
  return "There's no single 'right' pattern here. The point of the reflection is to look at what's true for you and decide what, if anything, you'd want to shift.";
}
