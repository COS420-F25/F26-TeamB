// KAIte/logic/findings/index.ts (the DOM-free half of src/client/findings.ts)
//
// Review decisions, the limitations checklist, the findings counts and the four
// downloadable report builders. The on-screen rendering lives in
// KAIte/react/components/redaction/.
//
// PRIVACY INVARIANT: these reports deliberately contain ORIGINAL identifiers. They
// are built and downloaded client-side only and must never be included in any
// payload sent to a server.

import { Conversation, ConversationLog, RedactionResult } from "../types";
import { redactConversationsWithOptions } from "../redaction";
import { firstProseLine, stripInjectedContext } from "../parser/util";

// ---------------------------------------------------------------------------
// Operator decisions (the approve loop). ONE rule for every checkbox on the screen:
// a tick means "this leaves the shared output" — hidden or left out; unticking keeps
// something. Defaults differ per section because the safe answer differs:
//   §1 Redact?  — proposed redactions, ticked (hidden unless you untick)
//   §2 Redact?  — deliberate keeps, UNticked (the engine chose to keep them)
//   §3 Exclude? — flagged conversations, ticked (personal content stays out unless you untick)
// The boxes only record intent — nothing is applied until "Looks right, continue",
// when main.ts calls applyDecisions().
// ---------------------------------------------------------------------------

export interface RedactionDecisions {
  /** §1 originals whose "Redact?" box is UNticked — keep these visible. */
  preserveOriginals: string[];
  /** §2 kept-placeholder texts whose "Redact?" box IS ticked — hide these after all. */
  redactPreserved: string[];
  /** §3 conversation ids whose "Exclude?" box IS ticked — drop from the profile. */
  excludeConversations: string[];
}

/**
 * Apply operator decisions. Pure — safe to call with no DOM.
 *
 * No decisions → the proposal is returned untouched (identity). This is the
 * path taken when the panel never rendered or the student accepted every
 * default, and it avoids a second engine pass for nothing.
 * Otherwise: excluded conversations are dropped from the log FIRST, then
 * redaction re-runs with the kept originals in `preserveLiterals` and the
 * overridden keeps in `redactLiterals`, so the final tallies, entity numbering,
 * and flags all describe exactly the conversations that continue into the profile.
 */
export function applyDecisions(
  log: ConversationLog,
  redaction: RedactionResult,
  decisions: RedactionDecisions,
): RedactionResult {
  if (
    decisions.preserveOriginals.length === 0 &&
    decisions.redactPreserved.length === 0 &&
    decisions.excludeConversations.length === 0
  ) {
    return redaction;
  }
  const excluded = new Set(decisions.excludeConversations);
  const kept: ConversationLog = {
    source: log.source,
    conversations: log.conversations.filter((c) => !excluded.has(c.id)),
  };
  return redactConversationsWithOptions(kept, {
    preserveLiterals: decisions.preserveOriginals,
    redactLiterals: decisions.redactPreserved,
  });
}

/**
 * Honest limitations — on-screen section 4, Markdown report section 5. Each has a
 * SHORT headline and the full DETAIL, which the downloadable report always prints in
 * full. Required even when everything looks caught; it replaces any "verified safe"
 * claim (SPEC.md §8 item 4, the mandatory section).
 *
 * On screen the `scope` item is the always-visible bottom line; every other check sits
 * behind one disclosure, grouped by what it means for the reader (see LIMITATION_GROUPS)
 * as headline cards that each expand to the full detail.
 */
export type LimitationGroup = "miss" | "kept" | "how" | "scope";

export interface Limitation {
  group: LimitationGroup;
  short: string;
  detail: string;
}

/** Display order, title, and one-line framing for each on-screen group (`scope` is not a group). */
export const LIMITATION_GROUPS: readonly { key: Exclude<LimitationGroup, "scope">; title: string; blurb: string }[] = [
  { key: "miss", title: "Can slip through", blurb: "Local rules can miss these — skim the text yourself if it matters." },
  { key: "kept", title: "Kept on purpose", blurb: "Left visible by design: it describes the work, not a person." },
  { key: "how", title: "How hiding works", blurb: "What a placeholder tells you, and how names get tied together." },
];

