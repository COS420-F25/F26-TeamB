// KAIte/react/components/redaction/DownloadButtons.tsx
//
// The four local downloads. All are built in the browser from the redaction
// PROPOSAL (not the result after the student's decisions), as in weflect.
// The report and rules files contain original identifiers and are
// never sent anywhere.

import type { RedactionResult } from "../../../logic/types";
import { buildFindingsJson, buildFindingsMarkdown, buildVerifyRules, emitTurnJsonl } from "../../../logic/findings";
import { downloadText } from "../../lib/download";

export interface DownloadButtonsProps {
  redaction: RedactionResult;
}

export function DownloadButtons({ redaction }: DownloadButtonsProps) {
  return (
    <div className="f-downloads">
      <button
        type="button"
        className="btn"
        onClick={() => downloadText("findings_report.md", buildFindingsMarkdown(redaction), "text/markdown")}
      >
        Report (.md)
      </button>
      <button
        type="button"
        className="btn"
        onClick={() =>
          downloadText("findings_report.json", JSON.stringify(buildFindingsJson(redaction), null, 2), "application/json")
        }
      >
        findings_report.json
      </button>
      <button
        type="button"
        className="btn"
        onClick={() =>
          downloadText("verify_rules.json", JSON.stringify(buildVerifyRules(redaction), null, 2), "application/json")
        }
      >
        verify_rules.json
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => downloadText("redacted.jsonl", emitTurnJsonl(redaction.conversations), "application/jsonl")}
      >
        Redacted log (.jsonl)
      </button>
    </div>
  );
}
