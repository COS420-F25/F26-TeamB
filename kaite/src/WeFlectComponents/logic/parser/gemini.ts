// KAIte/logic/parser/gemini.ts (copy of src/client/parser/gemini.ts)
//
// Best-effort adapter for Google Gemini exports. Google Takeout delivers
// Gemini activity as a JSON array of records (header "Gemini"), where each
// record's `title` is the prompt (often prefixed "Prompted ") and `time` is
// an ISO timestamp. Model responses are not reliably included, so each record
// is treated as a single user-prompt conversation. This is intentionally
// loose; the format is less standardized than ChatGPT/Claude exports.

import { Conversation } from "../types";
import { makeConversation } from "./util";

interface GeminiRecord {
  header?: string;
  title?: string;
  time?: string;
  // Some exports nest the prompt under "text" instead of "title".
  text?: string;
}

// Takeout prefixes each activity title with a verb ("Prompted …", "Asked …",
// "Searched for …") describing the action; strip it so the student's actual
// words are the turn text and the prefix does not skew keyword classification.
function promptText(rec: GeminiRecord): string {
  const raw = rec.title ?? rec.text ?? "";
  return raw.replace(/^(Prompted|Asked|Searched for)\s+/i, "").trim();
}

/**
 * Parse a Gemini Takeout activity file into one single-turn Conversation per
 * record. Ids are positional (`gemini-<index>`) because the records carry no
 * stable identifier; they will not match up across two different exports,
 * which matters only if findings reports are compared between runs. Records
 * with an empty prompt are skipped.
 */
export function parseGemini(text: string): Conversation[] {
  const data = JSON.parse(text);
  const list: GeminiRecord[] = Array.isArray(data) ? data : [data];
  const out: Conversation[] = [];
  list.forEach((rec, i) => {
    const prompt = promptText(rec);
    if (!prompt) return;
    out.push(
      makeConversation(
        `gemini-${i}`,
        undefined,
        [{ role: "user", text: prompt, timestamp: rec.time }],
        rec.time
      )
    );
  });
  return out;
}
