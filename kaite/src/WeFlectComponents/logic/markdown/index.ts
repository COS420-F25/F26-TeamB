// KAIte/logic/markdown/index.ts (copy of src/client/md.ts)
//
// A tiny, dependency-free Markdown-to-HTML renderer for the reflection chat.
// The assistant's opening turn is a Markdown reflection document, and we render
// it as formatted HTML rather than showing literal #/-/** symbols.
//
// SECURITY: this output is inserted via innerHTML, so the source is HTML-escaped
// FIRST and only then transformed into a small, known-safe subset of tags. No
// raw HTML from the model is ever passed through. Links are restricted to
// http/https schemes to prevent javascript:/data: URLs.

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Inline formatting, applied to already-escaped text. */
function renderInline(s: string): string {
  // Inline code first, so its contents are not further formatted.
  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  // Links [text](http(s)://…) — scheme-restricted.
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, text, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
  );
  // Bold, then italic.
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // The (^|[^*]) / (^|[^_]) guard stops a single-marker rule from matching the
  // second half of a bold pair that the line above did not consume (e.g. an
  // unbalanced "**"), and keeps snake_case_words from turning italic mid-word.
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
  return s;
}

/**
 * Render a safe subset of Markdown to HTML: fenced code blocks, ATX headings,
 * blockquotes, horizontal rules, unordered/ordered lists, and paragraphs, with
 * inline bold/italic/code/links.
 */
export function renderMarkdown(src: string): string {
  const escaped = escapeHtml(src.replace(/\r\n/g, "\n"));
  const lines = escaped.split("\n");
  const out: string[] = [];

  let i = 0;
  let listType: "ul" | "ol" | null = null;

  // Lists are not nested: one open list at a time, closed by any other block
  // or a blank line. Called at the top of every non-list branch so a list can
  // never swallow the block that follows it.
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block. An unclosed fence consumes to end of input — while a
    // turn is still streaming, the opening fence arrives before its close, and
    // rendering the tail as code is the right interim state (the next delta
    // re-renders the whole buffer anyway).
    const fence = line.match(/^\s*```/);
    if (fence) {
      closeList();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // consume closing fence (if present)
      out.push(`<pre><code>${body.join("\n")}</code></pre>`);
      continue;
    }

    // Horizontal rule.
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      closeList();
      out.push("<hr />");
      i++;
      continue;
    }

    // Heading.
    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote. Matches the ESCAPED form `&gt;` because escapeHtml ran
    // before block parsing; a literal ">" can no longer appear in `line`.
    const quote = line.match(/^\s*&gt;\s?(.*)$/);
    if (quote) {
      closeList();
      out.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      i++;
      continue;
    }

    // Unordered list item.
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${renderInline(ul[1])}</li>`);
      i++;
      continue;
    }

    // Ordered list item.
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${renderInline(ol[1])}</li>`);
      i++;
      continue;
    }

    // Blank line.
    if (/^\s*$/.test(line)) {
      closeList();
      i++;
      continue;
    }

    // Paragraph: gather consecutive non-structural lines. The guard list below
    // DUPLICATES the block regexes above (fence, heading, list, ordered list,
    // blockquote, rule) so a paragraph stops exactly where the next block would
    // start. If a block pattern is added or changed above, change it here too,
    // or that block will be absorbed into the preceding paragraph as a <br />.
    closeList();
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s*#{1,6}\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*&gt;\s?/.test(lines[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(para.join("<br />"))}</p>`);
  }

  closeList();
  return out.join("\n");
}
