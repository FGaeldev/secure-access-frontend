/**
 * @file Signup.jsx
 * @description New user registration page. Collects username, email,
 *              password, and MFA security question + answer. On success,
 *              redirects to /login with a success notice.
 *
 * @context     Public route — already-authenticated users are redirected
 *              to their dashboard immediately on render (same guard Login uses).
 *              Rendered by App.jsx at "/signup".
 *
 * @backend     POST ?route=register
 *              Body: { username, email, password, mfa_question, mfa_answer }
 *              Returns: { success: true } | { success: false, message: string }
 *
 * @dependencies
 *  - react
 *  - react-router-dom (useNavigate, Link)
 *  - AuthContext (useAuth) — for isAuthenticated redirect guard only
 *  - validators.js — validateUsername, validatePassword
 */

import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validateUsername, validatePassword } from "../utils/validators";
import API_BASE from "../config.js";

// ---------------------------------------------------------------------------
// Security questions — must stay in sync with login.php and register.php
// ---------------------------------------------------------------------------
const SECURITY_QUESTIONS = [
  { index: 0, text: "What is your mother's maiden name?" },
  { index: 1, text: "What was the name of your first pet?" },
  { index: 2, text: "What city were you born in?" },
  { index: 3, text: "What is the name of your elementary school?" },
  { index: 4, text: "What was your childhood nickname?" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Signup
 *
 * Multi-field registration form. Validates client-side before sending.
 * Server errors (duplicate username/email) are displayed inline.
 * On success, navigates to /login and passes a flash message via router state.
 *
 * @returns {React.ReactElement}
 */
function Signup() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Redirect already-authenticated users away — same pattern as Login.jsx
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // ── Form fields ────────────────────────────────────────────────────────────
  const [fields, setFields] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
    mfaQuestion: 0, // Index into SECURITY_QUESTIONS
    mfaAnswer: "",
  });

  // ── Per-field validation errors ────────────────────────────────────────────
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Submission state ───────────────────────────────────────────────────────
  const [submitError, setSubmitError] = useState(null);
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Generic field change handler.
   * Clears the per-field error for the changed field so the UI reacts live.
   */
  function handleChange(e) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    // Clear field-level error on change so user gets immediate feedback
    setFieldErrors((prev) => ({ ...prev, [name]: null }));
    setSubmitError(null);
  }

  /**
   * Runs all client-side validation before the POST is sent.
   * Populates fieldErrors and returns false if anything fails.
   *
   * @returns {boolean} True if all fields pass.
   */
  function validateAll() {
    const errors = {};

    // Username — reuse existing validator
    const usernameResult = validateUsername(fields.username);
    if (!usernameResult.valid) errors.username = usernameResult.error;

    // Email — basic format check
    const emailTrimmed = fields.email.trim();
    if (!emailTrimmed) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.email = "Enter a valid email address.";
    }

    // Password — reuse existing validator
    const passwordResult = validatePassword(fields.password);
    if (!passwordResult.valid) errors.password = passwordResult.error;

    // Confirm password
    if (fields.confirm !== fields.password) {
      errors.confirm = "Passwords do not match.";
    }

    // MFA answer
    if (!fields.mfaAnswer.trim()) {
      errors.mfaAnswer = "Security answer is required.";
    } else if (fields.mfaAnswer.trim().length > 128) {
      errors.mfaAnswer = "Answer must not exceed 128 characters.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Submits the registration form.
   * Validates first, then POSTs to the backend.
   * On success → navigate to /login with a flash message in router state.
   * On failure → display server error inline.
   */
  async function handleSubmit() {
    if (!validateAll()) return;

    setLoading(true);
    setSubmitError(null);

    try {
      const res = await fetch(`${API_BASE}?route=register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: fields.username.trim(),
          email: fields.email.trim(),
          password: fields.password, // Not trimmed — intentional
          mfa_question: Number(fields.mfaQuestion),
          mfa_answer: fields.mfaAnswer.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Pass a flash message to Login so it can show a success banner
        navigate("/login", {
          replace: true,
          state: { flash: "Account created! You can now log in." },
        });
        return;
      }

      // Server-side error (duplicate username, etc.)
      setSubmitError(data.message ?? "Registration failed. Please try again.");
    } catch {
      setSubmitError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* ── Heading ── */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Create an account</h1>
          <p className="text-slate-400 text-sm mt-1">
            Already have one?{" "}
            <Link
              to="/login"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* ── Form card ── */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 space-y-5">
          {/* Global submit error */}
          {submitError && (
            <div
              role="alert"
              className="bg-red-900/30 border border-red-700 text-red-300 text-sm px-4 py-3 rounded-lg"
            >
              {submitError}
            </div>
          )}

          {/* ── Username ── */}
          <Field label="Username" error={fieldErrors.username}>
            <TextInput
              name="username"
              value={fields.username}
              onChange={handleChange}
              placeholder="e.g. jjimenez"
              autoComplete="username"
            />
          </Field>

          {/* ── Email ── */}
          <Field label="Email" error={fieldErrors.email}>
            <TextInput
              name="email"
              value={fields.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              type="email"
            />
          </Field>

          {/* ── Password ── */}
          <Field
            label="Password"
            error={fieldErrors.password}
            hint="At least 8 characters"
          >
            <PasswordInput
              name="password"
              value={fields.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </Field>

          {/* ── Confirm password ── */}
          <Field label="Confirm Password" error={fieldErrors.confirm}>
            <PasswordInput
              name="confirm"
              value={fields.confirm}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </Field>

          <hr className="border-slate-700" />

          {/* ── Security question ── */}
          <Field label="Security Question" hint="Used as a second login factor">
            <select
              name="mfaQuestion"
              value={fields.mfaQuestion}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q.index} value={q.index}>
                  {q.text}
                </option>
              ))}
            </select>
          </Field>

          {/* ── MFA answer ── */}
          <Field
            label="Your Answer"
            error={fieldErrors.mfaAnswer}
            hint="Case-insensitive — stored securely"
          >
            <TextInput
              name="mfaAnswer"
              value={fields.mfaAnswer}
              onChange={handleChange}
              placeholder="Your answer"
              autoComplete="off"
            />
          </Field>

          {/* ── Submit ── */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-colors mt-2"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Micro-components
// ---------------------------------------------------------------------------

/**
 * Field
 *
 * Wraps a label, input, optional hint, and optional error message
 * around any input element passed as children.
 *
 * @param {Object}          props
 * @param {string}          props.label    - Field label text.
 * @param {React.ReactNode} props.children - The input element.
 * @param {string|null}     [props.error]  - Validation error to display.
 * @param {string|null}     [props.hint]   - Helper text shown below the label.
 * @returns {React.ReactElement}
 */
function Field({ label, children, error, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-slate-400 uppercase tracking-wide font-medium">
        {label}
        {hint && (
          <span className="ml-2 text-slate-600 normal-case font-normal">
            {hint}
          </span>
        )}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-red-400 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * TextInput — standard text/email input with consistent dark styling.
 *
 * @param {Object}   props
 * @param {string}   props.name
 * @param {string}   props.value
 * @param {Function} props.onChange
 * @param {string}   [props.placeholder]
 * @param {string}   [props.autoComplete]
 * @param {string}   [props.type]           - Defaults to "text".
 * @returns {React.ReactElement}
 */
function TextInput({
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  type = "text",
}) {
  return (
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-600"
    />
  );
}

/**
 * PasswordInput — password field using shared styling.
 *
 * @param {Object}   props
 * @param {string}   props.name
 * @param {string}   props.value
 * @param {Function} props.onChange
 * @param {string}   [props.autoComplete]
 * @returns {React.ReactElement}
 */
function PasswordInput({ name, value, onChange, autoComplete }) {
  return (
    <input
      type="password"
      name={name}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  );
}

export default Signup;
