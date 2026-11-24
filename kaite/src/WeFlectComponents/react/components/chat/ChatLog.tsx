// KAIte/react/components/chat/ChatLog.tsx
//
// The scrolling list of turns. Keeps the newest text in view as it streams.

import { useEffect, useRef } from "react";
import type { ChatTurnData } from "../../hooks/useReflectionChat";
import { ChatTurn } from "./ChatTurn";

export interface ChatLogProps {
  turns: ChatTurnData[];
}

export function ChatLog({ turns }: ChatLogProps) {
  const log = useRef<HTMLDivElement>(null);

  // Both the log and the window are scrolled: the chat is not a fixed-height
  // panel, so on narrow viewports the page itself grows.
  useEffect(() => {
    if (turns.length === 0 || !log.current) return;
    log.current.scrollTop = log.current.scrollHeight;
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }, [turns]);

  return (
    <div className="reflog" ref={log} aria-live="polite">
      {turns.map((turn) => (
        <ChatTurn key={turn.id} turn={turn} />
      ))}
    </div>
  );
}
