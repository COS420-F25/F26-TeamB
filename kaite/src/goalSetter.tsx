// KAIte/react/components/framing/CustomNote.tsx
//
// Optional free-text note about how the conversation should go.

import { useId } from "react";
import { CUSTOM_MAX_CHARS } from "./Logic/framingIndex";

export interface CustomNoteProps {
  value: string;
  onChange: (value: string) => void;
}

export function CustomNote({ value, onChange }: CustomNoteProps) {
  const id = useId();
  return (
    <section className="panel soft framing-custom">
      <label htmlFor={id}>
        <strong>What do you want to walk away with? KAIte will keep these in mind during the reflection and check in on them before wrapping up. Add up to 3.</strong> (optional)
      </label>
      {/* The server trims to the same limit (normalizeFraming). */}
      <textarea
        id={id}
        rows={2}
        maxLength={CUSTOM_MAX_CHARS}
        placeholder="In your own words…"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    </section>
  );
}
