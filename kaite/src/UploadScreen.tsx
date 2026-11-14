import React from 'react';
import './UploadScreen.css';

const UploadScreen: React.FC = () => {
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
        <section className="upload-dropzone" aria-label="File upload area">
          <div className="upload-icon" aria-hidden="true">
            ↑
          </div>

          <h2>Add your AI logs</h2>
          <p>Drag files or a folder here, or choose below</p>

          <div className="upload-file-buttons">
            <button type="button" className="upload-outline-button">
              Choose files
            </button>
            <button type="button" className="upload-outline-button">
              Choose a folder
            </button>
          </div>

          <span className="upload-supported-formats">
            Supports .json, .jsonl and .txt
          </span>
        </section>

        {/* Bottom navigation */}
        <footer className="upload-footer">
          <button type="button" className="upload-outline-button">
            Back
          </button>

          <div className="upload-continue">
            <span>Add at least one chat or file to continue</span>
            <button type="button" className="upload-continue-button">
              CONTINUE TO REVIEW <span aria-hidden="true">→</span>
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default UploadScreen;