/**
 * Encode HTML special characters to prevent XSS attacks.
 * Simple implementation that escapes: & < > " '
 */
export function sanitizeText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  return text.trim().replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
    };
    return map[char] || char;
  });
}