/**
 * The fixed checklist of what the engine checks but cannot guarantee. Entries are
 * written against the behaviour of src/client/redaction/ and must be updated when a
 * rule there changes. Groups are intentionally interleaved in this array (it reads
 * as one prose list in the Markdown report, section 5); on screen renderLimitations
 * regroups by `group`, so the order here only matters WITHIN a group. The single
 * `scope` entry is the always-visible bottom line, not a group.
 */
export const LIMITATIONS: readonly Limitation[] = [
  {
    group: "miss",
    short: "Uncued names can slip through",
    detail:
      "Names are found by local heuristics (strong cues like self-introductions, honorifics, signatures, rosters). An unusual name in plain prose with no cue produces no candidate and could remain.",
  },
  {
    group: "miss",
    short: "“Please review” items are still verbatim",
    detail:
      "Items listed under a \"please review\" category were counted but NOT redacted — they remain verbatim in the text until you decide.",
  },
  {
    group: "miss",
    short: "Conversation ids and timestamps are never rewritten",
    detail:
      "Conversation ids and timestamps are never rewritten (contract). An identifier hiding inside a conversation id remains.",
  },
  {
    group: "miss",
    short: "Novel secret shapes may be missed",
    detail:
      "Mechanical identifiers (emails, tokens, IPs, credential URLs) are covered by deterministic rules; a novel secret shape outside those rules would be missed.",
  },
  {
    group: "kept",
    short: "Only credential-bearing URLs are hidden",
    detail:
      "Only credential-bearing URLs (user:pass@ connection strings; links carrying a token, key, code, password, or signature in the query) are redacted. All other URLs — public websites, GitHub/Hugging Face pages, Google Docs share links, org invites, internal hostnames, deployed apps — and role-based company mailboxes (support@, info@) are deliberately KEPT. A GitHub/Hugging Face handle inside a kept URL is masked only when it is already known to be yours (it matched your home directory or a name); an unknown handle, and what a link was about, stay visible.",
  },
  {
    group: "kept",
    short: "Course codes and institutions are kept",
    detail:
      "Course codes (COS 498, STA-301) and institution names (University of Maine, University of Southern Maine) are deliberately KEPT: the study site is already public and they tell a reader which course and cohort a conversation belongs to. Institutions are counted under \"please review\" so you can see them; course codes are not counted at all.",
  },
  {
    group: "kept",
    short: "File paths keep their structure",
    detail:
      "File paths keep their directory structure — it documents what was being worked on. Only the identifying segment is masked: /Users/jrivera/dev/app becomes /Users/[NAME_N]/dev/app. A path segment that is someone's handle but never appears as a name elsewhere stays visible.",
  },
  {
    group: "kept",
    short: "Product and project names are never people",
    detail:
      "Project and product vocabulary (Claude Code, Railway, FastAPI, Postgres, repo names like reflect-agent) is never treated as a person's name, so a conversation still reads as software work.",
  },
  {
    group: "kept",
    short: "Documentation placeholders are kept and listed",
    detail:
      "Documentation placeholders that look like secrets (sk-ant-api03-EXAMPLE-KEY-DO-NOT-USE, sk_test_EXAMPLE_REPLACE_ME, AIzaSy-YOUR-API-KEY-HERE, <your-slack-token>, token: REPLACE_ME) are deliberately KEPT and listed under \"Preserved\" — they show a conversation was about setting up a key, and hide nothing live. A real key that happened to contain such a marker word would also be kept.",
  },
  {
    group: "kept",
    short: "Git commit SHAs are kept",
    detail:
      "Git commit SHAs (40-character hex, and short forms) are deliberately KEPT — they identify code, not people — even though AWS secret keys are also 40 characters. A 40-hex value that follows a token/secret cue (GITHUB_TOKEN=…) is still redacted, because legacy GitHub tokens had exactly that shape.",
  },
  {
    group: "how",
    short: "Placeholders keep the type of what they replace",
    detail:
      "Placeholders keep the TYPE of what they replace: [POSTGRESQL_URL] rather than [URL], [GITHUB_TOKEN] or [ANTHROPIC_API_KEY] rather than [SECRET], password: [PASSWORD], [IPV4], [STUDENT_ID]. The value is gone; what kind of thing it was stays, so the conversation is still interpretable.",
  },
  {
    group: "kept",
    short: "Version-like numbers kept for review; bare networks hidden",
    detail:
      "A public dotted quad that reads as a software version (v1.27.2.3, python 3.12.7.1, or one that sits next to a near-identical value like 1.27.2.2) is KEPT and listed under \"please review\" rather than hidden; a :port after it always makes it an address. A bare network-looking address without a slash (122.0.0.0) is deliberately NOT kept — only CIDR notation (122.0.0.0/8) marks a network.",
  },
  {
    group: "how",
    short: "Participant IDs hidden (format provisional)",
    detail:
      "Study participant IDs are hidden as numbered [PARTICIPANT_N] only when the line mentions a participant and the value is not inside code; the surrounding path or sentence is kept. The ID format is provisional (p_ + three digits, from the synthetic corpus) until confirmed against the IRB protocol.",
  },
  {
    group: "how",
    short: "Lone surnames bind to the first person established",
    detail:
      "A lone surname or first name (\"Dr. Okonkwo\", \"Priya's\") is bound to the FIRST person established with that name in the log — if \"Priya Okonkwo\" appeared earlier, both point to her. If two people share the name, later bare mentions attach to the earlier person.",
  },
  {
    group: "how",
    short: "Long random tokens are hidden even without a cue",
    detail:
      "Long tokens that mix upper case, lower case, and digits (32+ characters) are hidden as [SECRET_N] even with no cue word, because vendor prefixes cannot be relied on to catch every key. Hex hashes, UUIDs, git SHAs, and public-key/certificate bodies are exempt; an unusual identifier with that shape could be hidden needlessly.",
  },
  {
    group: "kept",
    short: "Private, loopback, and documentation IPs are kept",
    detail:
      "Only public, routable IP addresses are hidden. Loopback (127.x, ::1), private ranges (10.x, 172.16–31.x, 192.168.x), 0.0.0.0, link-local, documentation ranges (192.0.2.x, 198.51.100.x, 203.0.113.x, 2001:db8::), and any address written as a network (10.0.0.0/8) are deliberately KEPT and not counted — they document what was being worked on and identify nobody.",
  },
  {
    group: "scope",
    short: "A checklist, not a safety guarantee",
    detail:
      "This panel lists what was checked — it is not a declaration that the log is safe to share. That decision is yours.",
  },
];

