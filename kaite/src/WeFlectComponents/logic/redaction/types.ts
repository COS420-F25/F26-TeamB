/**
 * App-facing type contract for the redaction module. The engine files import their
 * result / flag types from here instead of reaching into src/types.ts themselves, so
 * this file is the one seam between the module and the app: the app owns the shapes
 * (src/types.ts), the module consumes them, and a change on either side surfaces as a
 * type error at this re-export rather than somewhere deep in the engine.
 *
 * History: the engine was ported from the Python prototype in
 * agents/ai-redaction-agent-prototype/ and then adapted for the review screen (e.g.
 * `RedactOptions.redactLiterals` in session.ts, `forcedKeepPlaceholder` in rules.ts);
 * this folder is the module's only home in the repo. Relative import specifiers carry
 * no ".ts" extension because the app's tsc setup does not enable
 * allowImportingTsExtensions.
 */

export type {
  ConversationLog,
  Conversation,
  Turn,
  SourceFormat,
  RedactionResult,
  RedactionCategory,
  RedactionKind,
  ReviewFlag,
  KeptPlaceholder,
  AppliedOriginal,
} from "../types";
