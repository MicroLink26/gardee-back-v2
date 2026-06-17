export function sanitizeText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  // Simple HTML entity encoding to prevent XSS
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function sanitizeHtmlText(text: string | undefined | null): string | undefined {
  return sanitizeText(text);
}
