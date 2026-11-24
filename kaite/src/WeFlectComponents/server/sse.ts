// KAIte/server/sse.ts
//
// Stream reader used by the weflect server client.

import type { StreamEvent } from "../logic/types";

/**
 * Read a Server-Sent Events response body and dispatch each JSON event.
 *
 * Hand-rolled instead of EventSource because the request is a POST with a JSON
 * body and custom headers. Events are split on the blank line that terminates
 * each SSE event; only the first `data:` line of an event is used, since the
 * server writes exactly one JSON object per event. The decoder runs in
 * streaming mode so a multi-byte character split across two chunks is
 * reassembled. Malformed events are dropped rather than aborting the stream.
 */
export async function readSSE(
  body: ReadableStream<Uint8Array>,
  onEvent: (e: StreamEvent) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        onEvent(JSON.parse(json) as StreamEvent);
      } catch {
        /* ignore malformed event */
      }
    }
  }
}
