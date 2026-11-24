// KAIte/logic/summary/index.ts (copy of src/client/summarize.ts)
//
// Derives the spec's ReflectionSummary (Documents/WeFlect_Specification.md §5a)
// from a normalized ConversationLog. Runs entirely client-side; only the
// returned summary is sent to the server / model. The input is the DECIDED,
// redacted log (main.ts applies review decisions first), so titles that reach
// `examples` are already redacted.
//
// Classification is keyword-based in v1: case-insensitive substring hits over
// the user's own turns (assistant text is ignored so the model's vocabulary
// cannot vote). The spec explicitly accepts that this will misclassify some
// conversations, and the agent is told to treat all of it as hypotheses the
// student can correct. Every threshold below is a hand-picked constant;
// where no rationale is recorded the comment says so.

import {
  Conversation,
  ConversationLog,
  DomainBubble,
  Domain,
  InteractionBehavior,
  IntensityMetrics,
  OwnershipSignal,
  PromptingBehavior,
  Purpose,
  PurposeBreakdown,
  ReflectionSummary,
  RelianceSignals,
} from "../types";

// --- Label maps -------------------------------------------------------------

// Student-facing display names. These are the ONLY strings that ui.ts
// interpolates into innerHTML (bubbles, purpose bars), so they must stay
// constant program text, never derived from conversation content.
const DOMAIN_LABELS: Record<Domain, string> = {
  coding: "Coding",
  writing: "Writing",
  research: "Research",
  studying: "Studying",
  brainstorming: "Brainstorming",
  debugging: "Debugging",
  design: "Design",
  presenting: "Presenting",
  career: "Career",
  personal: "Personal",
  other: "Other",
};

// Same invariant as DOMAIN_LABELS: constant text only.
const PURPOSE_LABELS: Record<Purpose, string> = {
  "quick-questions": "Quick questions",
  learning: "Learning and understanding",
  "getting-help": "Getting help with work",
  brainstorming: "Brainstorming and ideas",
};

// --- Keyword tables ---------------------------------------------------------

// Matched by plain `includes` on lowercased text, so each needle is a substring
// test, not a word test. Entries with padding spaces (" git ", "ui ", "ux ")
// exist to dodge common substring collisions ("digit", "build", "flux");
// most others accept the looseness. A needle may appear under two domains
// ("cover letter" is both writing and career) — it then scores for both and
// the tie rule in classifyDomain decides. Key order matters: it is the
// tie-break order (first key wins on equal score), so coding sits first.
const DOMAIN_KEYWORDS: Record<Exclude<Domain, "other">, string[]> = {
  coding: ["code", "function", "compile", "syntax", "python", "javascript", "typescript", "java", "c++", "variable", "array", "api", "repository", " git ", "class", "method", "refactor", "implement", "algorithm", "regex", "sql", "html", "css", "react", "node", "terminal"],
  debugging: ["debug", "stack trace", "traceback", "doesn't work", "does not work", "not working", "fix the bug", "failing test", "crash", "exception", "error message", "why is this failing"],
  writing: ["essay", "paragraph", "write a", "draft", "rephrase", "proofread", "grammar", "thesis statement", "cover letter", "rewrite", "tone", "wording", "edit my", "summarize this"],
  research: ["research", "sources", "citation", "cite", "literature", "find studies", "background on", "summarize the article", "academic paper"],
  studying: ["study", "exam", "quiz", "flashcard", "practice problem", "review for", "midterm", "final exam", "understand the topic", "homework"],
  brainstorming: ["brainstorm", "ideas for", "ideate", "possibilities", "list of options", "name some", "topics for", "suggestions for"],
  design: ["design", "figma", "wireframe", "mockup", "color scheme", "logo", "layout", "ui ", "ux "],
  presenting: ["presentation", "slides", "powerpoint", "pitch", "speech", "talk script"],
  career: ["resume", "cv", "interview", "internship", "job application", "career", "linkedin", "cover letter"],
  personal: ["recipe", "workout", "travel", "plan a trip", "budget", "relationship advice", "personal advice"],
};

