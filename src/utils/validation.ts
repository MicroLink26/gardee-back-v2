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

// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: unknown): { valid: boolean; error?: string } {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email doit être une chaîne de caractères' };
  }

  const trimmed = email.trim().toLowerCase();

  if (!trimmed || trimmed.length === 0) {
    return { valid: false, error: 'Email ne peut pas être vide' };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Email invalide' };
  }

  if (trimmed.length > 255) {
    return { valid: false, error: 'Email trop long' };
  }

  return { valid: true };
}

// Text field validation (name, description, address, etc.)
export function validateTextField(
  value: unknown,
  fieldName: string,
  minLength: number = 2,
  maxLength: number = 500
): { valid: boolean; error?: string } {
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} doit être une chaîne de caractères` };
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return { valid: false, error: `${fieldName} doit faire au moins ${minLength} caractères` };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} ne peut pas dépasser ${maxLength} caractères` };
  }

  return { valid: true };
}

// Number field validation
export function validateNumber(
  value: unknown,
  fieldName: string,
  min: number = 0,
  max: number = Infinity
): { valid: boolean; error?: string; value?: number } {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return { valid: false, error: `${fieldName} doit être un nombre` };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} doit être un nombre valide` };
  }

  if (num < min) {
    return { valid: false, error: `${fieldName} doit être au minimum ${min}` };
  }

  if (num > max) {
    return { valid: false, error: `${fieldName} doit être au maximum ${max}` };
  }

  return { valid: true, value: num };
}

// Array of strings validation (prestations)
export function validateStringArray(
  value: unknown,
  fieldName: string,
  minItems: number = 1,
  maxItems: number = 50
): { valid: boolean; error?: string } {
  if (!Array.isArray(value)) {
    return { valid: false, error: `${fieldName} doit être un tableau` };
  }

  if (value.length < minItems) {
    return { valid: false, error: `${fieldName} doit contenir au moins ${minItems} élément(s)` };
  }

  if (value.length > maxItems) {
    return { valid: false, error: `${fieldName} ne peut pas contenir plus de ${maxItems} éléments` };
  }

  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) {
      return { valid: false, error: `Tous les éléments de ${fieldName} doivent être des chaînes non-vides` };
    }
    if (item.trim().length > 100) {
      return { valid: false, error: `Chaque élément de ${fieldName} ne peut pas dépasser 100 caractères` };
    }
  }

  return { valid: true };
}

// Label name validation
export function validateLabelName(labelName: unknown): { valid: boolean; error?: string } {
  if (typeof labelName !== 'string') {
    return { valid: false, error: 'Le nom du label doit être une chaîne de caractères' };
  }

  const trimmed = labelName.trim();

  if (!trimmed || trimmed.length === 0) {
    return { valid: false, error: 'Le nom du label ne peut pas être vide' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Le nom du label ne peut pas dépasser 50 caractères' };
  }

  return { valid: true };
}
