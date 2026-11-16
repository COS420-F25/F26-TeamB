// KAIte/react/components/import/Dropzone.tsx
//
// The three intake routes: file picker, folder picker and drag-and-drop.
// Reports whatever was picked or dropped through onFiles; it does not read or
// parse anything itself.

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { gatherDropEntries, namedFile, NamedFile } from "../../lib/dropFiles";

export interface DropzoneProps {
  onFiles: (files: NamedFile[]) => void;
}

// `webkitdirectory` turns the picker into a folder picker and gives each File a
// webkitRelativePath. It is non-standard, so React's types do not know it; the
// lower-case attribute is passed through to the DOM as written.
const FOLDER_PICKER = { webkitdirectory: "" } as Record<string, string>;

export function Dropzone({ onFiles }: DropzoneProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    onFiles(Array.from(input.files ?? []).map(namedFile));
    // Reset so picking the same files or folder again still fires a change event.
    input.value = "";
  };

  // preventDefault on dragover/dragenter is what makes the element a valid
  // drop target; the "drag" class only drives the highlight.
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    // gatherDropEntries captures the entries synchronously, before it awaits.
    void gatherDropEntries(e.dataTransfer).then(onFiles);
  };

  return (
    <div
      className={dragging ? "dropzone drag" : "dropzone"}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input ref={fileInput} type="file" multiple accept=".json,.jsonl,.txt,.md" hidden onChange={onPick} />
      <input ref={folderInput} type="file" multiple hidden onChange={onPick} {...FOLDER_PICKER} />
      <span className="dz-title">Add your AI logs</span>
      <span className="dz-note">Drag files or a folder here, or choose below</span>
      <div className="dz-buttons">
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          Choose files
        </button>
        <button type="button" className="btn" onClick={() => folderInput.current?.click()}>
          Choose a folder
        </button>
      </div>
    </div>
  );
}
