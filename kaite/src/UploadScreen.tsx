import React, { useRef, useState } from 'react';
import './UploadScreen.css';

export const LOCAL_CONVERSATIONS_KEY = 'kaite-uploaded-conversations';

interface UploadedConversation {
  name: string;
  content: string;
  size: number;
}

interface UploadScreenProps {
  message: string;
  onBack: () => void;
}

function readUploadedConversations(): UploadedConversation[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(LOCAL_CONVERSATIONS_KEY) || '[]');
    if (!Array.isArray(stored)) {
      return [];
    }

    return stored.filter(
      (conversation): conversation is UploadedConversation =>
        typeof conversation?.name === 'string' &&
        typeof conversation?.content === 'string' &&
        typeof conversation?.size === 'number',
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

const UploadScreen: React.FC<UploadScreenProps> = ({ message, onBack }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedConversation[]>(readUploadedConversations);
  const [uploadMessage, setUploadMessage] = useState('');

  const processFiles = async (selectedFiles: File[]): Promise<void> => {
    for (const file of selectedFiles) {
      const extension = file.name.toLowerCase().split('.').pop();
      if (!extension || !['json', 'jsonl', 'txt'].includes(extension)) {
        setUploadMessage(`${file.name} has an unsupported file type.`);
        continue;
      }

      try {
        const content = await readFileAsText(file);
        if (!content.trim()) {
          throw new Error('File is empty.');
        }
        if (extension === 'json') {
          JSON.parse(content);
        } else if (extension === 'jsonl') {
          content.split(/\r?\n/).filter((line) => line.trim()).forEach((line) => JSON.parse(line));
        }

        const conversation = { name: file.name, content, size: file.size };
        const updatedFiles = [...readUploadedConversations(), conversation];
        window.localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(updatedFiles));
        setFiles(updatedFiles);
        setUploadMessage(`${file.name} added.`);
      } catch {
        setUploadMessage(`${file.name} is not valid ${extension.toUpperCase()} or could not be saved.`);
      }
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    void processFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div className="upload-screen">
      {/* Navigation bar */}
      <header className="upload-navbar">
        <div className="upload-navbar-brand">KAIte</div>

        <nav className="upload-navbar-links" aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#chat-history">Chat history</a>
          <a href="#settings">Settings</a>
          <div className="upload-avatar" aria-label="User profile">
            NM
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="upload-main">
        <section className="upload-intro">
          <h1>Import your AI chats</h1>

          <p>
            Add export files - or a whole folder of them - from ChatGPT,
            Claude, Claude Code, or Gemini (JSON, JSONL, or pasted text).
            <strong>
              {' '}For the best reflection conversations, use full AI usage
              logs rather than pasted chats.
            </strong>
            {' '}Logs give KAIte more context to work with, so it can spot
            patterns in your AI habits over time.
          </p>

          <p className="upload-privacy">
            <span aria-hidden="true">♙</span>
            Files are read on your device. Nothing is uploaded to a server.
          </p>

          <div className="upload-help">
            <button type="button" className="upload-outline-button">
              How do I get my AI logs? <span aria-hidden="true">↗</span>
            </button>
            <span>
              Step-by-step for ChatGPT, Claude, Claude Code and Gemini.
              Opens in a new tab.
            </span>
          </div>
        </section>

        {/* CollaboraITE import */}
        <section className="collaboraite-card">
          <div className="collaboraite-icon" aria-hidden="true">
            <span>▢</span>
          </div>

          <div className="collaboraite-description">
            <h2>Import conversations from CollaborAITE</h2>
            <p>
              Bring in the AI conversations you've had on CollaborAITE.
              You'll pick which chats to include before KAIte looks at
              anything.
            </p>
          </div>

          <button type="button" className="upload-outline-button collaboraite-button">
            Choose CollaborAITE chats
          </button>
        </section>

        {/* Divider */}
        <div className="upload-divider">
          <span>OR UPLOAD FILES FROM OTHER AI TOOLS</span>
        </div>

        {/* File upload area */}
        <section
          className={`upload-dropzone${isDragging ? ' upload-dropzone-active' : ''}`}
          aria-label="File upload area"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="upload-icon" aria-hidden="true">
            ↑
          </div>

          <h2>Add your AI logs</h2>
          <p>Drag files or a folder here, or choose below</p>

          <div className="upload-file-buttons">
            <button type="button" className="upload-outline-button" onClick={() => fileInputRef.current?.click()}>
              Choose files
            </button>
            <button type="button" className="upload-outline-button" onClick={() => folderInputRef.current?.click()}>
              Choose a folder
            </button>
          </div>

          <input
            ref={fileInputRef}
            className="upload-hidden-input"
            type="file"
            accept=".json,.jsonl,.txt,application/json,text/plain"
            multiple
            aria-label="Choose files to upload"
            onChange={(event) => {
              void processFiles(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = '';
            }}
          />
          <input
            ref={(element) => {
              folderInputRef.current = element;
              element?.setAttribute('webkitdirectory', '');
            }}
            className="upload-hidden-input"
            type="file"
            accept=".json,.jsonl,.txt,application/json,text/plain"
            aria-label="Choose a folder to upload"
            onChange={(event) => {
              void processFiles(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = '';
            }}
          />

          {files.length > 0 && (
            <ul className="upload-file-list" aria-label="Selected files">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <span>{file.name}</span>
                  <span>{Math.ceil(file.size / 1024)} KB</span>
                </li>
              ))}
            </ul>
          )}

          {(message || uploadMessage) && (
            <p className="upload-feedback" role="status" aria-live="polite">
              {uploadMessage || message}
            </p>
          )}

          <span className="upload-supported-formats">
            Supports .json, .jsonl and .txt
          </span>
        </section>

        {/* Bottom navigation */}
        <footer className="upload-footer">
            <button type="button" className="upload-outline-button" onClick={onBack}>
            Back
          </button>

          <div className="upload-continue">
            <span>{files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'} ready` : 'Add at least one chat or file to continue'}</span>
            <button type="button" className="upload-continue-button" disabled={files.length === 0}>
              CONTINUE TO REVIEW <span aria-hidden="true">→</span>
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default UploadScreen;