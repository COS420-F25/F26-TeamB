// KAIte/index.ts
//
// Single entry point for the KAIte folder. See README.md.
//
//   react/    WeflectFlow (the whole flow), full screens, small components, hooks
//   logic/    parser, redaction engine, findings reports, usage summary,
//             framing definitions, markdown renderer, shared types
//   server/   the ReflectionServer contract and a client for a weflect backend
//   styles/   kaite.css (import it once in the host project)
//
// Nothing here mounts itself and nothing imports from outside this folder
// except react and react-dom.

// --- The whole flow ---------------------------------------------------------
export { WeflectFlow } from "./react/WeflectFlow";
export type { FlowScreen, WeflectFlowProps } from "./react/WeflectFlow";

// --- Full screens -----------------------------------------------------------
export { ImportScreen } from "./react/screens/ImportScreen";
export { RedactionReview } from "./react/screens/RedactionReview";
export { ProfileDashboard } from "./react/screens/ProfileDashboard";
export { FramingScreen } from "./react/screens/FramingScreen";
export { ReflectionChat } from "./react/screens/ReflectionChat";

// --- Small components -------------------------------------------------------
export { Screen } from "./react/components/Screen";
export { Dropzone } from "./react/components/import/Dropzone";
export { FileList } from "./react/components/import/FileList";
export { ImportSummary } from "./react/components/import/ImportSummary";
export { CategoryChips } from "./react/components/redaction/CategoryChips";
export { FindingsPanel } from "./react/components/redaction/FindingsPanel";
export { MappingTable } from "./react/components/redaction/MappingTable";
export { KeptTable } from "./react/components/redaction/KeptTable";
export { FlagsTable } from "./react/components/redaction/FlagsTable";
export { DecisionCheckbox } from "./react/components/redaction/DecisionCheckbox";
export { LimitationsBlock } from "./react/components/redaction/LimitationsBlock";
export { CountsTable } from "./react/components/redaction/CountsTable";
export { DownloadButtons } from "./react/components/redaction/DownloadButtons";
export { SimpleTable } from "./react/components/redaction/SimpleTable";
export { DomainBubbles } from "./react/components/profile/DomainBubbles";
export { StatGrid, StatTile } from "./react/components/profile/StatGrid";
export { PurposeBars } from "./react/components/profile/PurposeBars";
export { OwnershipTrack } from "./react/components/profile/OwnershipTrack";
export { StrengthNote } from "./react/components/profile/StrengthNote";
export { LikertRow } from "./react/components/framing/LikertRow";
export { CustomNote } from "./react/components/framing/CustomNote";
export { ChatLog } from "./react/components/chat/ChatLog";
export { ChatTurn } from "./react/components/chat/ChatTurn";
export { Markdown } from "./react/components/chat/Markdown";
export { EvidenceNote } from "./react/components/chat/EvidenceNote";
export { Composer } from "./react/components/chat/Composer";

// --- Hooks and UI helpers ---------------------------------------------------
export { useImportedFiles } from "./react/hooks/useImportedFiles";
export type { FileRow, ImportedFiles } from "./react/hooks/useImportedFiles";
export { useReflectionChat } from "./react/hooks/useReflectionChat";
export type {
  ChatTurnData,
  ReflectionChat as ReflectionChatState,
  WeflectTurn,
  YouTurn,
} from "./react/hooks/useReflectionChat";
export { defaultDecisions } from "./react/lib/decisions";
export type { NamedFile } from "./react/lib/dropFiles";

// --- Server -----------------------------------------------------------------
export type { ReflectionServer, SendMessage } from "./server/types";
export { createWeflectServer } from "./server/weflectServer";
export type { WeflectServerOptions } from "./server/weflectServer";

// --- Logic ------------------------------------------------------------------
export * from "./logic/types";
export { detectFormat, parseFile, parseFiles } from "./logic/parser";
export type { InputFile } from "./logic/parser";
export { redactConversations, redactConversationsWithOptions } from "./logic/redaction";
export type { RedactOptions } from "./logic/redaction";
export {
  applyDecisions,
  buildFindingsJson,
  buildFindingsMarkdown,
  buildVerifyRules,
  conversationLabel,
  countFindings,
  emitTurnJsonl,
  LIMITATION_GROUPS,
  LIMITATIONS,
} from "./logic/findings";
export type { FindingsCounts, Limitation, LimitationGroup, RedactionDecisions } from "./logic/findings";
export { summarize } from "./logic/summary";
export { CUSTOM_MAX_CHARS, FRAMING_DIMENSIONS, normalizeFraming, renderFraming } from "./logic/framing";
export type { FramingDimension, FramingDimensionId, FramingPreferences } from "./logic/framing";
export { renderMarkdown } from "./logic/markdown";
