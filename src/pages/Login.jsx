/**
 * @file Login.jsx
 * @description Login page handling three sequential UI states:
 *              1. Credential form  — username + password
 *              2. MFA form         — security-question answer
 *              3. Lockout banner   — countdown until account unlocks
 *
 *              All auth state (user, mfaState, lockout, attemptsLeft) lives in
 *              AuthContext. This page is purely presentational — it reads state
 *              and calls context actions; it owns no auth logic itself.
 *
 * @context     Rendered by App.jsx at the /login route (public, no guard).
 *              After successful login, redirects to the location the user
 *              originally tried to reach (via react-router state), or falls
 *              back to the role-appropriate dashboard.
 *
 * @dependencies
 *  - react, react-router-dom
 *  - AuthContext (useAuth)
 *  - validators.js (validateLoginForm, validateMfaForm)
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validateLoginForm, validateMfaForm } from "../utils/validators";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Login
 *
 * Renders the appropriate sub-form based on AuthContext state:
 *  - lockout    → LockoutBanner
 *  - mfaState   → MfaForm
 *  - default    → CredentialForm
 *
 * @returns {React.ReactElement}
 */
function Login() {
  const {
    user,
    mfaState,
    lockout,
    attemptsLeft,
    login,
    verifyMfa,
    loading,
    error,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const flashMessage = location.state?.flash ?? null;

  // Redirect authenticated users away from the login page immediately.
  // "from" is set by ProtectedRoute when it bounces an unauthenticated user.
  useEffect(() => {
    if (user) {
      const intended = location.state?.from?.pathname;
      const fallback = user.role === "admin" ? "/admin" : "/dashboard";
      navigate(intended || fallback, { replace: true });
    }
  }, [user, navigate, location]);

  // Determine which panel to show
  const showLockout = lockout?.active === true;
  const showMfa = !showLockout && !!mfaState;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Brand header — sits above the card */}
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">
            Schaden's Cosplays
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Member Portal
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {showMfa
              ? "Verify your identity to continue"
              : "Sign in to your account"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Flash message from signup redirect */}
          {flashMessage && (
            <div
              role="status"
              className="bg-emerald-900/30 border border-emerald-700 text-emerald-300 text-sm px-4 py-3 rounded-lg"
            >
              {flashMessage}
            </div>
          )}

          {/* Step indicator — only during MFA */}
          {showMfa && (
            <div className="text-center">
              <span className="inline-block bg-indigo-900/40 border border-indigo-700 text-indigo-300 text-xs px-3 py-1 rounded-full uppercase tracking-widest">
                Step 2 of 2 — Security Verification
              </span>
            </div>
          )}

          {/* Conditional panel */}
          {showLockout ? (
            <LockoutBanner lockout={lockout} />
          ) : showMfa ? (
            <MfaForm
              mfaState={mfaState}
              verifyMfa={verifyMfa}
              loading={loading}
              error={error}
            />
          ) : (
            <CredentialForm
              login={login}
              attemptsLeft={attemptsLeft}
              loading={loading}
              error={error}
            />
          )}
        </div>

        {/* Signup link — only on credential step */}
        {!showMfa && !showLockout && (
          <p className="text-center text-sm text-slate-500">
            New to Schaden's Cosplays?{" "}
            <Link
              to="/signup"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Create an account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: CredentialForm
// ---------------------------------------------------------------------------

/**
 * CredentialForm
 *
 * Handles username + password input. Runs client-side validation before
 * calling the context's login() action (which hits the backend).
 *
 * Displays remaining attempts when the server has recorded failed logins.
 *
 * @param {Object}   props
 * @param {Function} props.login          - login(username, password) from AuthContext.
 * @param {number|null} props.attemptsLeft - Remaining attempts before lockout, or null.
 * @param {boolean}  props.loading        - True while awaiting API response.
 * @returns {React.ReactElement}
 */
function CredentialForm({ login, attemptsLeft, loading, error }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();

    const validationErrors = validateLoginForm({ username, password });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    await login(username, password); // void — context sets error on failure
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {attemptsLeft !== null && attemptsLeft < 3 && (
        <AttemptsWarning attemptsLeft={attemptsLeft} />
      )}

      {error && <ErrorAlert message={error} />}

      <FormField
        id="username"
        label="Username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={errors.username}
        autoComplete="username"
        disabled={loading}
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        autoComplete="current-password"
        disabled={loading}
      />

      <SubmitButton loading={loading} label="Sign In" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: MfaForm
// ---------------------------------------------------------------------------

/**
 * MfaForm
 *
 * Displayed after credentials pass. Shows the user's security question
 * and collects the answer. Calls context's verifyMfa() action.
 *
 * @param {Object}   props
 * @param {Object}   props.mfaState   - { question: string } from AuthContext.
 * @param {Function} props.verifyMfa  - verifyMfa(answer) from AuthContext.
 * @param {boolean}  props.loading    - True while awaiting API response.
 * @returns {React.ReactElement}
 */
function MfaForm({ mfaState, verifyMfa, loading, error }) {
  const [answer, setAnswer] = useState("");
  const [errors, setErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();

    const validationErrors = validateMfaForm({ answer });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    await verifyMfa(answer); // void — context sets error state on failure
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
        <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">
          Security Question
        </p>
        <p className="text-white text-sm font-medium">
          {mfaState?.question ?? "Loading question..."}
        </p>
      </div>

      {error && <ErrorAlert message={error} />}

      <FormField
        id="mfa-answer"
        label="Your Answer"
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        error={errors.answer}
        autoComplete="off"
        disabled={loading}
      />

      <SubmitButton loading={loading} label="Verify" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: LockoutBanner
// ---------------------------------------------------------------------------

/**
 * LockoutBanner
 *
 * Shown when the account is locked. Reads the lockout expiry from context
 * and displays a live countdown (timer managed in AuthContext, not here —
 * this component simply formats and renders the value).
 *
 * @param {Object} props
 * @param {{ until: number, remaining: number }} props.lockout
 *   - until:     Unix timestamp (ms) when lockout expires.
 *   - remaining: Seconds remaining (decremented by AuthContext timer).
 * @returns {React.ReactElement}
 */
function LockoutBanner({ lockout }) {
  const minutes = Math.floor((lockout.secondsLeft ?? 0) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = ((lockout.secondsLeft ?? 0) % 60).toString().padStart(2, "0");
  return (
    <div className="space-y-4 text-center">
      {/* Lock icon */}
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-7 h-7 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7a4 4 0 00-8 0v4"
            />
            <rect x="2" y="11" width="20" height="11" rx="2" ry="2" />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="text-red-400 font-semibold text-lg">Account Locked</h2>
        <p className="text-slate-400 text-sm mt-1">
          Too many failed attempts. Try again in:
        </p>
      </div>

      {/* Countdown */}
      <div className="text-4xl font-mono font-bold text-white tracking-widest">
        {minutes}:{seconds}
      </div>

      <p className="text-slate-500 text-xs">
        Contact your administrator if you need immediate access.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable micro-components
// ---------------------------------------------------------------------------

/**
 * FormField
 *
 * Labeled input with optional error message below.
 * Applies error styling when an error string is passed.
 *
 * @param {Object}   props
 * @param {string}   props.id           - HTML id (also used for htmlFor).
 * @param {string}   props.label        - Visible label text.
 * @param {string}   props.type         - Input type (text, password, etc.).
 * @param {string}   props.value        - Controlled value.
 * @param {Function} props.onChange     - Change handler.
 * @param {string}   [props.error]      - Error message string; undefined = no error.
 * @param {string}   [props.autoComplete]
 * @param {boolean}  [props.disabled]
 * @returns {React.ReactElement}
 */
function FormField({
  id,
  label,
  type,
  value,
  onChange,
  error,
  autoComplete,
  disabled,
}) {
  const hasError = !!error;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-slate-300 font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        className={[
          "w-full rounded-lg px-4 py-2.5 text-sm bg-slate-800 border text-white",
          "placeholder-slate-500 outline-none transition-colors",
          "focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          hasError
            ? "border-red-500 focus:ring-red-500 focus:border-red-500"
            : "border-slate-600",
        ].join(" ")}
      />
      {hasError && (
        <p
          id={`${id}-error`}
          className="text-red-400 text-xs mt-1"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * SubmitButton
 *
 * Full-width submit button with loading state.
 *
 * @param {Object}  props
 * @param {boolean} props.loading - When true, shows spinner and disables button.
 * @param {string}  props.label  - Button label text.
 * @returns {React.ReactElement}
 */
function SubmitButton({ loading, label }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={[
        "w-full py-2.5 rounded-lg text-sm font-semibold transition-all",
        "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900",
      ].join(" ")}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Please wait…
        </span>
      ) : (
        label
      )}
    </button>
  );
}

/**
 * ErrorAlert
 *
 * Red alert box for server-returned error messages.
 *
 * @param {Object} props
 * @param {string} props.message - Error text to display.
 * @returns {React.ReactElement}
 */
function ErrorAlert({ message }) {
  return (
    <div
      role="alert"
      className="bg-red-900/30 border border-red-700 text-red-300 text-sm px-4 py-3 rounded-lg"
    >
      {message}
    </div>
  );
}

/**
 * AttemptsWarning
 *
 * Amber warning shown when the user has made failed attempts but is not yet locked.
 *
 * @param {Object} props
 * @param {number} props.attemptsLeft - How many attempts remain before lockout.
 * @returns {React.ReactElement}
 */
function AttemptsWarning({ attemptsLeft }) {
  return (
    <div
      role="alert"
      className="bg-amber-900/30 border border-amber-700 text-amber-300 text-sm px-4 py-3 rounded-lg"
    >
      {attemptsLeft === 1
        ? "Warning: 1 attempt remaining before lockout."
        : `Warning: ${attemptsLeft} attempts remaining before lockout.`}
    </div>
  );
}

export default Login;
