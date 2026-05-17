/**
 * @file validators.js
 * @description Client-side validation utilities for the IAS (Integrated Access System).
 *              Centralizes all input validation rules so Login, Signup, ChangeCredentials,
 *              and any future pages share a single source of truth.
 *
 * @context     Used in Login.jsx, Signup.jsx, ChangeCredentials.jsx.
 *              Does NOT replace server-side validation — server always re-validates.
 *
 * @dependencies None — pure JS, no imports required.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum password character length enforced by the backend. */
const PASSWORD_MIN_LENGTH = 8;

/** Maximum length to reject absurdly long inputs before hitting the server. */
const INPUT_MAX_LENGTH = 255;

/** MFA answers are short security-question responses, not passwords. */
const MFA_MIN_LENGTH = 1;
const MFA_MAX_LENGTH = 128;

// ---------------------------------------------------------------------------
// Primitive helpers (not exported — internal use only)
// ---------------------------------------------------------------------------

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isLengthInRange(value, min, max) {
  const len = value.trim().length;
  return len >= min && len <= max;
}

// ---------------------------------------------------------------------------
// Exported validators
// ---------------------------------------------------------------------------

/**
 * Validates a username field.
 *
 * Rules:
 *  - Must not be empty.
 *  - Must be within [3, INPUT_MAX_LENGTH] characters.
 *  - Only alphanumeric characters, underscores, and hyphens allowed.
 *
 * @param {string} username
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateUsername(username) {
  if (!isNonEmptyString(username)) {
    return { valid: false, error: "Username is required." };
  }
  if (!isLengthInRange(username, 3, INPUT_MAX_LENGTH)) {
    return { valid: false, error: `Username must be between 3 and ${INPUT_MAX_LENGTH} characters.` };
  }
  const safePattern = /^[a-zA-Z0-9_-]+$/;
  if (!safePattern.test(username.trim())) {
    return { valid: false, error: "Username may only contain letters, numbers, underscores, or hyphens." };
  }
  return { valid: true, error: null };
}

/**
 * Validates a password field.
 *
 * Rules (must stay in sync with register.php and update_credentials.php):
 *  - Required, non-empty.
 *  - Minimum 8 characters.
 *  - At least one uppercase letter (A-Z).
 *  - At least one lowercase letter (a-z).
 *  - At least one digit (0-9).
 *  - At least one special character (any non-alphanumeric).
 *  - Maximum 255 characters (bcrypt DoS guard).
 *
 * @param {string} password
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validatePassword(password) {
  if (!isNonEmptyString(password)) {
    return { valid: false, error: "Password is required." };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > INPUT_MAX_LENGTH) {
    return { valid: false, error: `Password must not exceed ${INPUT_MAX_LENGTH} characters.` };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character." };
  }
  return { valid: true, error: null };
}

/**
 * Scores password strength from 0–5 based on complexity criteria.
 * Designed for keystroke-level calls — no side effects.
 *
 * Score breakdown:
 *  +1  length >= 8
 *  +1  uppercase letter present
 *  +1  lowercase letter present
 *  +1  digit present
 *  +1  special character present
 *
 * @param {string} password
 * @returns {{ score: number, label: string, color: string }}
 */
export function getPasswordStrength(password) {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8)           score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[a-z]/.test(password))         score++;
  if (/[0-9]/.test(password))         score++;
  if (/[^A-Za-z0-9]/.test(password))  score++;

  const levels = [
    { label: "",            color: "" },
    { label: "Very Weak",   color: "#ef4444" },
    { label: "Weak",        color: "#f97316" },
    { label: "Fair",        color: "#eab308" },
    { label: "Strong",      color: "#22c55e" },
    { label: "Very Strong", color: "#6366f1" },
  ];

  return { score, ...levels[score] };
}

/**
 * Validates an MFA answer (security-question response).
 *
 * Rules:
 *  - Must not be empty.
 *  - Must not exceed MFA_MAX_LENGTH.
 *
 * @param {string} answer
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateMfaAnswer(answer) {
  if (!isNonEmptyString(answer)) {
    return { valid: false, error: "Security answer is required." };
  }
  if (!isLengthInRange(answer, MFA_MIN_LENGTH, MFA_MAX_LENGTH)) {
    return { valid: false, error: `Answer must not exceed ${MFA_MAX_LENGTH} characters.` };
  }
  return { valid: true, error: null };
}

/**
 * Runs all login-form fields at once and returns a map of field → error.
 *
 * @param {{ username: string, password: string }} fields
 * @returns {Object.<string, string>} Empty object means all fields valid.
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
 * @returns {Object.<string, string>} Empty object means all fields valid.
 */
export function validateMfaForm({ answer }) {
  const errors = {};
  const answerResult = validateMfaAnswer(answer);
  if (!answerResult.valid) errors.answer = answerResult.error;
  return errors;
}