// Behaviour cues, each counted per conversation (a conversation either shows
// the behaviour or does not; frequency within it is not measured):
//   REVISION     — the student pushed back on or corrected an answer
//   EXPLANATION  — the student asked to understand, not just to get output
//   COLLAB       — group-work vocabulary; sets hasCollaborationSignal so the
//                  agent can ask about shared ownership
//   QUICK_Q      — lookup-style openers
//   GETTING_HELP — "do it for me" verbs; also used as the getting-help purpose test
const REVISION_KEYWORDS = ["no,", "actually", "that's wrong", "thats wrong", "instead", "redo", "doesn't work", "does not work", "not what i", "try again", "incorrect", "wrong", "change it", "rewrite"];
const EXPLANATION_KEYWORDS = ["why", "explain", "how does", "what does this do", "walk me through", "help me understand", "can you clarify"];
const COLLAB_KEYWORDS = ["group project", "group assignment", "groupmate", "teammate", "team member", "our team", "our project", "we're working", "we are working", "classmate", "partner", "collaborat", "group work"];
const QUICK_Q_KEYWORDS = ["what is", "what's", "define", "meaning of", "who is", "when is", "how many"];
const GETTING_HELP_KEYWORDS = ["fix", "write me", "do this", "complete", "solve", "check my", "revise", "code for", "homework", "assignment", "finish", "debug"];

// --- Helpers ----------------------------------------------------------------

// All of a conversation's user turns as one lowercase blob. Only user turns:
// the student's own words are the signal; the assistant's reply would echo
// every keyword back and swamp the classifier.
function userText(conv: Conversation): string {
  return conv.turns
    .filter((t) => t.role === "user")
    .map((t) => t.text)
    .join("\n")
    .toLowerCase();
}

// Number of DISTINCT needles present, not total occurrences. A conversation
// that says "python" fifty times scores 1, so long chats do not out-vote
// short ones purely on length.
function countHits(haystack: string, needles: string[]): number {
  let n = 0;
  for (const needle of needles) if (haystack.includes(needle)) n++;
  return n;
}

// Highest distinct-keyword score wins; a score of 0 everywhere yields "other".
// Ties keep the FIRST domain in DOMAIN_KEYWORDS key order (strict `>`), which
// is why that order is meaningful. The title is included because for Gemini
// and plaintext imports it may be the only text, and for official exports it
// is often a tidy summary of the topic.
function classifyDomain(conv: Conversation): Domain {
  const text = (conv.title + "\n" + userText(conv)).toLowerCase();
  let best: Domain = "other";
  let bestScore = 0;
  (Object.keys(DOMAIN_KEYWORDS) as Array<Exclude<Domain, "other">>).forEach((domain) => {
    const score = countHits(text, DOMAIN_KEYWORDS[domain]);
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  });
  return best;
}

// Purpose is a fixed priority ladder, not a vote: brainstorming > getting-help
// > learning > quick-questions. Earlier rungs are rarer and more specific, so
// one hit is taken as decisive; the common "fix/write me" vocabulary would
// otherwise swallow everything. The inline brainstorming list is deliberately
// NOT DOMAIN_KEYWORDS.brainstorming: it adds broader cues ("suggest",
// "options") that signal ideation as a purpose without marking the whole
// conversation's domain as brainstorming.
function classifyPurpose(conv: Conversation): Purpose {
  const text = userText(conv);
  if (countHits(text, ["brainstorm", "ideas for", "suggest", "options", "possibilities"]) > 0) {
    return "brainstorming";
  }
  if (countHits(text, GETTING_HELP_KEYWORDS) > 0) return "getting-help";
  if (countHits(text, EXPLANATION_KEYWORDS) > 0) return "learning";
  // No cue words: a single short prompt (< 80 chars average) reads as a quick
  // lookup. The 80-char cut is a hand-picked constant; rationale not recorded.
  if (countHits(text, QUICK_Q_KEYWORDS) > 0 || (!conv.metadata.multiTurn && conv.metadata.avgUserPromptLength < 80)) {
    return "quick-questions";
  }
  // Still undecided: sustained back-and-forth is assumed to be task help.
  return conv.metadata.multiTurn ? "getting-help" : "quick-questions";
}

