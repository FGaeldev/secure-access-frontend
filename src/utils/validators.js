/**
 * @file validators.js
 * @description Client-side validation utilities for the IAS (Integrated Access System).
 *              Centralizes all input validation rules so Login, forms, and any future
 *              pages share a single source of truth.
 *
 * @context     Used in Login.jsx (and any future form pages).
 *              Does NOT replace server-side validation — server always re-validates.
 *
 * @dependencies None — pure JS, no imports required.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum password character length enforced by the backend seed. */
const PASSWORD_MIN_LENGTH = 8;

/** Maximum length to reject absurdly long inputs before hitting the server. */
const INPUT_MAX_LENGTH = 255;

/** MFA answers are short security-question responses, not passwords. */
const MFA_MIN_LENGTH = 1;
const MFA_MAX_LENGTH = 128;

// ---------------------------------------------------------------------------
// Primitive helpers (not exported — internal use only)
// ---------------------------------------------------------------------------

/**
 * Checks whether a value is a non-empty string after trimming whitespace.
 *
 * @param {*} value - The value to check.
 * @returns {boolean} True if value is a non-empty string.
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Checks whether a string's trimmed length is within [min, max].
 *
 * @param {string} value - String to measure.
 * @param {number} min   - Minimum allowed length (inclusive).
 * @param {number} max   - Maximum allowed length (inclusive).
 * @returns {boolean}
 */
function isLengthInRange(value, min, max) {
  const len = value.trim().length;
  return len >= min && len <= max;
}

// ---------------------------------------------------------------------------
// Exported validators
// Each function returns { valid: boolean, error: string|null }
// Consistent shape makes it easy to spread into form state.
// ---------------------------------------------------------------------------

/**
 * Validates a username field.
 *
 * Rules:
 *  - Must not be empty.
 *  - Must be within [3, INPUT_MAX_LENGTH] characters.
 *  - Only alphanumeric characters, underscores, and hyphens allowed.
 *    (Prevents basic injection attempts at the client layer.)
 *
 * @param {string} username - Raw value from the input field.
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateUsername(username) {
  if (!isNonEmptyString(username)) {
    return { valid: false, error: "Username is required." };
  }

  if (!isLengthInRange(username, 3, INPUT_MAX_LENGTH)) {
    return {
      valid: false,
      error: `Username must be between 3 and ${INPUT_MAX_LENGTH} characters.`,
    };
  }

  // Restrict to safe characters — usernames in the seed are alphanumeric
  const safePattern = /^[a-zA-Z0-9_-]+$/;
  if (!safePattern.test(username.trim())) {
    return {
      valid: false,
      error: "Username may only contain letters, numbers, underscores, or hyphens.",
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates a password field.
 *
 * Rules:
 *  - Must not be empty.
 *  - Must meet minimum length (PASSWORD_MIN_LENGTH).
 *  - Must not exceed INPUT_MAX_LENGTH (guards against bcrypt DoS —
 *    bcryptjs silently truncates inputs over 72 bytes, so cap early).
 *
 * Note: Complexity rules (uppercase, symbols, etc.) are intentionally omitted
 * here — the backend enforces what it needs. Keep client rules in sync with
 * whatever the backend requires.
 *
 * @param {string} password - Raw value from the password input.
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validatePassword(password) {
  if (!isNonEmptyString(password)) {
    return { valid: false, error: "Password is required." };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }

  // bcrypt silently truncates beyond 72 bytes — warn the user before that
  if (password.length > INPUT_MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must not exceed ${INPUT_MAX_LENGTH} characters.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates an MFA answer (security-question response).
 *
 * Rules:
 *  - Must not be empty.
 *  - Must not exceed MFA_MAX_LENGTH.
 *
 * No pattern restrictions — answers may include spaces, punctuation, etc.
 *
 * @param {string} answer - Raw value from the MFA answer input.
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateMfaAnswer(answer) {
  if (!isNonEmptyString(answer)) {
    return { valid: false, error: "Security answer is required." };
  }

  if (!isLengthInRange(answer, MFA_MIN_LENGTH, MFA_MAX_LENGTH)) {
    return {
      valid: false,
      error: `Answer must not exceed ${MFA_MAX_LENGTH} characters.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Runs all login-form fields at once and returns a map of field → error.
 *
 * Usage:
 *   const errors = validateLoginForm({ username, password });
 *   if (Object.keys(errors).length > 0) { // block submission }
 *
 * @param {{ username: string, password: string }} fields
 * @returns {Object.<string, string>} Map of field names to error strings.
 *                                    Empty object means all fields valid.
 */
export function validateLoginForm({ username, password }) {
  const errors = {};

  const usernameResult = validateUsername(username);
  if (!usernameResult.valid) errors.username = usernameResult.error;

  const passwordResult = validatePassword(password);
  if (!passwordResult.valid) errors.password = passwordResult.error;

  return errors;
}

/**
 * Runs MFA form validation.
 *
 * @param {{ answer: string }} fields
 * @returns {Object.<string, string>} Map of field names to error strings.
 */
export function validateMfaForm({ answer }) {
  const errors = {};

  const answerResult = validateMfaAnswer(answer);
  if (!answerResult.valid) errors.answer = answerResult.error;

  return errors;
}
