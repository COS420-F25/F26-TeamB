// KAIte/server/weflectServer.ts
//
// Ready-made ReflectionServer for a weflect backend:
//   POST {baseUrl}/api/session   JSON in, { sessionId } out
//   POST {baseUrl}/api/message   JSON in, Server-Sent Events out
// Same requests the vanilla weflect client makes.

import type { CreateSessionRequest, CreateSessionResponse } from "../logic/types";
import { readSSE } from "./sse";
import type { ReflectionServer } from "./types";

export interface WeflectServerOptions {
  /** Origin and path prefix of the backend, without a trailing slash. Default "" (same origin). */
  baseUrl?: string;
  /** Extra headers for every request, read at call time (for example an access code). */
  headers?: () => Record<string, string>;
  /**
   * Called once when session creation gets a 401. Return true (after obtaining
   * new credentials that `headers` will pick up) to retry a single time.
   */
  onUnauthorized?: () => boolean | Promise<boolean>;
  /** Replacement for the global fetch, mainly for tests. */
  fetch?: typeof fetch;
}

export function createWeflectServer(options: WeflectServerOptions = {}): ReflectionServer {
  const baseUrl = options.baseUrl ?? "";
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const post = (path: string, body: unknown, signal?: AbortSignal) =>
    doFetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(options.headers?.() ?? {}) },
      body: JSON.stringify(body),
      signal,
    });

  return {
    async createSession(request: CreateSessionRequest): Promise<string> {
      let res = await post("/api/session", request);
      // Ask once and retry a single time; a second 401 falls through to the error.
      if (res.status === 401 && options.onUnauthorized && (await options.onUnauthorized())) {
        res = await post("/api/session", request);
      }
      const data = (await res.json()) as CreateSessionResponse & { error?: string };
      if (!res.ok || !data.sessionId) throw new Error(data.error || "Failed to start session");
      return data.sessionId;
    },

    async sendMessage(sessionId, text, onEvent, signal): Promise<void> {
      const res = await post("/api/message", { sessionId, text }, signal);
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
      await readSSE(res.body, onEvent);
    },
  };
}