// ---------------------------------------------------------------------------
// Derived counts (on-screen section 5 / Markdown report section 6)
// ---------------------------------------------------------------------------

// Tallies shown in the Counts table, the Markdown report, and findings_report.json.
// Derived from the result rather than carried on it so all three outputs agree.
export interface FindingsCounts {
  distinctOriginals: number;
  totalOccurrences: number;
  personsNumbered: number;
  entitiesNumbered: number;
  flaggedConversations: number;
  keptPlaceholders: number;
}

// personMap keys are the placeholder labels ("person 1", "org 2", ...); the
// "person " prefix is the engine's convention for human entities, so anything
// else counts as a non-person entity. Counts include always-redacted kinds even
// though the on-screen table hides them (see ALWAYS_REDACT_KINDS).
export function countFindings(r: RedactionResult): FindingsCounts {
  const applied = r.appliedOriginals ?? [];
  const mapKeys = Object.keys(r.personMap ?? {});
  return {
    distinctOriginals: applied.length,
    totalOccurrences: applied.reduce((s, a) => s + a.count, 0),
    personsNumbered: mapKeys.filter((k) => k.startsWith("person ")).length,
    entitiesNumbered: mapKeys.filter((k) => !k.startsWith("person ")).length,
    flaggedConversations: (r.reviewFlags ?? []).length,
    keptPlaceholders: (r.keptPlaceholders ?? []).length,
  };
}

