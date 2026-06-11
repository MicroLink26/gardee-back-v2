// Input validation utilities for message content and other user inputs

const MAX_MESSAGE_LENGTH = 5000;

export function validateMessageContent(content: unknown): { valid: boolean; error?: string } {
  if (typeof content !== 'string') {
    return { valid: false, error: 'Le contenu doit être une chaîne de caractères' };
  }

  const trimmed = content.trim();

  if (!trimmed || trimmed.length === 0) {
    return { valid: false, error: 'Le message ne peut pas être vide' };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères` };
  }

  return { valid: true };
}

export function validateMessageIds(messageIds: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(messageIds)) {
    return { valid: false, error: 'messageIds doit être un tableau' };
  }

  if (messageIds.length === 0) {
    return { valid: false, error: 'Au moins un messageId est requis' };
  }

  if (messageIds.length > 100) {
    return { valid: false, error: 'Maximum 100 messageIds par requête' };
  }

  for (const id of messageIds) {
    if (typeof id !== 'string' || !id.trim()) {
      return { valid: false, error: 'Chaque messageId doit être une chaîne non-vide' };
    }
  }

  return { valid: true };
}

export function validateToken(token: unknown): { valid: boolean; error?: string } {
  if (typeof token !== 'string' || !token.trim()) {
    return { valid: false, error: 'Token invalide' };
  }

  return { valid: true };
}

export function validateEmoji(emoji: unknown): { valid: boolean; error?: string } {
  if (typeof emoji !== 'string' || !emoji.trim()) {
    return { valid: false, error: 'Emoji invalide' };
  }

  // Ensure emoji is a single character (basic validation)
  if (emoji.trim().length > 2) {
    return { valid: false, error: 'Emoji invalide' };
  }

  return { valid: true };
}
