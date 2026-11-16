// KAIte/react/components/redaction/MappingTable.tsx
//
// Review section 1: every proposed redaction the student can overrule, as
// `original -> [PLACEHOLDER]` rows. Rows are grouped by placeholder so every
// alias of a person or entity sits together and shares one replacement cell
// spanning the group; that grouping is the person and entity map.

import { useMemo, useState } from "react";
import type { AppliedOriginal } from "../../../logic/types";
import { DecisionCheckbox } from "./DecisionCheckbox";

export interface MappingTableProps {
  /** The reviewable applied redactions, in engine order. */
  rows: AppliedOriginal[];
  /** Whether this original is still set to be redacted (its box is ticked). */
  isRedacted: (original: string) => boolean;
  onToggle: (original: string, redact: boolean) => void;
}

interface Group {
  replacement: string;
  rows: AppliedOriginal[];
}

type SortKey = "category" | "original" | "replacement" | "occurrences";

const alpha = (s: string, u: string): number =>
  s.localeCompare(u, undefined, { numeric: true, sensitivity: "base" });
const total = (g: Group): number => g.rows.reduce((s, a) => s + a.count, 0);

// Whole groups are sorted, never single rows, so a shared replacement cell
// stays with its rows.
const COMPARATORS: Record<SortKey, (x: Group, y: Group) => number> = {
  category: (x, y) => alpha(x.rows[0].kind, y.rows[0].kind) || alpha(x.replacement, y.replacement),
  original: (x, y) => alpha(x.rows[0].original, y.rows[0].original),
  replacement: (x, y) => alpha(x.replacement, y.replacement),
  occurrences: (x, y) => total(y) - total(x) || alpha(x.replacement, y.replacement),
};

function groupByReplacement(rows: AppliedOriginal[]): Group[] {
  const groups: Group[] = [];
  const byReplacement = new Map<string, Group>();
  for (const a of rows) {
    let g = byReplacement.get(a.replacement);
    if (!g) {
      g = { replacement: a.replacement, rows: [] };
      byReplacement.set(a.replacement, g);
      groups.push(g);
    }
    g.rows.push(a);
  }
  return groups;
}

export function MappingTable({ rows, isRedacted, onToggle }: MappingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const groups = useMemo(() => {
    const grouped = groupByReplacement(rows);
    return sortKey ? [...grouped].sort(COMPARATORS[sortKey]) : grouped;
  }, [rows, sortKey]);

  const sortable = (label: string, key: SortKey, hint: string) => (
    <th style={{ cursor: "pointer" }} title={hint} onClick={() => setSortKey(key)}>
      {label} ⇅
    </th>
  );

  return (
    <table className="f-mapping">
      <thead>
        <tr>
          <th>Redact?</th>
          {sortable("Category", "category", "Sort by category")}
          {sortable("Original", "original", "Sort alphabetically by original")}
          <th>⟶</th>
          {sortable("Replacement", "replacement", "Sort by replacement")}
          {sortable("Occurrences", "occurrences", "Sort by occurrences, most first")}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) =>
          g.rows.map((a, i) => (
            <tr key={a.original} className={i < g.rows.length - 1 ? "f-group-mid" : undefined}>
              <td>
                <DecisionCheckbox
                  checked={isRedacted(a.original)}
                  ariaLabel={`Redact ${a.original}`}
                  onChange={(checked) => onToggle(a.original, checked)}
                />
              </td>
              <td>{a.kind}</td>
              {/* Past 40 characters (long paths, URLs) the cell wraps so one
                  value cannot force the whole table to scroll sideways. */}
              <td className={a.original.length > 40 ? "f-map-from f-map-long" : "f-map-from"}>{a.original}</td>
              <td className="f-map-arrow">⟶</td>
              {/* Emitted once per group, on the first row, spanning the rest. */}
              {i === 0 && (
                <td className="f-map-to" rowSpan={g.rows.length > 1 ? g.rows.length : undefined}>
                  <code>{a.replacement}</code>
                </td>
              )}
              <td>{a.count}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
