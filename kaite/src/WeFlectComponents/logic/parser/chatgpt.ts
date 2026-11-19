// KAIte/logic/parser/chatgpt.ts (copy of src/client/parser/chatgpt.ts)
//
// Adapter for ChatGPT data exports (`conversations.json`). The file is an
// array of conversation objects; each has a `mapping` of node-id -> node,
// where a node carries a `message` with `author.role` and `content.parts`.
// The mapping is really a tree (each node has parent/children) that records
// regenerations and edited branches. We do NOT walk the tree: we collect
// every message-bearing node and order by create_time. That is simpler and
// keeps all text the student actually sent, at the cost of a known caveat —
// when a reply was regenerated or a prompt edited, the abandoned branch is
// interleaved with the final one, so turn counts can run slightly high.

import { Conversation, Role, Turn } from "../types";
import { extractText, makeConversation } from "./util";

// Only the fields we read; the real node also carries id/parent/children.
interface ChatGptNode {
  message?: {
    author?: { role?: string };
    content?: unknown;
    create_time?: number | null;
  };
}

// Newer exports carry `conversation_id`, older ones only `id`; both are optional
// here so either vintage parses.
interface ChatGptConversation {
  id?: string;
  conversation_id?: string;
  title?: string;
  create_time?: number | null;
  mapping?: Record<string, ChatGptNode>;
}

// ChatGPT stores times as Unix seconds (float); Turn/Conversation want ISO 8601
// strings so every adapter's timestamps sort lexically. Null/NaN -> undefined.
function isoFromUnix(seconds?: number | null): string | undefined {
  if (typeof seconds !== "number" || !isFinite(seconds)) return undefined;
  return new Date(seconds * 1000).toISOString();
}

// One export entry -> Conversation, or null when it has no usable turns (so it
// is dropped rather than counted as an empty conversation).
function parseConversation(conv: ChatGptConversation, index: number): Conversation | null {
  if (!conv.mapping) return null;

  // Keep only user/assistant: `system` (hidden root prompt) and `tool` nodes
  // are plumbing, not the student's dialogue. `?? 0` sorts nodes with no
  // create_time to the front rather than throwing them out, so their text is
  // kept even though their position is a guess.
  const nodes = Object.values(conv.mapping)
    .map((n) => n.message)
    .filter((m): m is NonNullable<ChatGptNode["message"]> => !!m)
    .filter((m) => {
      const role = m.author?.role;
      return role === "user" || role === "assistant";
    })
    .sort((a, b) => (a.create_time ?? 0) - (b.create_time ?? 0));

  const turns: Turn[] = [];
  for (const m of nodes) {
    const text = extractText(m.content);
    if (!text.trim()) continue;
    turns.push({
      role: m.author?.role as Role,
      text,
      timestamp: isoFromUnix(m.create_time),
    });
  }
  if (turns.length === 0) return null;

  // Prefer the export's own id (stable across re-exports, and what the
  // findings report shows); fall back to the array position only when absent.
  const id = conv.conversation_id ?? conv.id ?? `chatgpt-${index}`;
  return makeConversation(id, conv.title, turns, isoFromUnix(conv.create_time));
}

/**
 * Parse a ChatGPT `conversations.json` (array, or a single conversation object)
 * into Conversations. Throws on invalid JSON; detectFormat has already parsed
 * the text once, so that cannot happen on the normal path.
 */
export function parseChatGpt(text: string): Conversation[] {
  const data = JSON.parse(text);
  const list: ChatGptConversation[] = Array.isArray(data) ? data : [data];
  const out: Conversation[] = [];
  list.forEach((conv, i) => {
    const parsed = parseConversation(conv, i);
    if (parsed) out.push(parsed);
  });
  return out;
}
