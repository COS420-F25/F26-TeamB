// KAIte/logic/parser/plaintext.ts (copy of src/client/parser/plaintext.ts)
//
// Fallback adapter for copy-pasted plain-text conversations (.txt/.md that is
// neither JSON nor JSONL). We split on common speaker markers ("You:",
// "ChatGPT:", "Claude:", "Assistant:", ...). If no markers are found, the
// whole blob becomes a single user turn so the content is still counted.
// Nothing downstream flags such a conversation as low-confidence: it is
// summarized like any other, and the only caveat the student sees is the
// generic reliance caveat in src/client/summarize.ts.

import { Conversation, Role, Turn } from "../types";
import { makeConversation } from "./util";

// Speaker markers are matched at line start, case-insensitively, with optional
// space before the colon. The single-letter forms (`q:`, `a:`) and short words
// (`me:`, `ai:`) are a known looseness: an ordinary line such as "A: first
// option" or "Me: I think..." inside a long answer also fires and starts a new
// turn. Accepted because pasted transcripts use these forms often enough.
const USER_MARKERS = /^(you|me|user|human|prompt|q)\s*:/i;
const ASSISTANT_MARKERS = /^(chatgpt|claude|gemini|assistant|ai|bot|a)\s*:/i;

/**
 * @param sourceName the file path/name the text came from. It makes the conversation
 * id unique per file — every pasted file used to share `plaintext-0`, so on the review
 * screen they all collapsed onto one label and one checkbox — and it is the display
 * title when the text has no prose line to take one from.
 */
export function parsePlaintext(text: string, sourceName = "pasted-text"): Conversation[] {
  const id = `plaintext:${sourceName}`;
  const fallbackTitle = sourceName.split("/").pop() || sourceName;
  const lines = text.split("\n");
  const turns: Turn[] = [];
  let current: Turn | null = null;

  const push = () => {
    if (current && current.text.trim()) turns.push(current);
    current = null;
  };

  for (const line of lines) {
    const userMatch = line.match(USER_MARKERS);
    const asstMatch = line.match(ASSISTANT_MARKERS);
    if (userMatch || asstMatch) {
      push();
      // User is checked first so a line that matches both regexes (none do
      // today, but a future marker could) is attributed to the student.
      const role: Role = userMatch ? "user" : "assistant";
      const rest = line.slice(line.indexOf(":") + 1).trim();
      current = { role, text: rest };
    } else if (current) {
      current.text += (current.text ? "\n" : "") + line;
    } else if (line.trim()) {
      // Text before any marker — treat as a leading user turn.
      current = { role: "user", text: line };
    }
  }
  push();

  if (turns.length === 0) {
    const blob = text.trim();
    if (!blob) return [];
    return [makeConversation(id, undefined, [{ role: "user", text: blob }], undefined, fallbackTitle)];
  }
  return [makeConversation(id, undefined, turns, undefined, fallbackTitle)];
}
