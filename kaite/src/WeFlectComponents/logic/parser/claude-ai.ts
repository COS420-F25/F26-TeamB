// KAIte/logic/parser/claude-ai.ts (copy of src/client/parser/claude-ai.ts)
//
// Adapter for Claude.ai data exports (`conversations.json`). The file is an
// array of conversation objects, each with a `chat_messages` array whose
// entries have `sender` ("human" | "assistant") and either a `text` field or
// a `content` array of blocks.

import { Conversation, Turn } from "../types";
import { extractText, makeConversation } from "./util";

// Only the fields we read. `text` is the flat transcript string; `content` is
// the newer block array (text / tool_use / attachments). Timestamps are
// already ISO 8601 in this export, so no conversion step is needed.
interface ClaudeAiMessage {
  sender?: string;
  text?: string;
  content?: unknown;
  created_at?: string;
}

// `name` is the conversation title as shown in the claude.ai sidebar.
interface ClaudeAiConversation {
  uuid?: string;
  name?: string;
  created_at?: string;
  chat_messages?: ClaudeAiMessage[];
}

// One export entry -> Conversation, or null when it has no usable turns.
function parseConversation(conv: ClaudeAiConversation, index: number): Conversation | null {
  const messages = conv.chat_messages;
  if (!Array.isArray(messages)) return null;

  const turns: Turn[] = [];
  for (const m of messages) {
    // claude.ai names the user "human"; anything else (unknown future senders)
    // is dropped rather than guessed.
    const role = m.sender === "human" ? "user" : m.sender === "assistant" ? "assistant" : null;
    if (!role) continue;
    // Prefer a non-empty `text` over the `content` blocks: when both exist the
    // flat string is the canonical rendering, and some messages have an empty
    // `text` with the real words only in `content` (e.g. tool-using turns).
    const text = (m.text && m.text.trim()) ? m.text : extractText(m.content);
    if (!text.trim()) continue;
    turns.push({ role, text, timestamp: m.created_at });
  }
  if (turns.length === 0) return null;

  // The export's uuid is stable across re-exports; positional id only if absent.
  const id = conv.uuid ?? `claude-ai-${index}`;
  return makeConversation(id, conv.name, turns, conv.created_at);
}

/**
 * Parse a claude.ai `conversations.json` (array, or a single conversation
 * object) into Conversations. Invalid JSON throws, but detectFormat has
 * already parsed the text once on the normal path.
 */
export function parseClaudeAi(text: string): Conversation[] {
  const data = JSON.parse(text);
  const list: ClaudeAiConversation[] = Array.isArray(data) ? data : [data];
  const out: Conversation[] = [];
  list.forEach((conv, i) => {
    const parsed = parseConversation(conv, i);
    if (parsed) out.push(parsed);
  });
  return out;
}
