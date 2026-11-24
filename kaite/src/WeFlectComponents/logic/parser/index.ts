// KAIte/logic/parser/index.ts (copy of src/client/parser/index.ts)
//
// Format detection + dispatch. Normalizes every supported AI export into a
// single ConversationLog. All of this runs CLIENT-SIDE — raw chat text never
// leaves the browser. Detection is content-first (sniffing JSON shape) with
// the file extension used only where the content is ambiguous, so a renamed
// export still parses; adapters are one-per-vendor in the sibling files.

import { Conversation, ConversationLog, SourceFormat } from "../types";
import { parseChatGpt } from "./chatgpt";
import { parseClaudeAi } from "./claude-ai";
import { parseClaudeCode } from "./claude-code";
import { parseGemini } from "./gemini";
import { parsePlaintext } from "./plaintext";
import { looksLikeJsonl } from "./util";

/**
 * One file already read into memory. `name` is the display path main.ts
 * assigned (relative path for folder drops, bare name for single picks); it
 * drives extension sniffing, Claude Code side-file skipping, and the id/title
 * fallbacks in the claude-code and plaintext adapters.
 */
export interface InputFile {
  name: string;
  text: string;
}

/**
 * Sniff which export format a single file is, from its name and content.
 *
 * Order matters:
 *   1. `.jsonl` extension wins outright — only Claude Code ships JSONL, and
 *      JSON.parse would fail on it anyway.
 *   2. Otherwise parse as one JSON document and probe its shape. Only the FIRST
 *      element of an array is inspected; exports are homogeneous, so one
 *      sample is enough and avoids walking a multi-MB file twice.
 *   3. `mapping` (ChatGPT) is checked before `chat_messages` (claude.ai); the
 *      two never co-occur, so the order is just a cheap-first convention.
 *   4. The Gemini test is deliberately loose (Takeout's shape varies): a
 *      "Gemini" header, a "Prompted ..." title, or any object with a string
 *      `time` plus a `title` or `text` field. It runs last so it cannot
 *      shadow the two well-defined formats.
 *   5. Valid JSON matching nothing is "unknown" (skipped); non-JSON falls to
 *      JSONL sniffing, then plaintext.
 */
export function detectFormat(name: string, text: string): SourceFormat {
  const lower = name.toLowerCase();
  const trimmed = text.trim();

  if (lower.endsWith(".jsonl")) return "claude-code";

  try {
    const data = JSON.parse(trimmed);
    const probe = Array.isArray(data) ? data[0] : data;
    if (probe && typeof probe === "object") {
      const p = probe as Record<string, unknown>;
      if (p.mapping) return "chatgpt";
      if (p.chat_messages) return "claude-ai";
      if (
        p.header === "Gemini" ||
        (typeof p.title === "string" && /prompted/i.test(p.title)) ||
        (typeof p.time === "string" && (p.title !== undefined || p.text !== undefined))
      ) {
        return "gemini";
      }
    }
    // Parsed as JSON but not a conversation export we know. In the official exports
    // that is account metadata sitting next to the conversations — ChatGPT's user.json
    // (email, phone, birth year), user_settings.json, export_manifest.json,
    // group_chats.json; Claude Code's subagent *.meta.json; claude.ai's users.json and
    // projects.json. Reading it as prose would count JSON structure as a "conversation"
    // and feed those field values into the profile pipeline, so it is skipped instead.
    return "unknown";
  } catch {
    // Not a single JSON document. Could still be newline-delimited JSON.
    if (looksLikeJsonl(trimmed)) return "claude-code";
    return "plaintext";
  }
}

// Prose files that ship INSIDE an official Claude Code project folder
// (~/.claude/projects/<project>/): persistent memory notes and spilled tool output.
// The plaintext fallback would count each one as a conversation; they are not.
const RX_CLAUDE_CODE_SIDE_FILE = /(?:^|\/)(?:memory|tool-results)\/[^/]+\.(?:md|txt)$/i;

/**
 * Parse one file's contents into Conversations using the detected adapter.
 * This is the entry point main.ts uses (one call per file, merged there so the
 * file list can show per-file counts). The `default` branch is the plaintext
 * path — "plaintext" is the only SourceFormat not named in a case above.
 */
export function parseFile(file: InputFile): { format: SourceFormat; conversations: Conversation[] } {
  if (RX_CLAUDE_CODE_SIDE_FILE.test(file.name)) return { format: "unknown", conversations: [] };
  const format = detectFormat(file.name, file.text);
  let conversations: Conversation[];
  switch (format) {
    case "chatgpt":
      conversations = parseChatGpt(file.text);
      break;
    case "claude-ai":
      conversations = parseClaudeAi(file.text);
      break;
    case "claude-code":
      conversations = parseClaudeCode(file.text, file.name);
      break;
    case "gemini":
      conversations = parseGemini(file.text);
      break;
    case "unknown":
      conversations = [];
      break;
    default:
      conversations = parsePlaintext(file.text, file.name);
      break;
  }
  return { format, conversations };
}

/**
 * Parse and merge many files into one ConversationLog. Currently used only by
 * the tests; the app calls parseFile per file and merges in main.ts
 * (syncFromAccumulated) with the same source-format rule as here: one format
 * across all files that produced conversations, otherwise "unknown".
 */
export function parseFiles(files: InputFile[]): ConversationLog {
  const conversations: Conversation[] = [];
  const formats = new Set<SourceFormat>();
  for (const file of files) {
    const { format, conversations: convs } = parseFile(file);
    if (convs.length > 0) formats.add(format);
    conversations.push(...convs);
  }
  const source: SourceFormat = formats.size === 1 ? [...formats][0] : "unknown";
  return { source, conversations };
}
