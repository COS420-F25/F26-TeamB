// KAIte/react/components/import/FileList.tsx
//
// The list of files added so far: path, detected format and how many
// conversations each yielded.

import type { FileRow } from "../../hooks/useImportedFiles";

export interface FileListProps {
  rows: FileRow[];
}

export function FileList({ rows }: FileListProps) {
  return (
    <ul className="filelist" aria-live="polite">
      {rows.map((r) => (
        <li key={r.path}>
          <span>{r.path}</span>
          {/* Any file that produced no conversations gets the amber "err" style. */}
          <span className={r.count === 0 ? "fmt err" : "fmt"}>
            {r.format === "unknown" && r.count === 0
              ? "skipped · not a conversation file"
              : `${r.format} · ${r.count} conv`}
          </span>
        </li>
      ))}
    </ul>
  );
}
