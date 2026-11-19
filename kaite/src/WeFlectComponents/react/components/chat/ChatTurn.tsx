// KAIte/react/components/chat/ChatTurn.tsx
//
// One bubble in the reflection log: the student's message, or a WeFlect reply
// with its evidence notes.

import type { ChatTurnData } from "../../hooks/useReflectionChat";
import { EvidenceNote } from "./EvidenceNote";
import { Markdown } from "./Markdown";

export interface ChatTurnProps {
  turn: ChatTurnData;
}

export function ChatTurn({ turn }: ChatTurnProps) {
  if (turn.role === "you") {
    return (
      <div className="turn you">
        <div className="who">You</div>
        <p>{turn.text}</p>
      </div>
    );
  }

  let body;
  if (turn.failed) {
    body = <div className="md">Something interrupted the connection. Please try again.</div>;
  } else if (turn.deferred) {
    // Nothing paints until the turn ends, so give the reader something to
    // look at while the long opening summary generates.
    body = (
      <div className="md">
        <p className="typing">Preparing your reflection summary…</p>
      </div>
    );
  } else {
    body = <Markdown source={turn.raw} />;
  }

  return (
    <div className="turn weflect">
      <div className="who">WeFlect</div>
      {body}
      {turn.evidence.map((text, i) => (
        <EvidenceNote key={i} text={text} />
      ))}
    </div>
  );
}
