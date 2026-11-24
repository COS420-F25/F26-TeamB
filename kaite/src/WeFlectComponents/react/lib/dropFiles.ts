// KAIte/react/lib/dropFiles.ts
//
// File intake helpers shared by the file picker, folder picker and
// drag-and-drop.

/** A File plus the path it should be displayed and identified by. */
export interface NamedFile {
  file: File;
  path: string;
}

// Extension pre-filter applied before any file is read, so a dropped project
// folder does not pull in images or binaries. The real format decision is
// content-based and happens in logic/parser.
export const SUPPORTED_EXT = [".json", ".jsonl", ".txt", ".md"];

export function isSupported(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXT.some((ext) => lower.endsWith(ext));
}

/**
 * Name a picked File. webkitRelativePath is only populated for folder picks,
 * so individually chosen files are keyed by bare name.
 */
export function namedFile(f: File): NamedFile {
  return {
    file: f,
    path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
  };
}

// Minimal local typing for the non-standard FileSystemEntry API returned by
// webkitGetAsEntry(): callback-based, vendor-prefixed and only partially typed
// across TS versions.
interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
  file?: (cb: (f: File) => void, err?: () => void) => void;
  createReader?: () => {
    readEntries: (cb: (entries: FileSystemEntryLike[]) => void, err?: () => void) => void;
  };
}

/**
 * Collect File objects from a drop, recursing into any dropped folders.
 * Call it synchronously inside the drop handler: entries go stale once the
 * handler yields, so they are captured before the first await.
 */
export async function gatherDropEntries(dt: DataTransfer): Promise<NamedFile[]> {
  const items = dt.items;
  const entries: FileSystemEntryLike[] = [];
  if (items && items.length) {
    for (const item of Array.from(items)) {
      const getEntry = (item as DataTransferItem & {
        webkitGetAsEntry?: () => FileSystemEntryLike | null;
      }).webkitGetAsEntry;
      const entry = getEntry ? getEntry.call(item) : null;
      if (entry) entries.push(entry);
    }
  }

  if (entries.length === 0) {
    // Fallback: no entry API, use the flat file list.
    return Array.from(dt.files).map((f) => ({ file: f, path: f.name }));
  }

  const out: NamedFile[] = [];
  for (const entry of entries) out.push(...(await traverseEntry(entry)));
  return out;
}

// Depth-first walk of one dropped entry. Never rejects: an unreadable file or
// directory yields [] so one bad entry cannot abort the whole drop.
function traverseEntry(entry: FileSystemEntryLike): Promise<NamedFile[]> {
  return new Promise((resolve) => {
    if (entry.isFile && entry.file) {
      // fullPath is absolute within the drop ("/folder/a.json"); the leading
      // slash is stripped so it matches the folder picker's webkitRelativePath.
      entry.file(
        (file) => resolve([{ file, path: entry.fullPath.replace(/^\//, "") }]),
        () => resolve([])
      );
      return;
    }
    if (entry.isDirectory && entry.createReader) {
      const reader = entry.createReader();
      const all: NamedFile[] = [];
      const readBatch = () => {
        reader.readEntries(async (batch) => {
          if (batch.length === 0) {
            resolve(all);
            return;
          }
          for (const child of batch) all.push(...(await traverseEntry(child)));
          readBatch(); // readEntries returns at most ~100 entries per call
        }, () => resolve(all));
      };
      readBatch();
      return;
    }
    resolve([]);
  });
}
