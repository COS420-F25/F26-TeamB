// KAIte/react/components/redaction/CountsTable.tsx
//
// Review section 5: totals for the redaction proposal.

import type { RedactionResult } from "../../../logic/types";
import { countFindings } from "../../../logic/findings";
import { SimpleTable } from "./SimpleTable";

export interface CountsTableProps {
  redaction: RedactionResult;
}

export function CountsTable({ redaction }: CountsTableProps) {
  const counts = countFindings(redaction);
  const rows: [string, string][] = [
    ["Distinct identifiers redacted", `${counts.distinctOriginals} (${counts.totalOccurrences} occurrences)`],
    ["Persons numbered", String(counts.personsNumbered)],
    ["Other entities numbered", String(counts.entitiesNumbered)],
    ["Conversations flagged for review", String(counts.flaggedConversations)],
    ["Placeholder secrets kept + noted", String(counts.keptPlaceholders)],
  ];
  return (
    <SimpleTable headers={["What", "Count"]} rows={rows.map(([what, count]) => ({ key: what, cells: [what, count] }))} />
  );
}
