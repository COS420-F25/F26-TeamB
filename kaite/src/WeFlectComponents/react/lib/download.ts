// KAIte/react/lib/download.ts

/**
 * Trigger a browser download of in-memory text via a Blob URL. No server
 * round-trip: the findings report contains original identifiers and must stay
 * on the device. The object URL is revoked right after click(), by which point
 * the browser has already captured the blob.
 */
export function downloadText(filename: string, text: string, mime = "text/plain"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
