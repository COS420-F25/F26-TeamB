// KAIte/logic/parser/claude-code.ts (copy of src/client/parser/claude-code.ts)
//
// Adapter for Claude Code JSONL session logs (`~/.claude/projects/<project>/
// <session>.jsonl`; samples live under the repo's `example data/` folder, one
// subfolder per person). One file is one session = one conversation.
// Each line is a JSON record; we keep `type: "user" | "assistant"` records
// that carry real text and skip plumbing (queue-operation, tool results,
// sidechain/subagent records). Tool results are not filtered by name: a user
// record whose content is only tool_result blocks yields "" from extractText
// and is dropped by the empty-body check, which is what keeps them out.

import { Conversation, Turn } from "../types";
import { extractText, makeConversation } from "./util";

/**
 * Parse one Claude Code session file. `sourceName` (the display path from
 * main.ts) becomes the conversation id only when no record carries a
 * sessionId. Malformed lines are skipped silently so a truncated final line
 * (common when a session is still open) does not lose the whole file. Returns
 * [] rather than an empty conversation when nothing usable was found.
 */
export function parseClaudeCode(text: string, sourceName: string): Conversation[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const turns: Turn[] = [];
  let sessionId: string | undefined;
  let firstTimestamp: string | undefined;

  for (const line of lines) {
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    // Every record repeats the sessionId; the first one seen is taken and the
    // check is done before the sidechain skip so even a file that opens with
    // subagent records still gets its id.
    if (rec.sessionId && typeof rec.sessionId === "string" && !sessionId) {
      sessionId = rec.sessionId;
    }
    if (rec.isSidechain === true) continue; // subagent / tool side-chain

    const type = rec.type;
    if (type !== "user" && type !== "assistant") continue;

    const message = rec.message as Record<string, unknown> | undefined;
    if (!message) continue;

    const role = type === "user" ? "user" : "assistant";
    const body = extractText(message.content);
    if (!body.trim()) continue; // e.g. user turns that are pure tool_result blocks

    const ts = typeof rec.timestamp === "string" ? rec.timestamp : undefined;
    if (ts && !firstTimestamp) firstTimestamp = ts;
    turns.push({ role, text: body, timestamp: ts });
  }

  if (turns.length === 0) return [];

  // No title in the format: makeConversation derives one from the first prose
  // line of the first user turn. The file name (minus extension) is the id
  // fallback because Claude Code names the file after the session uuid anyway.
  const id = sessionId ?? sourceName.replace(/\.jsonl$/i, "");
  return [makeConversation(id, undefined, turns, firstTimestamp)];
}