// A prompt counts as "specific" if it is long (> 120 chars), carries a code
// fence (the student supplied material), or uses constraint/requirement
// language. Any one is enough. The 120-char cut is a hand-picked constant.
function isSpecific(prompt: string): boolean {
  if (prompt.length > 120) return true;
  if (prompt.includes("```")) return true;
  return /\b(given|constraints?|for example|specifically|requirements?|must|should)\b/i.test(prompt);
}

// Five equal 0.2-wide bands over the 0..1 ownership value. The labels are the
// student-facing wording of the ownership gauge on the dashboard; the middle
// band is named "Even collaboration" so the default (0.4 base, see summarize)
// lands in neutral territory.
function ownershipLabel(value: number): OwnershipSignal["label"] {
  if (value < 0.2) return "AI-led";
  if (value < 0.4) return "Mostly AI";
  if (value < 0.6) return "Even collaboration";
  if (value < 0.8) return "Mostly you";
  return "Clearly you";
}

// Division that treats an empty denominator as 0 rather than NaN, so an empty
// log still produces a well-formed summary.
function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

// --- Main -------------------------------------------------------------------

/**
 * Build the ReflectionSummary for a log. Pure in effect except for one
 * deliberate side-channel: each conversation's `metadata.estimatedDomain` is
 * written so the classification is available alongside the conversation (for
 * tests and any later per-conversation display) without a second pass.
 * Everything else is derived into the returned object.
 */
