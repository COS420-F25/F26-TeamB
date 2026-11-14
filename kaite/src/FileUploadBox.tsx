import React, { DragEvent, useRef, useState } from 'react';

export const LOCAL_CONVERSATIONS_KEY = 'kaite-uploaded-conversations';

const SUPPORTED_EXTENSIONS = ['.json', '.jsonl', '.txt'];

interface UploadedConversation {
  name: string;
  content: string;
  size?: number;
}

function readUploadedConversations(): UploadedConversation[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(LOCAL_CONVERSATIONS_KEY) || '[]');
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored.filter(
      (conversation): conversation is UploadedConversation =>
        typeof conversation?.name === 'string' && typeof conversation?.content === 'string'
    );
  } catch {
    return [];
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('File contents could not be read as text.'));
      }
    };
    reader.onerror = () => reject(new Error('File could not be read.'));
    reader.readAsText(file);
  });
}

export interface FileUploadBoxProps {
  /** Called whenever a file succeeds or fails upload, for surfacing toast/status messages. */
  onUploadMessage?: React.Dispatch<React.SetStateAction<string>>;
}

function FileUploadBox({ onUploadMessage }: FileUploadBoxProps): React.JSX.Element {
  const [isOver, setIsOver] = useState(false);
  const [files, setFiles] = useState<Array<{ name: string; size?: number }>>(
    () => readUploadedConversations().map(({ name, size }) => ({ name, size })),
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (selectedFiles: File[]): Promise<void> => {
    for (const file of selectedFiles) {
      if (!file.name.toLowerCase().endsWith('.json')) {
        onUploadMessage?.(
          `${file.name}: unsupported file type. Supported formats: .json, .jsonl, .txt`,
        );
        continue;
      }

      try {
        const content = await readFileAsText(file);
        // the `JSON.parse(content);` that was originally here doesn't do anything since it's return value isn't used

        const conversations = readUploadedConversations();
        const uploadedConversation = { name: file.name, content, size: file.size };
        window.localStorage.setItem(
          LOCAL_CONVERSATIONS_KEY,
          JSON.stringify([...conversations, uploadedConversation]),
        );
        setFiles((current) => [...current, { name: file.name, size: file.size }]);
        onUploadMessage?.(`${file.name} uploaded successfully.`);
      } catch {
        onUploadMessage?.(`${file.name} is not valid or could not be saved.`);
      }
    }
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsOver(false);
    void processFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <section
      className={`upload-dropzone${isOver ? ' upload-dropzone-active' : ''}`}
      aria-label="File upload area"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="upload-icon" aria-hidden="true">
        ↑
      </div>

      <h2>Add your AI logs</h2>
      <p>Drag files or a folder here, or choose below</p>

      <div className="upload-file-buttons">
        <button
          type="button"
          className="upload-outline-button"
          onClick={() => fileInputRef.current?.click()}
        >
          Choose files
        </button>
        <button
          type="button"
          className="upload-outline-button"
          onClick={() => folderInputRef.current?.click()}
        >
          Choose a folder
        </button>
      </div>

      <span className="upload-supported-formats">Supports .json, .jsonl and .txt</span>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".json,.jsonl,.txt"
        style={{ display: 'none' }}
        aria-label="Choose files"
        onChange={(event) => {
          void processFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = '';
        }}
      />

      {/* webkitdirectory/directory aren't in React's typings, so they're spread in untyped */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        aria-label="Choose a folder"
        {...{ webkitdirectory: '', directory: '' }}
        onChange={(event) => {
          void processFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = '';
        }}
      />

      {files.length > 0 && (
        <div className="upload-file-list-wrapper">
          <ul className="upload-file-list mb-0">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span>{file.name}</span>
                {typeof file.size === 'number' && (
                  <span className="upload-file-size">{Math.ceil(file.size / 1024)} KB</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default FileUploadBox