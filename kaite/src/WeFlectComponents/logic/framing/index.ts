// KAIte/logic/framing/index.ts (copy of src/framing.ts)
//
// Per-session conversation-framing preferences, chosen by the student on the
// framing screen before the reflection starts. Single source of truth shared
// by the client (renders the Likert rows from FRAMING_DIMENSIONS) and the
// server (validates the wire payload, renders the system-prompt section).
// BASE_PROMPT is never modified — renderFraming() output is appended per
// session, mirroring renderSummary() in reflection.ts. No Node APIs here:
// this module is bundled into the browser client.

/** The six adjustable dimensions; each is one Likert row on the framing screen. */
export type FramingDimensionId =
  | "directness"
  | "questionStyle"
  | "challengeLevel"
  | "scope"
  | "pacing"
  | "feedbackOrientation";

/**
 * Everything the UI and the prompt need for one dimension, kept together so
 * the student-facing wording and the agent-facing instruction cannot drift.
 */
export interface FramingDimension {
  id: FramingDimensionId;
  /** Row heading on the framing screen and bold label in the prompt. */
  title: string;
  /** The question shown to the student above the 1–5 scale. */
  question: string;
  /** Student-facing anchor labels for scale points 1, 3, and 5. */
  anchors: { low: string; mid: string; high: string };
  /** Agent-facing instruction per band: 1–2 -> low, 3 -> mid, 4–5 -> high. */
  guidance: { low: string; mid: string; high: string };
}

/** The student's answers: one 1–5 level per dimension plus optional free text. */
export interface FramingPreferences {
  directness: number;
  questionStyle: number;
  challengeLevel: number;
  scope: number;
  pacing: number;
  feedbackOrientation: number;
  /** Optional "in my own words" free text; capped at CUSTOM_MAX_CHARS. */
  custom?: string;
}

// Cap on the free-text box, enforced by the textarea (client) and again by
// normalizeFraming (server). 500 chars is enough for a few sentences of
// preference while bounding how much unstructured student text can land in
// the system prompt.
export const CUSTOM_MAX_CHARS = 500;

// Array order is significant: it is the row order on the framing screen
// (client/main.ts renderFramingRows) AND the bullet order in the prompt
// section, so the student sees the two in the same sequence.
export const FRAMING_DIMENSIONS: FramingDimension[] = [
  {
    id: "directness",
    title: "Directness",
    question: "How direct should the agent be about patterns it notices in your usage?",
    anchors: {
      low: "Gentle — leads with strengths, softens observations",
      mid: "Balanced — honest but tactful",
      high: "Direct — states observations plainly, including uncomfortable ones",
    },
    guidance: {
      low: "Soften observations and lead with strengths; raise sensitive patterns gently, one at a time.",
      mid: "Be honest but tactful: name patterns clearly while keeping a warm, considerate tone.",
      high: "State observations plainly, including uncomfortable ones. The student has asked you not to soften what the logs suggest.",
    },
  },
  {
    id: "questionStyle",
    title: "Question style",
    question: "Should the agent mostly ask, or mostly tell?",
    anchors: {
      low: "Socratic — asks questions, lets you reach your own conclusions",
      mid: "Collaborative — a mix of questions and observations",
      high: "Analytical — shares its analysis and you react to it",
    },
    guidance: {
      low: "Work Socratically: mostly ask questions and let the student reach their own conclusions; hold back your analysis unless they ask for it.",
      mid: "Blend questions and observations roughly evenly — offer a thought, then invite theirs.",
      high: "Lead with your analysis of the logs and invite the student to react to it; fewer questions, more synthesis.",
    },
  },
  {
    id: "challengeLevel",
    title: "Challenge level",
    question: "How much should the agent push on your own read of your usage?",
    anchors: {
      low: "Affirming — accepts your framing of your usage",
      mid: "Curious — probes gently at inconsistencies",
      high: "Devil's advocate — actively challenges your interpretations",
    },
    guidance: {
      low: "Accept the student's framing of their own usage; do not push back on their self-assessments.",
      mid: "Probe gently when something the student says seems inconsistent with the logs or with what they said earlier.",
      high: "Act as a devil's advocate: actively challenge the student's interpretations and self-assessments. They explicitly invited disagreement — respectful pushback honors that request.",
    },
  },
  {
    id: "scope",
    title: "Scope",
    question: "What should the conversation cover?",
    anchors: {
      low: "My AI usage only",
      mid: "Usage plus related work and study habits",
      high: "Wherever the conversation goes",
    },
    guidance: {
      low: "Keep the conversation strictly on the student's AI usage as shown in the profile; steer back if it drifts elsewhere.",
      mid: "Cover AI usage plus closely related work and study habits, but no further.",
      high: "Follow the conversation wherever the student takes it, treating their AI usage as a starting point rather than a boundary.",
    },
  },
  {
    id: "pacing",
    title: "Pacing and depth",
    question: "How deep should each thread go?",
    anchors: {
      low: "Brief check-in — short exchanges, high-level takeaways",
      mid: "Moderate — follows the most promising thread or two",
      high: "Deep dive — longer turns, follows threads",
    },
    guidance: {
      low: "Keep it a brief check-in: short exchanges, surface the highest-level takeaways, and move toward closing early.",
      mid: "Moderate depth: follow the most promising one or two threads, then consolidate.",
      high: "Go deep: follow threads across multiple turns and let the student sit with a topic before moving on.",
    },
  },
  {
    id: "feedbackOrientation",
    title: "Feedback orientation",
    question: "What should the reflection aim for?",
    anchors: {
      low: "Just the data — a descriptive audit, no interpretation or advice",
      mid: "Understanding — help me see my patterns",
      high: "Improvement — help me find concrete changes",
    },
    guidance: {
      low: "Stay descriptive: report what the data shows without interpretation or advice.",
      mid: "Optimize for understanding: help the student see and make sense of their own patterns.",
      high: "Optimize for improvement: help the student identify concrete changes to experiment with (still framed as optional invitations, never prescriptions).",
    },
  },
];

