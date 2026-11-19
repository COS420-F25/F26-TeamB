// KAIte/server/types.ts
//
// The two server calls the reflection chat needs. The React components never
// call fetch themselves: the host project passes an object of this shape in.
// Use createWeflectServer (./weflectServer) for a weflect backend, or write
// your own two functions for any other backend.

import type { CreateSessionRequest, StreamEvent } from "../logic/types";

/**
 * Send one student message and report the reply as it streams.
 *
 * Call `onEvent` for each event, in order: any number of `delta` (reply text)
 * and `evidence` (the "Why am I asking this?" note) events, then one
 * `turn_end`. Report a server-side failure as an `error` event; reject the
 * promise only when the request itself fails. Stop reading when `signal`
 * aborts.
 */
export type SendMessage = (
  sessionId: string,
  text: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
) => Promise<void>;

export interface ReflectionServer {
  /**
   * Start a reflection and return its session id. The request carries only the
   * derived usage summary, the framing preferences and the logging choice;
   * raw conversation text is never part of it.
   */
  createSession(request: CreateSessionRequest): Promise<string>;
  sendMessage: SendMessage;
}
