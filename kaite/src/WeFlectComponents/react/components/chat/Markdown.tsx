// KAIte/react/components/chat/Markdown.tsx
//
// Renders the agent's Markdown with the project's own renderer.

import { renderMarkdown } from "../../../logic/markdown";

export interface MarkdownProps {
  source: string;
}

export function Markdown({ source }: MarkdownProps) {
  // renderMarkdown HTML-escapes its input before adding any tags and only
  // emits a fixed tag subset, so its output is safe to inject.
  return <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