// Kinds that are certain and always redacted — hidden from the on-screen review
// table (nothing to ask) but still fully enumerated in the downloadable report.
export const ALWAYS_REDACT_KINDS: ReadonlySet<string> = new Set(["secret", "email", "phone", "url-token"]);

/**
 * findings_report.json — same top-level keys (`placeholders`, `flagged`, ...) that
 * the redaction prototype's agent run emits, so the prototype's scorer
 * (agents/ai-redaction-agent-prototype/.claude/skills/redacting-usage-logs/score_against_expected.py,
 * `--report`) can read a browser-produced report unchanged.
 */
export function buildFindingsJson(r: RedactionResult): Record<string, unknown> {
  return {
    generated_by: "WeFlect client (findings report — stays on this device)",
    placeholders: (r.keptPlaceholders ?? []).map((p) => p.text),
    flagged: (r.reviewFlags ?? []).map((f) => ({
      conversation_id: f.conversationId,
      kind: f.subkind,
      reason: f.reason,
      question: f.question,
    })),
    categories: r.categories,
    person_map: r.personMap ?? {},
    counts: countFindings(r),
  };
}

/**
 * verify_rules.json — literal manifest for the prototype's Python honesty check
 * (agents/ai-redaction-agent-prototype/.claude/skills/redacting-usage-logs/verify_redactions.py),
 * which re-scans the redacted output and fails if any `literal` rule text still
 * occurs. `deletions` is always empty because the browser never deletes turns;
 * exclusion drops whole conversations before redaction runs (applyDecisions).
 */
export function buildVerifyRules(r: RedactionResult): Record<string, unknown> {
  return {
    rules: (r.appliedOriginals ?? []).map((a) => ({
      kind: "literal",
      text: a.original,
      ci: true,
      replacement: a.replacement,
      label: a.kind,
    })),
    deletions: [],
  };
}

