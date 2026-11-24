// KAIte/react/hooks/useImportedFiles.ts
//
// State for the import screen: every file added so far, parsed once, plus the
// merged ConversationLog derived from them. Files are read and parsed in the
// browser; nothing here makes a network call.

import { useCallback, useMemo, useState } from "react";
import type { Conversation, ConversationLog, SourceFormat } from "../../logic/types";
import { parseFile } from "../../logic/parser";
import { isSupported, NamedFile } from "../lib/dropFiles";

/** One line of the file list: what was detected and how many conversations it yielded. */
export interface FileRow {
  path: string;
  format: SourceFormat;
  count: number;
}

interface ImportedEntry {
  row: FileRow;
  conversations: Conversation[];
}

export interface ImportView {
  rows: FileRow[];
  /** Merged log, or null until at least one conversation has parsed. */
  log: ConversationLog | null;
  /** The summary line under the file list ("" when nothing was added). */
  summary: string;
}

/** Derive the file rows, merged log and summary line from everything added so far. */
export function buildImportView(entries: readonly ImportedEntry[]): ImportView {
  const rows = entries.map((e) => e.row);
  const conversations = entries.flatMap((e) => e.conversations);

  // The log carries a single source format. Files that yielded nothing are
  // ignored for this vote, and a mix of formats collapses to "unknown".
  const formats = new Set<SourceFormat>(rows.filter((r) => r.count > 0).map((r) => r.format));
  const source: SourceFormat = formats.size === 1 ? [...formats][0] : "unknown";
  const log = conversations.length > 0 ? { source, conversations } : null;

  const total = conversations.length;
  if (entries.length === 0) return { rows, log, summary: "" };
  if (total === 0) {
    return { rows, log, summary: "No conversations could be parsed from those files. Try a different export." };
  }

  // Timestamps are ISO 8601 strings, so a lexical sort orders them and
  // slice(0, 10) yields the date. Conversations without one do not contribute.
  const dates = conversations
    .map((c) => c.timestamp)
    .filter((t): t is string => !!t)
    .sort();
  const span =
    dates.length >= 1 ? ` spanning ${dates[0].slice(0, 10)} to ${dates[dates.length - 1].slice(0, 10)}` : "";
  const summary =
    `Parsed ${total} conversation${total === 1 ? "" : "s"} from ${entries.length} ` +
    `file${entries.length === 1 ? "" : "s"}${span}.`;
  return { rows, log, summary };
}

export interface ImportedFiles extends ImportView {
  hasFiles: boolean;
  /** Read, parse and merge picked or dropped files. Additive; a re-added path replaces its entry. */
  addFiles: (files: NamedFile[]) => Promise<void>;
  clear: () => void;
}

export function useImportedFiles(): ImportedFiles {
  // Keyed by display path, in first-added order.
  const [entries, setEntries] = useState<ReadonlyMap<string, ImportedEntry>>(new Map());
  // A transient line ("Reading 3 files…", "No supported files found…") that
  // replaces the derived summary until the next successful add or a clear.
  const [notice, setNotice] = useState<string | null>(null);

  const addFiles = useCallback(async (files: NamedFile[]) => {
    const supported = files.filter((f) => isSupported(f.path));
    if (supported.length === 0) {
      setNotice("No supported files found. WeFlect reads .json, .jsonl, .txt, and .md exports.");
      return;
    }
    setNotice(`Reading ${supported.length} file${supported.length === 1 ? "" : "s"}…`);

    const parsed: [string, ImportedEntry][] = [];
    for (const nf of supported) {
      let text: string;
      try {
        text = await nf.file.text();
      } catch {
        parsed.push([nf.path, { row: { path: nf.path, format: "unknown", count: 0 }, conversations: [] }]);
        continue;
      }
      const { format, conversations } = parseFile({ name: nf.path, text });
      parsed.push([nf.path, { row: { path: nf.path, format, count: conversations.length }, conversations }]);
    }

    setEntries((prev) => new Map([...prev, ...parsed]));
    setNotice(null);
  }, []);

  const clear = useCallback(() => {
    setEntries(new Map());
    setNotice(null);
  }, []);

  const view = useMemo(() => buildImportView([...entries.values()]), [entries]);

  return {
    ...view,
    summary: notice ?? view.summary,
    hasFiles: entries.size > 0,
    addFiles,
    clear,
  };
}