// Default level for a missing or unparseable answer: the neutral "mid" band,
// which matches the radio the framing screen pre-selects.
const MIDPOINT = 3;

// Coerce one untrusted level into 1..5. Non-numeric or NaN → MIDPOINT;
// fractional values are rounded rather than rejected so a slightly odd client
// still gets a sensible band.
function clampLevel(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return MIDPOINT;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/**
 * Validate an untrusted wire payload into FramingPreferences. Out-of-range or
 * missing levels fall back into 1–5 (midpoint when absent); custom text is
 * trimmed and capped. Returns null for non-object input (framing omitted).
 */
export function normalizeFraming(input: unknown): FramingPreferences | null {
  // Arrays pass this check too; they simply yield all-midpoint prefs, which
  // is harmless.
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;
  // Built up key by key from FRAMING_DIMENSIONS so unknown keys in the
  // payload are dropped and every known dimension is guaranteed present.
  const prefs = {} as FramingPreferences;
  for (const dim of FRAMING_DIMENSIONS) {
    prefs[dim.id] = clampLevel(raw[dim.id]);
  }
  if (typeof raw.custom === "string") {
    const custom = raw.custom.trim().slice(0, CUSTOM_MAX_CHARS);
    if (custom) prefs.custom = custom;
  }
  return prefs;
}

// Map a 1–5 level to one of three instruction bands (1–2 low, 3 mid, 4–5
// high). Three bands, not five, because the agent-facing wording only needs
// to distinguish "lean one way", "neutral", "lean the other way".
function guidanceFor(dim: FramingDimension, level: number): string {
  if (level <= 2) return dim.guidance.low;
  if (level >= 4) return dim.guidance.high;
  return dim.guidance.mid;
}

/**
 * Render the student's framing preferences as a Markdown section for the
 * system prompt. Appended after the profile by buildSystemPrompt().
 */
export function renderFraming(prefs: FramingPreferences): string {
  const lines: string[] = [];
  lines.push("## How the student asked you to run this conversation");
  lines.push("");
  // Precedence clause: these choices override the Voice section's tone
  // guidance (e.g. a "devil's advocate" challenge level beats "validate
  // before exploring"), but the privacy and non-judgment rules are carved out
  // so no preference can relax them.
  lines.push(
    "Before this session began, the student set the preferences below (each on " +
      "a 1–5 scale) for how they want you to conduct this reflection. They " +
      "chose these themselves: treat them as explicit permission for the " +
      "stance each one describes. Where a preference conflicts with the tone " +
      "guidance in the Voice section above (for example, how much to challenge " +
      "the student's own interpretations), the student's choice here wins. The " +
      "privacy rules never change: no personal identifiers, no raw-log " +
      "references, no judgments of motivation or character."
  );
  lines.push("");
  for (const dim of FRAMING_DIMENSIONS) {
    const level = prefs[dim.id];
    lines.push(
      `- **${dim.title}** — ${level}/5 (1 = ${dim.anchors.low}; 5 = ${dim.anchors.high}). ${guidanceFor(dim, level)}`
    );
  }
  // The custom text is the only free-form student input that reaches the
  // system prompt. Whitespace is collapsed so it reads as one quoted sentence;
  // it is NOT otherwise escaped (a double quote inside it ends the quotation
  // early but cannot break out of the prompt structure). Length is already
  // capped by normalizeFraming.
  if (prefs.custom) {
    lines.push("");
    lines.push(
      `The student also added, in their own words: "${prefs.custom.replace(/\s+/g, " ")}". ` +
        "Honor this alongside the scales above."
    );
  }
  return lines.join("\n");
}
