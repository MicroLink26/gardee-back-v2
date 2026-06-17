import xss from 'xss';

const xssOptions = { whiteList: {}, stripIgnoredTag: true };

export function sanitizeText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  return xss(text.trim(), xssOptions);
}

export function sanitizeHtmlText(text: string | undefined | null): string | undefined {
  return sanitizeText(text);
}
