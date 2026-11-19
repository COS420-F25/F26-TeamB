// KAIte/logic/parser/util.ts (copy of src/client/parser/util.ts)
//
// Shared helpers for parser adapters: deriving conversation metadata and
// extracting plain text from heterogeneous "content" shapes.

import { Conversation, ConversationMetadata, Turn } from "../types";

/** Pull plain text out of a value that may be a string or an array of blocks. */
export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object") {
          const b = block as Record<string, unknown>;
          // Anthropic/OpenAI text blocks
          if (typeof b.text === "string") return b.text;
          // OpenAI parts that are plain objects sometimes nest under "content"
          if (typeof b.content === "string") return b.content;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>;
    if (typeof c.text === "string") return c.text;
    if (Array.isArray(c.parts)) return extractText(c.parts);
  }
  return "";
}

// Context the Claude Code IDE extension / harness injects into user turns. It stays in
// the log (it may matter to the reflection later); this is for DISPLAY labels only.
const RX_INJECTED_BLOCK = /<(ide_opened_file|system-reminder)>[\s\S]*?<\/\1>/g;
// A selection carries text the user highlighted (kept); the sentence around it does not.
const RX_SELECTION_BLOCK = /<ide_selection>[\s\S]*?<\/ide_selection>/g;
const RX_SELECTION_PREAMBLE = /^\s*The user selected [^\n]*:\n/;
const RX_SELECTION_TRAILER = /\n*\s*This may or may not be related to the current task\.?\s*$/;

/** Strip IDE-injected wrappers from a turn's text for display; may return "". */
export function stripInjectedContext(text: string): string {
  return text
    .replace(RX_SELECTION_BLOCK, (block) =>
      block
        .slice("<ide_selection>".length, -"</ide_selection>".length)
        .replace(RX_SELECTION_PREAMBLE, "")
        .replace(RX_SELECTION_TRAILER, ""),
    )
    .replace(RX_INJECTED_BLOCK, "")
    .trim();
}

/** Compute the per-conversation metadata the summarizer relies on. */
export function computeMetadata(turns: Turn[]): ConversationMetadata {
  const userTurns = turns.filter((t) => t.role === "user");
  const userPromptCount = userTurns.length;
  const totalUserLen = userTurns.reduce((sum, t) => sum + t.text.length, 0);
  return {
    userPromptCount,
    turnCount: turns.length,
    multiTurn: userPromptCount > 1,
    avgUserPromptLength: userPromptCount > 0 ? totalUserLen / userPromptCount : 0,
  };
}

/**
 * First line of `text` that reads as prose — skipping fenced code blocks, JSON/array
 * punctuation lines (`{`, `}`, `[`, `"key": …`), comment/shebang lines, and lines dense
 * with code punctuation. A pasted JSON document or a code-first prompt must never become
 * a conversation's title. `<…>` wrapper lines are NOT skipped here: the display layer
 * (conversationLabel) handles IDE-injected wrappers and the parser title stays verbatim.
 * Returns null when nothing prose-like exists.
 */
export function firstProseLine(text: string): string | null {
  let inFence = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence || line.length < 3) continue;
    if (/^[{}[\],]/.test(line)) continue; // JSON / array structure
    if (/^"[^"]*"\s*:/.test(line)) continue; // "key": value
    if (/^(?:\/\/|#!|\/\*|\*\/)/.test(line)) continue; // comments, shebang
    // Code-dense: braces/semicolons/assignment. Angle brackets and backslashes are NOT
    // counted — `<ide_…>` wrappers and Windows paths occur in ordinary prompts. The
    // cut-off of 4 lets prose with a parenthetical and an "=" through while catching a
    // typical code line; it is a hand-picked constant.
    if ((line.match(/[(){};=$|]/g) ?? []).length >= 4) continue;
    return line;
  }
  return null;
}

/**
 * Build a Conversation, deriving a title from the first user turn if absent.
 * `fallbackTitle` (e.g. the source file name) is used before the generic
 * "Untitled conversation" when no prose line exists to take a title from.
 */
export function makeConversation(
  id: string,
  title: string | undefined,
  turns: Turn[],
  timestamp?: string,
  fallbackTitle?: string,
): Conversation {
  const cleanTurns = turns.filter((t) => t.text.trim().length > 0);
  const firstUser = cleanTurns.find((t) => t.role === "user");
  // Derived titles are cut at 60 chars so a pasted paragraph does not become the
  // title. findings.ts conversationLabel relies on this exact limit when it decides
  // a wrapper-derived title has lost the real prompt and re-derives a label.
  const derivedTitle =
    (title && title.trim()) ||
    (firstUser ? firstProseLine(firstUser.text)?.slice(0, 60).trim() : undefined) ||
    (fallbackTitle && fallbackTitle.trim()) ||
    "Untitled conversation";
  return {
    id,
    timestamp,
    title: derivedTitle,
    turns: cleanTurns,
    metadata: computeMetadata(cleanTurns),
  };
}

/**
 * JSONL sniff for files without a `.jsonl` extension. Returns true when every
 * non-empty line is valid JSON and at least one of them is an object. Strictly
 * that is looser than "every line is an object": a line holding a bare array or
 * primitive is tolerated as long as one object line exists. Any unparseable
 * line rejects the whole file (it is then treated as plaintext).
 */
export function looksLikeJsonl(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  let objectLines = 0;
  for (const line of lines) {
    try {
      const v = JSON.parse(line);
      if (v && typeof v === "object" && !Array.isArray(v)) objectLines++;
    } catch {
      return false;
    }
  }
  return objectLines > 0;
}
