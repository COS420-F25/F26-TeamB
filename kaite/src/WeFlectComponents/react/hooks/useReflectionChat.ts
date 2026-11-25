// KAIte/react/hooks/useReflectionChat.ts
//
// State for the reflection chat: the list of turns, sending a student turn,
// and applying the streamed reply events. The request itself is made by the
// sendMessage function the host passes in (see KAIte/server/types.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamEvent } from "../../logic/types";
import type { SendMessage } from "../../server/types";
import { KICKOFF_MESSAGE, SKIP_MESSAGE } from "../lib/messages";
// Used to insert and record intentional errors during practice mode
import { injectError } from "../../../errorInjector";
import type { InjectedError } from "../../../errorInjector";

export interface YouTurn {
  id: number;
  role: "you";
  text: string;
}

export interface WeflectTurn {
  id: number;
  role: "weflect";
  /** Raw Markdown accumulated so far. */
  raw: string;
  /** "Why am I asking this?" notes attached to this turn, in arrival order. */
  evidence: string[];
  /** True while the text is held back; the turn shows a placeholder until it ends. */
  deferred: boolean;
  /** The request or stream failed; the body shows a plain retry message instead. */
  failed: boolean;
  /** Stores the inserted error and its location for practice mode. */
  injectedError?: InjectedError;
}

export type ChatTurnData = YouTurn | WeflectTurn;

export interface ReflectionChat {
  turns: ChatTurnData[];
  /** True while a reply is streaming; the composer buttons are disabled. */
  busy: boolean;
  /** Send the student's typed message (shown as a "You" bubble). */
  send: (text: string) => void;
  /** Send the canned skip message (no bubble is shown for it). */
  skip: () => void;
}

/** Apply one stream event to the turn it belongs to. Pure; "phase" is ignored. */
export function applyStreamEvent(turn: WeflectTurn, event: StreamEvent): WeflectTurn {
  switch (event.type) {
    case "delta":
      return { ...turn, raw: turn.raw + event.text };
    case "evidence":
      return { ...turn, evidence: [...turn.evidence, event.text] };
    case "turn_end":
      // For a deferred turn this is the one and only paint.
      return { ...turn, deferred: false };
    case "error":
      // Errors paint at once, even on a deferred turn, so a failure is never
      // hidden behind the placeholder.
      return { ...turn, raw: `${turn.raw}\n[error: ${event.message}]`, deferred: false };
    default:
      return turn;
  }
}

/**
 * Run the chat for a server session. While `sessionId` is null the hook is
 * idle. When it is set, the hidden kickoff turn is sent once; its reply (the
 * opening summary document) is shown all at once instead of streaming in.
 */
// Practice mode is optional so normal reflection chats stay unchanged.
export function useReflectionChat(
  sessionId: string | null,
  sendMessage: SendMessage,
  practiceMode: boolean = false
): ReflectionChat {
  const [turns, setTurns] = useState<ChatTurnData[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  // Held in a ref so a host that passes a new function on every render does
  // not restart the chat (the kickoff effect below depends on `stream`).
  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  const stream = useCallback(
    async (text: string, opts: { deferRender?: boolean; showAsUser?: boolean } = {}) => {
      if (!sessionId) return;
      setBusy(true);

      const added: ChatTurnData[] = [];
      if (opts.showAsUser) added.push({ id: nextId.current++, role: "you", text });
      const replyId = nextId.current++;
      added.push({
        id: replyId,
        role: "weflect",
        raw: "",
        evidence: [],
        deferred: opts.deferRender === true,
        failed: false,
      });
      setTurns((prev) => [...prev, ...added]);

      const updateReply = (fn: (t: WeflectTurn) => WeflectTurn) =>
        setTurns((prev) => prev.map((t) => (t.id === replyId && t.role === "weflect" ? fn(t) : t)));

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await sendRef.current(sessionId, text, (event) => updateReply((t) => applyStreamEvent(t, event)), controller.signal);
        // Insert an intentional error after the AI finishes responding.
        if (practiceMode && !controller.signal.aborted) {
          updateReply((turn) => {
            const result = injectError(turn.raw, {
              enabled: true,
              frequency: 0.5,
              allowedTypes: ['factual'],
            });

            return {
              ...turn,
              raw: result.text,
              injectedError: result.error,
            };
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return; // unmounted mid-stream
        updateReply((t) => ({ ...t, failed: true, deferred: false }));
        console.error(err);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    },
    [sessionId, practiceMode]
  );

  // Kickoff. Scheduled on a timer that the cleanup cancels, so React
  // StrictMode's mount/unmount/mount in development sends it exactly once.
  useEffect(() => {
    if (!sessionId) return;
    const timer = setTimeout(() => void stream(KICKOFF_MESSAGE, { deferRender: true }), 0);
    return () => clearTimeout(timer);
  }, [sessionId, stream]);

  // Stop reading the stream if the chat goes away mid-reply.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback((text: string) => void stream(text, { showAsUser: true }), [stream]);
  const skip = useCallback(() => void stream(SKIP_MESSAGE), [stream]);

  return { turns, busy, send, skip };
}
