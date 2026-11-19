// KAIte/react/components/chat/Composer.tsx
//
// The message box with "Skip this one" and "Add and continue".

import { useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

export interface ComposerProps {
  /** True while a reply is streaming: both buttons are disabled. */
  disabled: boolean;
  onSend: (text: string) => void;
  onSkip: () => void;
}

export function Composer({ disabled, onSend, onSkip }: ComposerProps) {
  const [text, setText] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const id = useId();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  // Enter submits; Shift+Enter inserts a newline. isComposing skips the Enter
  // that commits an IME candidate (CJK input etc.).
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (disabled) return; // reply still streaming: don't queue another send
    form.current?.requestSubmit();
  };

  return (
    <form className="composer" ref={form} onSubmit={onSubmit}>
      <label className="sr-only" htmlFor={id}>
        Your turn
      </label>
      <textarea
        id={id}
        rows={3}
        placeholder="Your turn…"
        required
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
      <div className="composer-actions">
        <button type="button" className="btn ghost" disabled={disabled} onClick={onSkip}>
          Skip this one
        </button>
        <button type="submit" className="btn primary" disabled={disabled}>
          Add and continue
        </button>
      </div>
    </form>
  );
}
