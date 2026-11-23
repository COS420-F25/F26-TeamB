// KAIte/react/screens/ReflectionChat.tsx
//
// Full reflection chat page: the log of turns and the composer. There is no
// end button; the student decides when the conversation is over.

import { ChatLog } from "../components/chat/ChatLog";
import { Composer } from "../components/chat/Composer";
import { Screen } from "../components/Screen";
import type { SendMessage } from "../../server/types";
import { useReflectionChat } from "../hooks/useReflectionChat";

export interface ReflectionChatProps {
  /** The server session to talk to. While null the chat is idle. */
  sessionId: string | null;
  /** Sends one student message and streams the reply; see KAIte/server/types.ts. */
  sendMessage: SendMessage;
  active?: boolean;
  /** Tells the parent component when the user wants to end the reflection conversation. */
  onRequestSummary: () => void;
}

export function ReflectionChat({ sessionId, sendMessage, active }: ReflectionChatProps) {
  const chat = useReflectionChat(sessionId, sendMessage);

  return (
    // No .canvas here: .leaf gives a narrower reading column.
    <Screen id="s-chat" active={active} canvas={false}>
      <div className="leaf">
        <ChatLog turns={chat.turns} />
        <Composer disabled={chat.busy} onSend={chat.send} onSkip={chat.skip} />
      </div>
    </Screen>
  );
}
