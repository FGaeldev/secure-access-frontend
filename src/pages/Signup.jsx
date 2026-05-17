/**
 * @file Signup.jsx
 * @description New user registration page. Collects username, email,
 *              password, and MFA security question + answer. On success,
 *              redirects to /login with a success notice.
 *
 * @context     Public route — already-authenticated users are redirected
 *              to their dashboard immediately on render.
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
 *  - validators.js — validateUsername, validatePassword, getPasswordStrength
 */

import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  validateUsername,
  validatePassword,
  getPasswordStrength,
} from "../utils/validators";
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

  // Redirect already-authenticated users away
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
    mfaQuestion: 0,
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
    setFieldErrors((prev) => ({ ...prev, [name]: null }));
    setSubmitError(null);
  }

  /**
   * Runs all client-side validation before the POST is sent.
   *
   * @returns {boolean} True if all fields pass.
   */
  function validateAll() {
    const errors = {};

    const usernameResult = validateUsername(fields.username);
    if (!usernameResult.valid) errors.username = usernameResult.error;

    const emailTrimmed = fields.email.trim();
    if (!emailTrimmed) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.email = "Enter a valid email address.";
    }

    const passwordResult = validatePassword(fields.password);
    if (!passwordResult.valid) errors.password = passwordResult.error;

    if (fields.confirm !== fields.password) {
      errors.confirm = "Passwords do not match.";
    }

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
          password: fields.password,
          mfa_question: Number(fields.mfaQuestion),
          mfa_answer: fields.mfaAnswer.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        navigate("/login", {
          replace: true,
          state: { flash: "Account created! You can now log in." },
        });
        return;
      }

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

        {/* Heading */}
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">
            Schaden's Cosplays
          </p>
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

        {/* Form card */}
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

          {/* Username */}
          <Field label="Username" error={fieldErrors.username}>
            <TextInput
              name="username"
              value={fields.username}
              onChange={handleChange}
              placeholder="e.g. jjimenez"
              autoComplete="username"
            />
          </Field>

          {/* Email */}
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

          {/* Password + strength meter */}
          <Field label="Password" error={fieldErrors.password}>
            <PasswordInput
              name="password"
              value={fields.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
            <PasswordStrengthMeter password={fields.password} />
          </Field>

          {/* Confirm password */}
          <Field label="Confirm Password" error={fieldErrors.confirm}>
            <PasswordInput
              name="confirm"
              value={fields.confirm}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </Field>

          <hr className="border-slate-700" />

          {/* Security question */}
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

          {/* MFA answer */}
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

          {/* Submit */}
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
// PasswordStrengthMeter
// ---------------------------------------------------------------------------

/**
 * PasswordStrengthMeter
 *
 * Displays a 5-segment bar, a strength label, and a requirements checklist.
 * Updates on every keystroke — purely presentational, no state of its own.
 * Returns null when password is empty so it doesn't render before the user
 * has typed anything.
 *
 * @param {Object} props
 * @param {string} props.password - Current raw password value from the form.
 * @returns {React.ReactElement|null}
 */
function PasswordStrengthMeter({ password }) {
  const { score, label, color } = getPasswordStrength(password);

  if (!password) return null;

  const requirements = [
    { met: password.length >= 8,           text: "At least 8 characters" },
    { met: /[A-Z]/.test(password),          text: "One uppercase letter" },
    { met: /[a-z]/.test(password),          text: "One lowercase letter" },
    { met: /[0-9]/.test(password),          text: "One number" },
    { met: /[^A-Za-z0-9]/.test(password),   text: "One special character" },
  ];

  return (
    <div className="space-y-2 mt-2">

      {/* Segmented bar — 5 segments, filled up to score */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((seg) => (
          <div
            key={seg}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 999,
              background: score >= seg ? color : "rgba(255,255,255,0.08)",
              transition: "background 0.25s ease",
            }}
          />
        ))}
      </div>

      {/* Strength label */}
      {label && (
        <p style={{ color, fontSize: 11, fontWeight: 500, letterSpacing: "0.03em" }}>
          {label}
        </p>
      )}

      {/* Requirements checklist */}
      <ul className="space-y-1 pt-1">
        {requirements.map((req) => (
          <li
            key={req.text}
            className="flex items-center gap-2 text-xs"
            style={{ color: req.met ? "#86efac" : "#64748b" }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              {req.met ? (
                <path
                  d="M2 6l3 3 5-5"
                  stroke="#86efac"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <circle cx="6" cy="6" r="4" stroke="#64748b" strokeWidth="1.5" />
              )}
            </svg>
            {req.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Micro-components
// ---------------------------------------------------------------------------

/**
 * Field — label + input + optional hint + optional error.
 *
 * @param {Object}          props
 * @param {string}          props.label
 * @param {React.ReactNode} props.children
 * @param {string|null}     [props.error]
 * @param {string|null}     [props.hint]
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
 * TextInput — standard text/email input.
 *
 * @param {Object}   props
 * @param {string}   props.name
 * @param {string}   props.value
 * @param {Function} props.onChange
 * @param {string}   [props.placeholder]
 * @param {string}   [props.autoComplete]
 * @param {string}   [props.type]
 */
function TextInput({ name, value, onChange, placeholder, autoComplete, type = "text" }) {
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
 * PasswordInput — password field.
 *
 * @param {Object}   props
 * @param {string}   props.name
 * @param {string}   props.value
 * @param {Function} props.onChange
 * @param {string}   [props.autoComplete]
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