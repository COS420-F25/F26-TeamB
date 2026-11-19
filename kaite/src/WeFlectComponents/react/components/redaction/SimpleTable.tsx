// KAIte/react/components/redaction/SimpleTable.tsx
//
// Flat table used by the preserved, flagged and counts sections.

import type { ReactNode } from "react";

export interface SimpleTableRow {
  key: string;
  cells: ReactNode[];
}

export interface SimpleTableProps {
  headers: string[];
  rows: SimpleTableRow[];
  className?: string;
}

export function SimpleTable({ headers, rows, className }: SimpleTableProps) {
  return (
    <table className={className}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, i) => (
              <td key={i}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
