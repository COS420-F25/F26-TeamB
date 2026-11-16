/**
 * Tier-3 maybe-personal topic flagging — conversation-level, disposition ALWAYS
 * "review", text NEVER modified (hard rule 3 in
 * agents/ai-redaction-agent-prototype/.claude/CLAUDE.md: flag and ask; the student
 * decides).
 *
 * How a flag is decided (see flagConversation): the best-weighted hit per keyword is
 * collected across the title and all turns (title and user turns weigh 1, assistant
 * echoes 0.5), hits are summed per subkind, and the subkind with the largest total
 * "wins". The conversation is flagged when EITHER the winner has strong weight ≥ 1
 * (a STRONG keyword in the title or a user turn) OR the total weight across ALL
 * subkinds reaches 2 — e.g. two distinct weak user hits, or one weak user hit plus two
 * assistant echoes, in any mix of subkinds. Programmer-chat traps handled: `PIP`
 * matches case-sensitively (never `pip install`), "debt" is skipped after "technical".
 */

/**
 * NOTE: exported but unused — nothing in this folder or the app imports it; the hit
 * record actually used is the inline `{ list, k, weight }` shape below.
 */
export interface TopicHit {
  subkind: string;
  keyword: string;
  weight: number;
}

/** The flag surfaced on the review screen (session.ts copies subkind / reason / question into ReviewFlag). */
export interface ConversationFlag {
  subkind: string;
  reason: string;
  question: string;
  keywords: string[];
}

/**
 * One keyword rule. `strong` = sufficient on its own from the title or a user turn;
 * weak keywords only accumulate. `name` is the label shown in the reason text and is
 * also the dedupe key, so two regexes sharing a name ("girlfriend" / "boyfriend" →
 * "relationship") count as ONE hit.
 */
interface Keyword {
  rx: RegExp;
  name: string;
  strong: boolean;
  /**
   * Skip the match when this pattern matches the 16 chars before it — enough for
   * "technical " plus a short word; a longer window would let an unrelated earlier
   * word veto the hit.
   */
  notAfter?: RegExp;
}

/** A subkind with its student-facing label (used in the question text) and its keywords. */
interface TopicList {
  subkind: string;
  label: string;
  keywords: Keyword[];
}

// Terse constructor so the table below reads one rule per line.
const kw = (rx: RegExp, name: string, strong: boolean, notAfter?: RegExp): Keyword => ({
  rx,
  name,
  strong,
  notAfter,
});

/**
 * Keyword table. Per list, STRONG entries are words that almost only occur when the
 * topic is personal (a prescription, a lawsuit, a PIP); WEAK entries also occur in
 * ordinary work talk (manager, loan, clinic) and need company. Drawn from the
 * prototype's persona corpus (agents/ai-redaction-agent-prototype/data/personas); the
 * strong / weak split is a judgement call, not a measured one.
 */