export function summarize(log: ConversationLog): ReflectionSummary {
  const convs = log.conversations;
  const n = convs.length;

  // Intensity / timing
  const userPromptCount = convs.reduce((s, c) => s + c.metadata.userPromptCount, 0);
  const totalTurnCount = convs.reduce((s, c) => s + c.metadata.turnCount, 0);
  const multiTurnConvs = convs.filter((c) => c.metadata.multiTurn).length;
  const dates = convs
    .map((c) => c.timestamp)
    .filter((t): t is string => !!t)
    .sort();

  const intensity: IntensityMetrics = {
    conversationCount: n,
    userPromptCount,
    avgPromptsPerConversation: n > 0 ? userPromptCount / n : 0,
    totalTurnCount,
    multiTurnRatio: ratio(multiTurnConvs, n),
    singleTurnRatio: ratio(n - multiTurnConvs, n),
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
  };

  // Domain bubbles. Up to three example titles per domain give the student
  // something concrete to check the label against on the dashboard.
  const domainCounts = new Map<Domain, { count: number; examples: string[] }>();
  for (const conv of convs) {
    const domain = classifyDomain(conv);
    // Intentional mutation of the input (see the JSDoc above).
    conv.metadata.estimatedDomain = domain;
    const entry = domainCounts.get(domain) ?? { count: 0, examples: [] };
    entry.count++;
    if (entry.examples.length < 3) entry.examples.push(conv.title);
    domainCounts.set(domain, entry);
  }
  const domains: DomainBubble[] = [...domainCounts.entries()]
    .map(([domain, { count, examples }]) => ({
      domain,
      label: DOMAIN_LABELS[domain],
      count,
      share: ratio(count, n),
      examples,
    }))
    .sort((a, b) => b.count - a.count);

  // Purpose breakdown. Iterating a fixed purpose list (rather than the map's
  // insertion order) before sorting makes the output deterministic when two
  // purposes tie on count, since Array.sort is stable.
  const purposeCounts = new Map<Purpose, number>();
  for (const conv of convs) {
    const p = classifyPurpose(conv);
    purposeCounts.set(p, (purposeCounts.get(p) ?? 0) + 1);
  }
  const purposes: PurposeBreakdown[] = (
    ["getting-help", "quick-questions", "learning", "brainstorming"] as Purpose[]
  )
    .map((purpose) => {
      const count = purposeCounts.get(purpose) ?? 0;
      return { purpose, label: PURPOSE_LABELS[purpose], count, share: ratio(count, n) };
    })
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  // Prompting behavior
  const allUserPrompts = convs.flatMap((c) => c.turns.filter((t) => t.role === "user").map((t) => t.text));
  const specificCount = allUserPrompts.filter(isSpecific).length;
  const avgUserPromptLength =
    allUserPrompts.length > 0
      ? allUserPrompts.reduce((s, p) => s + p.length, 0) / allUserPrompts.length
      : 0;
  const prompting: PromptingBehavior = {
    avgUserPromptLength,
    specificityRatio: ratio(specificCount, allUserPrompts.length),
  };

  // Interaction behavior. followUpRate and oneShotAcceptanceRate are aliases
  // of the intensity ratios: v1 has no finer signal for "followed up" than
  // "sent more than one prompt", so the two views share one number.
  const revisionConvs = convs.filter((c) => countHits(userText(c), REVISION_KEYWORDS) > 0).length;
  const explanationConvs = convs.filter((c) => countHits(userText(c), EXPLANATION_KEYWORDS) > 0).length;
  const interaction: InteractionBehavior = {
    followUpRate: intensity.multiTurnRatio,
    revisionRate: ratio(revisionConvs, n),
    explanationSeekingRate: ratio(explanationConvs, n),
    oneShotAcceptanceRate: intensity.singleTurnRatio,
  };

  // Ownership signal (0 = AI-led ... 1 = clearly you). A hand-weighted linear
  // blend: 0.4 base puts a log with no signals at the bottom of "Even
  // collaboration"; follow-up (0.25) and revision (0.2) count most because
  // they show the student steering, explanation-seeking (0.15) less, and
  // one-shot acceptance (-0.2) pulls toward AI-led. Max reachable is 1.0,
  // min 0.2, before clamping. The weights are not derived from data.
  const ownershipValue = clamp01(
    0.4 +
      0.25 * interaction.followUpRate +
      0.2 * interaction.revisionRate +
      0.15 * interaction.explanationSeekingRate -
      0.2 * interaction.oneShotAcceptanceRate
  );
  const ownership: OwnershipSignal = {
    value: ownershipValue,
    label: ownershipLabel(ownershipValue),
  };

  // Reliance signals (HYPOTHESES, not conclusions). Booleans with hand-picked
  // cut points: fewer than 15% of conversations showing revision or
  // explanation-seeking, or 15+ conversations in total. lowVisibleVerification
  // and limitedRevisionOrChallenge are the SAME test today — v1 has no separate
  // verification cue, so pushing back is the only visible proxy for checking.
  // The caveat text travels with the signals: src/reflection.ts inlines it into
  // the profile text the model receives.
  const reliance: RelianceSignals = {
    lowVisibleVerification: interaction.revisionRate < 0.15,
    highRepeatedReliance: n >= 15,
    limitedExplanationSeeking: interaction.explanationSeekingRate < 0.15,
    limitedRevisionOrChallenge: interaction.revisionRate < 0.15,
    caveat:
      "These are signals visible in the logs only. The student may have verified, " +
      "tested, or cross-checked AI output in ways the logs do not capture. Treat " +
      "every reliance signal as a question to explore, never a conclusion.",
  };

  const hasCollaborationSignal = convs.some((c) => countHits(userText(c), COLLAB_KEYWORDS) > 0);

  return {
    intensity,
    domains,
    purposes,
    ownership,
    prompting,
    interaction,
    reliance,
    hasCollaborationSignal,
  };
}

// Keep the ownership value inside the 0..1 range the gauge and labels assume.
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
