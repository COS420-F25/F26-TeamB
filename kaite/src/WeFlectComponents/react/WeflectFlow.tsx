// KAIte/react/WeflectFlow.tsx
//
// The whole flow as one component: import -> redaction review -> profile
// dashboard -> framing preferences -> reflection chat.
//
// All log parsing, redaction and summarization run in the browser; only the
// derived ReflectionSummary is handed to server.createSession. Raw
// conversation text never leaves the page.
//
// Every screen stays mounted and only the active one is visible, so going Back
// keeps the file list, the review ticks and the framing choices.

import { useState } from "react";
import type { FramingPreferences } from "../logic/framing";
import type { ConversationLog, RedactionResult, ReflectionSummary } from "../logic/types";
import { applyDecisions, RedactionDecisions } from "../logic/findings";
import { redactConversations } from "../logic/redaction";
import { summarize } from "../logic/summary";
import type { ReflectionServer } from "../server/types";
import { defaultDecisions } from "./lib/decisions";
import { FramingScreen } from "./screens/FramingScreen";
import { ImportScreen } from "./screens/ImportScreen";
import { ProfileDashboard } from "./screens/ProfileDashboard";
import { RedactionReview } from "./screens/RedactionReview";
import { ReflectionChat } from "./screens/ReflectionChat";

export type FlowScreen = "import" | "redact" | "profile" | "framing" | "chat";

export interface WeflectFlowProps {
  /**
   * The two server calls the chat needs. Use createWeflectServer() for a
   * weflect backend or supply your own; see KAIte/server/types.ts.
   */
  server: ReflectionServer;
  /**
   * Whether the server may log the conversation. Ask the student for consent
   * in your own UI and pass the answer in. Defaults to true.
   */
  logConversation?: boolean;
  /** Link to a "how do I export my AI logs" page, shown on the import screen when set. */
  exportGuideHref?: string;
  /** Called when the session cannot be created. Defaults to an alert. */
  onStartError?: (error: unknown) => void;
}

const alertStartError = (): void => {
  // One generic message for every failure; the real error is in the console.
  alert("Could not start the reflection. Is the server running and the API key set?");
};

const NO_DECISIONS: RedactionDecisions = { preserveOriginals: [], redactPreserved: [], excludeConversations: [] };

export function WeflectFlow({
  server,
  logConversation = true,
  exportGuideHref,
  onStartError = alertStartError,
}: WeflectFlowProps) {
  const [screen, setScreen] = useState<FlowScreen>("import");
  // The three artifacts of the pipeline, each produced by the screen before it.
  // `redaction` stays the undecided proposal so going Back keeps the ticks editable.
  const [log, setLog] = useState<ConversationLog | null>(null);
  const [redaction, setRedaction] = useState<RedactionResult | null>(null);
  const [summary, setSummary] = useState<ReflectionSummary | null>(null);
  const [decisions, setDecisions] = useState<RedactionDecisions>(NO_DECISIONS);
  // Bumped on every new proposal so the review screen starts fresh (sort
  // order, open panels).
  const [reviewRun, setReviewRun] = useState(0);
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const go = (next: FlowScreen) => {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  // Redaction runs here, not at import time, so re-adding files never leaves a
  // stale proposal behind.
  const toReview = (imported: ConversationLog) => {
    const proposal = redactConversations(imported);
    setLog(imported);
    setRedaction(proposal);
    setDecisions(defaultDecisions(proposal));
    setReviewRun((n) => n + 1);
    go("redact");
  };

  // Build the profile from the DECIDED, REDACTED conversations, never from the
  // raw log: the summary is what gets sent to the server.
  const toProfile = () => {
    if (!log || !redaction) return;
    const decided = applyDecisions(log, redaction, decisions);
    setSummary(summarize({ source: log.source, conversations: decided.conversations }));
    go("profile");
  };

  const startReflection = async (framing: FramingPreferences) => {
    if (!summary) return;
    setStarting(true);
    try {
      setSessionId(await server.createSession({ reflectionSummary: summary, logConversation, framing }));
      go("chat");
    } catch (err) {
      console.error(err);
      setStarting(false);
      onStartError(err);
    }
  };

  return (
    <>
      <ImportScreen active={screen === "import"} onContinue={toReview} exportGuideHref={exportGuideHref} />
      <RedactionReview
        key={reviewRun}
        active={screen === "redact"}
        redaction={redaction}
        decisions={decisions}
        onDecisionsChange={setDecisions}
        onContinue={toProfile}
        onBack={() => go("import")}
      />
      <ProfileDashboard
        active={screen === "profile"}
        summary={summary}
        onContinue={() => go("framing")}
        onBack={() => go("redact")}
      />
      <FramingScreen
        active={screen === "framing"}
        busy={starting}
        onStart={(framing) => void startReflection(framing)}
        onBack={() => go("profile")}
      />
      <ReflectionChat active={screen === "chat"} sessionId={sessionId} sendMessage={server.sendMessage} 
      onRequestSummary={() => {
        // Conversation summary will generate here.
      }}/>
    </>
  );
}