const TOPICS: TopicList[] = [
  {
    subkind: "medical",
    label: "personal medical",
    // Strong: clinical vocabulary and conditions; weak: words a student also uses
    // about a project or a campus service.
    keywords: [
      kw(/\bprescri(?:bed|ption|ber)\b/i, "prescription", true),
      kw(/\bdiagnos\w*/i, "diagnosis", true),
      kw(/\btherap(?:y|ist)\b/i, "therapy", true),
      kw(/\bmedication\b/i, "medication", true),
      kw(/\bdosage\b/i, "dosage", true),
      kw(/\bsymptoms?\b/i, "symptoms", true),
      kw(/\bside effects?\b/i, "side effects", true),
      kw(/\banxiety\b/i, "anxiety", true),
      kw(/\bdepress(?:ed|ion)\b/i, "depression", true),
      kw(/\bADHD\b/, "ADHD", true),
      kw(/\binsomnia\b/i, "insomnia", true),
      kw(/\bpanic attacks?\b/i, "panic attack", true),
      kw(/\bpregnan\w*/i, "pregnancy", true),
      kw(/\b(?:pre)?diabet\w*/i, "diabetes", true),
      kw(/\bstutter\w*/i, "stutter", true),
      kw(/\b\d+ ?mg\b/i, "medication dose", true),
      kw(/\bnausea\b/i, "nausea", false),
      kw(/\bpharmacist\b/i, "pharmacist", false),
      kw(/\bsupplements?\b/i, "supplement", false),
      kw(/\bclinic\b/i, "clinic", false),
      kw(/\bmy (?:doctor|meds|medicine)\b/i, "doctor", false),
    ],
  },
  {
    subkind: "workplace",
    label: "workplace/interpersonal",
    // Strong: HR / discipline events; weak: everyday people-and-meetings words that
    // a software chat mentions constantly ("ask my manager", "1:1").
    keywords: [
      kw(/\bPIP\b/, "PIP", true), // case-sensitive: never `pip install`
      kw(/\bverbal warning\b/i, "verbal warning", true),
      kw(/\bperformance (?:review|improvement)\b/i, "performance review", true),
      kw(/\bfired\b/i, "fired", true),
      kw(/\blaid off\b/i, "laid off", true),
      kw(/\bharass\w*/i, "harassment", true),
      kw(/\bbull(?:y|ying|ied)\b/i, "bullying", true),
      kw(/\bdisciplinary\b/i, "disciplinary", true),
      kw(/\bgrievance\b/i, "grievance", true),
      kw(/\bco-?workers?\b/i, "coworker", false),
      kw(/\bboss\b/i, "boss", false),
      kw(/\bmanager\b/i, "manager", false),
      kw(/\blab ?mates?\b/i, "labmate", false),
      kw(/\bteas(?:ing|ed|es)\b/i, "teasing", false),
      kw(/\badvisor\b/i, "advisor", false),
      kw(/\bhumiliat\w*/i, "humiliated", false),
      kw(/\bembarrass\w*/i, "embarrassed", false),
      kw(/\bresign\w*/i, "resignation", false),
      kw(/\bin front of (?:everyone|the whole)/i, "public criticism", false),
      kw(/\bvent(?:ing)?\b/i, "venting", false),
      kw(/\b1:1\b/, "1:1 meeting", false),
    ],
  },
  {
    subkind: "financial-legal",
    label: "financial/legal",
    // Strong: legal / immigration / banking / academic-integrity terms; weak: money
    // words common in ordinary planning talk.
    keywords: [
      kw(/\bNDA\b/, "NDA", true),
      kw(/\blawyer\b/i, "lawyer", true),
      kw(/\battorney\b/i, "attorney", true),
      kw(/\blawsuit\b/i, "lawsuit", true),
      kw(/\bsued\b/i, "sued", true),
      kw(/\barrested\b/i, "arrested", true),
      kw(/\bimmigration\b/i, "immigration", true),
      kw(/\bvisa\b/i, "visa", true),
      kw(/\bpassport\b/i, "passport", true),
      kw(/\bsort code\b/i, "bank details", true),
      kw(/\bbank account\b/i, "bank account", true),
      kw(/\bbankrupt\w*/i, "bankruptcy", true),
      kw(/\bplagiar\w*/i, "plagiarism", true),
      kw(/\bacademic integrity\b/i, "academic integrity", true),
      kw(/\bdebt\b/i, "debt", true, /tech(?:nical)?\s*$/i),
      kw(/\bloan\b/i, "loan", false),
      kw(/\bsalary\b/i, "salary", false),
      kw(/\breimburse\w*/i, "reimbursement", false),
      kw(/\btaxes\b/i, "taxes", false),
    ],
  },
  {
    // Subkind id "mental-health" but labelled "personal": the words are relationship,
    // grief and burnout cues, ALL weak, so this list flags only when two of them (or
    // one plus hits elsewhere) accumulate — a single "burnout" in a study-stress chat
    // is not a flag. The id / label mismatch is historical; the id is what reaches
    // ReviewFlag.subkind, the label is what the student reads.
    subkind: "mental-health",
    label: "personal",
    keywords: [
      kw(/\bbreak ?up\b/i, "breakup", false),
      kw(/\bgirlfriend\b/i, "relationship", false),
      kw(/\bboyfriend\b/i, "relationship", false),
      kw(/\bgrief\b/i, "grief", false),
      kw(/\blonely\b/i, "loneliness", false),
      kw(/\bburn(?:ed|t)? ?out\b/i, "burnout", false),
      kw(/\boverwhelmed\b/i, "overwhelmed", false),
    ],
  },
];

