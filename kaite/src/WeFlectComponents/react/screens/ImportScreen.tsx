// KAIte/react/screens/ImportScreen.tsx
//
// Full "Import your AI chats" page. Arranges the import components and owns
// the list of added files. Files are read on the device; nothing uploads.

import type { ConversationLog } from "../../logic/types";
import { Dropzone } from "../components/import/Dropzone";
import { FileList } from "../components/import/FileList";
import { ImportSummary } from "../components/import/ImportSummary";
import { Screen } from "../components/Screen";
import { useImportedFiles } from "../hooks/useImportedFiles";

export interface ImportScreenProps {
  /** Called with the merged log when the student continues to review. */
  onContinue: (log: ConversationLog) => void;
  /** Optional: the Back button is shown only when there is somewhere to go. */
  onBack?: () => void;
  /** Link to a "how do I export my AI logs" page. The help row is shown only when set. */
  exportGuideHref?: string;
  active?: boolean;
}

export function ImportScreen({ onContinue, onBack, exportGuideHref, active }: ImportScreenProps) {
  const files = useImportedFiles();

  return (
    <Screen id="s-import" active={active}>
      <p className="eyebrow">Setup · step 2 of 3</p>
      <h1>Import your AI chats</h1>
      <p className="standfirst">
        Add export files — or a whole folder of them — from ChatGPT, Claude, Claude Code, or Gemini (JSON, JSONL, or
        pasted text). WeFlect is built to look across many conversations over an extended period, so importing a folder
        of logs gives the richest picture. Files are read on your device; nothing uploads to a server.
      </p>

      {exportGuideHref && (
        <div className="help-row">
          {/* rel="opener" lets a same-origin guide page return to this tab. */}
          <a className="btn ghost help-link" href={exportGuideHref} target="_blank" rel="opener">
            How do I get my AI logs?
          </a>
          <span className="help-note">
            Step-by-step for ChatGPT, Claude, Claude Code and Gemini. Opens in a new tab.
          </span>
        </div>
      )}

      <Dropzone onFiles={(picked) => void files.addFiles(picked)} />

      <FileList rows={files.rows} />
      {files.hasFiles && (
        <button type="button" className="btn ghost" onClick={files.clear}>
          Clear all
        </button>
      )}
      <ImportSummary text={files.summary} />

      <div className="actions">
        {onBack && (
          <button className="btn ghost" onClick={onBack}>
            Back
          </button>
        )}
        <button className="btn primary" disabled={!files.log} onClick={() => files.log && onContinue(files.log)}>
          Continue to review
        </button>
      </div>
    </Screen>
  );
}
