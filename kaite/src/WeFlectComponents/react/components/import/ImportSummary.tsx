// KAIte/react/components/import/ImportSummary.tsx
//
// The one-line status under the file list: how many conversations parsed and
// the dates they span, or why nothing could be read.

export interface ImportSummaryProps {
  text: string;
}

export function ImportSummary({ text }: ImportSummaryProps) {
  return <p className="import-summary">{text}</p>;
}