/** Redacted log as Turn-JSONL (title carried on each conversation's first line). */
export function emitTurnJsonl(conversations: readonly Conversation[]): string {
  const lines: string[] = [];
  for (const conv of conversations) {
    conv.turns.forEach((t, i) => {
      const row: Record<string, unknown> = {
        conversation_id: conv.id,
        turn_index: i,
        role: t.role,
        content: t.text,
      };
      if (i === 0) row.title = conv.title;
      lines.push(JSON.stringify(row));
    });
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}

// ---------------------------------------------------------------------------
// Markdown report — six sections: report_template.md's five, plus a separate
// "2. Person & entity map" (SPEC.md §8 folds the map into section 1's table;
// here it gets its own section so aliases are auditable at a glance).
// ---------------------------------------------------------------------------

// Wrap a value in inline code so Markdown does not interpret it. Backticks are
// swapped for quotes (a backtick would end the span) and pipes escaped (they
// would split the table row). Lossy on purpose: the exact bytes are in the JSON.
const mdCell = (s: string): string => "`" + s.replace(/`/g, "'").replace(/\|/g, "\\|") + "`";

/**
 * Build the downloadable findings_report.md. Every section always appears, with
 * an explicit "(none)" line when empty, so a reader can tell "checked, nothing
 * found" from "not checked". Section 5 prints every LIMITATIONS detail in full.
 */
export function buildFindingsMarkdown(r: RedactionResult): string {
  const applied = r.appliedOriginals ?? [];
  const personMap = r.personMap ?? {};
  const flags = r.reviewFlags ?? [];
  const kept = r.keptPlaceholders ?? [];
  const counts = countFindings(r);
  const out: string[] = [];

  out.push("# Findings report — WeFlect import");
  out.push("");
  out.push(
    "> Generated client-side; this file contains ORIGINAL identifiers and stays on your device.",
    "> It documents what was redacted and what needs your review — it is not a \"safe\" declaration.",
  );

  out.push("", "## 1. Proposed identifier redactions", "");
  if (applied.length === 0) {
    out.push("(none)");
  } else {
    out.push("| Category | Original | Replacement | Occurrences |", "|---|---|---|---|");
    for (const a of applied) {
      out.push(`| ${a.kind} | ${mdCell(a.original)} | ${mdCell(a.replacement)} | ${a.count} |`);
    }
  }
  out.push("", "## 2. Person & entity map", "");
  out.push("Original names appear ONLY in this report, never in the redacted log.", "");
  const mapEntries = Object.entries(personMap);
  if (mapEntries.length === 0) {
    out.push("(none numbered)");
  } else {
    out.push("| Label | Identity (aliases) |", "|---|---|");
    for (const [label, aliases] of mapEntries) out.push(`| ${label} | ${mdCell(aliases)} |`);
  }

  out.push("", "## 3. Preserved / deliberately not redacted", "");
  if (kept.length === 0) {
    out.push("(none noted)");
  } else {
    out.push("| Content | Conversation | Why preserved |", "|---|---|---|");
    for (const k of kept) out.push(`| ${mdCell(k.text)} | ${k.conversationId} | ${k.note} |`);
  }

  out.push("", "## 4. Flagged possibly-personal conversations", "");
  out.push(
    "Flagged, never auto-edited — text was NOT modified. On the review screen these are excluded from your profile unless you untick Exclude; keep / cut / edit is your decision.",
    "",
  );
  if (flags.length === 0) {
    out.push("(none flagged)");
  } else {
    out.push("| Conversation | Kind | Reason | Question |", "|---|---|---|---|");
    for (const f of flags) {
      out.push(`| ${f.conversationId} | ${f.subkind} | ${f.reason} | ${f.question} |`);
    }
  }

  out.push("", "## 5. Checked but could not fully verify", "");
  for (const l of LIMITATIONS) out.push(`- **${l.short}** — ${l.detail}`);

  out.push("", "## 6. Counts", "");
  out.push(`- Distinct identifiers redacted: ${counts.distinctOriginals} (${counts.totalOccurrences} occurrences)`);
  out.push(`- Persons numbered: ${counts.personsNumbered}; other entities numbered: ${counts.entitiesNumbered}`);
  out.push(`- Conversations flagged for review: ${counts.flaggedConversations}`);
  out.push(`- Placeholder secrets kept + noted: ${counts.keptPlaceholders}`);
  out.push("");
  return out.join("\n");
}

// Longest conversation label shown in the flagged table before an ellipsis.
// Longer than the parser's 60-char derived titles (makeConversation in
// src/client/parser/util.ts) because the fallback here is a recovered prose line.
const MAX_CONV_LABEL = 80;

/**
 * Display label for a (REDACTED) conversation: its title, or — when the title is only
 * IDE-injected context like `<ide_opened_file>…` — the first user turn that says
 * something once that context is stripped. Purely a view over the log; turns are
 * never modified.
 */
export function conversationLabel(conv: Conversation): string {
  const squash = (s: string): string => stripInjectedContext(s).replace(/\s+/g, " ").trim();
  let label = squash(conv.title);
  if (!label || /^<ide_/.test(conv.title.trim()) || /^[{[]/.test(label)) {
    // A wrapper-derived title was truncated at 60 chars (so the real prompt is gone
    // from it), or the title is JSON/code — recover a prose line from the turns instead.
    for (const t of conv.turns) {
      if (t.role !== "user") continue;
      const prose = firstProseLine(stripInjectedContext(t.text));
      if (prose) {
        label = prose.replace(/\s+/g, " ").trim();
        break;
      }
    }
  }
  // Never show raw JSON/code as a conversation name; the id stays in the tooltip.
  if (!label || /^[{[]/.test(label)) return "Untitled conversation";
  return label.length > MAX_CONV_LABEL ? label.slice(0, MAX_CONV_LABEL - 1).trimEnd() + "…" : label;
}
