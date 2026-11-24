// KAIte/react/components/chat/EvidenceNote.tsx
//
// The agent's basis for a question, drawn from the student's own logs. Shown
// as a collapsed disclosure under the turn.

export interface EvidenceNoteProps {
  text: string;
}

export function EvidenceNote({ text }: EvidenceNoteProps) {
  return (
    <details className="evidence">
      <summary>Why am I asking this?</summary>
      <div className="e-body">{text}</div>
    </details>
  );
}
