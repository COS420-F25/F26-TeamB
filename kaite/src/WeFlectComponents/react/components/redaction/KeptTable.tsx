// KAIte/react/components/redaction/KeptTable.tsx
//
// Review section 2: content the engine deliberately left visible. One row per
// distinct text (which conversation it sat in does not matter). Unticked by
// default; ticking a row hides it after all.

import type { KeptPlaceholder } from "../../../logic/types";
import { DecisionCheckbox } from "./DecisionCheckbox";
import { SimpleTable } from "./SimpleTable";

export interface KeptTableProps {
  kept: KeptPlaceholder[];
  /** Whether this kept text has been ticked to be redacted after all. */
  isRedacted: (text: string) => boolean;
  onToggle: (text: string, redact: boolean) => void;
}

/** Distinct kept texts with the note from their first occurrence. */
export function distinctKept(kept: KeptPlaceholder[]): [text: string, note: string][] {
  const byText = new Map<string, string>();
  for (const k of kept) if (!byText.has(k.text)) byText.set(k.text, k.note);
  return [...byText];
}

export function KeptTable({ kept, isRedacted, onToggle }: KeptTableProps) {
  return (
    <SimpleTable
      className="f-kept"
      headers={["Redact?", "Content", "Why preserved"]}
      rows={distinctKept(kept).map(([text, note]) => ({
        key: text,
        cells: [
          <DecisionCheckbox
            checked={isRedacted(text)}
            ariaLabel={`Redact ${text}`}
            onChange={(checked) => onToggle(text, checked)}
          />,
          text,
          note,
        ],
      }))}
    />
  );
}
