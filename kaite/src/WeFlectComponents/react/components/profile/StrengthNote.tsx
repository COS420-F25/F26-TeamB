// KAIte/react/components/profile/StrengthNote.tsx
//
// "Something to notice": one affirming observation picked from the summary.

import type { ReflectionSummary } from "../../../logic/types";
import { strengthNote } from "../../lib/format";

export interface StrengthNoteProps {
  summary: ReflectionSummary;
}

export function StrengthNote({ summary }: StrengthNoteProps) {
  return <p>{strengthNote(summary)}</p>;
}