/**
 * Best hit per (subkind, keyword) in one text at the given weight. One hit per keyword
 * per text is enough because weight is per keyword, not per occurrence. The regex is
 * rebuilt with `g` per call so the shared table never carries lastIndex state.
 */
function hitsIn(text: string, weight: number): Map<string, { list: TopicList; k: Keyword; weight: number }> {
  const found = new Map<string, { list: TopicList; k: Keyword; weight: number }>();
  for (const list of TOPICS) {
    for (const k of list.keywords) {
      const rx = new RegExp(k.rx.source, k.rx.flags.includes("g") ? k.rx.flags : k.rx.flags + "g");
      let m: RegExpExecArray | null;
      while ((m = rx.exec(text)) !== null) {
        if (m[0].length === 0) {
          rx.lastIndex++;
          continue;
        }
        if (k.notAfter && k.notAfter.test(text.slice(Math.max(0, m.index - 16), m.index))) continue;
        const key = `${list.subkind}:${k.name}`;
        const prev = found.get(key);
        if (!prev || weight > prev.weight) found.set(key, { list, k, weight });
        break; // one hit per keyword per text is enough
      }
    }
  }
  return found;
}

/**
 * Evaluate one conversation. `title` and user turns weigh 1; assistant turns weigh 0.5.
 * Returns a flag or null. Never modifies anything.
 */
export function flagConversation(
  title: string | undefined,
  turns: ReadonlyArray<{ role: "user" | "assistant"; text: string }>,
): ConversationFlag | null {
  const best = new Map<string, { list: TopicList; k: Keyword; weight: number }>();
  const absorb = (m: Map<string, { list: TopicList; k: Keyword; weight: number }>): void => {
    for (const [key, v] of m) {
      const prev = best.get(key);
      if (!prev || v.weight > prev.weight) best.set(key, v);
    }
  };
  if (title) absorb(hitsIn(title, 1));
  for (const t of turns) absorb(hitsIn(t.text, t.role === "user" ? 1 : 0.5));

  const bySubkind = new Map<string, { list: TopicList; strong: number; total: number; names: string[] }>();
  for (const { list, k, weight } of best.values()) {
    const agg = bySubkind.get(list.subkind) ?? { list, strong: 0, total: 0, names: [] };
    if (k.strong) agg.strong += weight;
    agg.total += weight;
    agg.names.push(k.name);
    bySubkind.set(list.subkind, agg);
  }

  let winner: { list: TopicList; strong: number; total: number; names: string[] } | null = null;
  let combinedTotal = 0;
  for (const agg of bySubkind.values()) {
    combinedTotal += agg.total;
    if (!winner || agg.total > winner.total) winner = agg;
  }
  if (!winner) return null;
  // NOTE: possible bug (attribution). `strong` is read from the WINNER only, and ties
  // go to the subkind encountered first. A strong user hit ("lawsuit", weight 1) next
  // to an earlier weak user hit in another list ("manager", weight 1) loses the tie:
  // the conversation is still flagged (combinedTotal = 2) but under the WEAK subkind,
  // and the strong keyword is absent from reason / question. A strong title or user
  // hit can never be missed outright (it either wins, or makes combinedTotal ≥ 2);
  // only its attribution can be wrong.
  const flagged = winner.strong >= 1 || combinedTotal >= 2;

  if (!flagged) return null;

  const keywords = [...new Set(winner.names)].slice(0, 4);
  return {
    subkind: winner.list.subkind,
    reason: `mentions ${keywords.join(", ")}`,
    question: `This conversation may touch on a ${winner.list.label} topic (${keywords.join(", ")}).`,
    keywords,
  };
}
