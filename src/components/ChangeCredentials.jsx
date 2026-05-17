/**
 * @file ChangeCredentials.jsx
 * @description Reusable panel for changing password or MFA security answer.
 *              Consumed by both UserDash and AdminDash — any authenticated
 *              user can change their own credentials.
 *
 * @props  None — reads user identity from AuthContext (session-based).
 *
 * @backend POST ?route=update_credentials
 *          Body: { type: "password"|"mfa", ...fields }
 *
 * @dependencies react, axios, validators.js
 */

import React, { useState } from "react";
import axios from "axios";
import { getPasswordStrength } from "../utils/validators";
import API_BASE from "../config.js";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * ChangeCredentials
 *
 * Renders two collapsible sub-forms: one for password, one for MFA answer.
 * Only one is expanded at a time. Each submits independently.
 *
 * @returns {React.ReactElement}
 */
function ChangeCredentials() {
  const [activeForm, setActiveForm] = useState(null);

  function toggleForm(form) {
    setActiveForm((prev) => (prev === form ? null : form));
  }

  return (
    <section className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Security Settings
        </h2>
      </div>

      <div className="divide-y divide-slate-800">
        <CollapsibleForm
          label="Change Password"
          isOpen={activeForm === "password"}
          onToggle={() => toggleForm("password")}
        >
          <PasswordForm onSuccess={() => setActiveForm(null)} />
        </CollapsibleForm>

        <CollapsibleForm
          label="Change Security Answer"
          isOpen={activeForm === "mfa"}
          onToggle={() => toggleForm("mfa")}
        >
          <MfaAnswerForm onSuccess={() => setActiveForm(null)} />
        </CollapsibleForm>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleForm
// ---------------------------------------------------------------------------

/**
 * CollapsibleForm
 *
 * Toggle header + body. Keeps layout clean when both forms are present.
 *
 * @param {Object}           props
 * @param {string}           props.label
 * @param {boolean}          props.isOpen
 * @param {Function}         props.onToggle
 * @param {React.ReactNode}  props.children
 */
function CollapsibleForm({ label, isOpen, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-sm text-slate-300 hover:bg-slate-800/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium">{label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PasswordForm
// ---------------------------------------------------------------------------

/**
 * PasswordForm
 *
 * Three fields: current password, new password, confirm new password.
 * Renders a PasswordStrengthMeter below the new password field.
 * Client validates confirm match and complexity before sending.
 * Server verifies current password before updating.
 *
 * @param {Object}   props
 * @param {Function} props.onSuccess - Called after successful update.
 */
function PasswordForm({ onSuccess }) {
  const [fields, setFields] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    if (fields.next !== fields.confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (fields.next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(fields.next)) {
      setError("New password must contain at least one uppercase letter.");
      return;
    }
    if (!/[a-z]/.test(fields.next)) {
      setError("New password must contain at least one lowercase letter.");
      return;
    }
    if (!/[0-9]/.test(fields.next)) {
      setError("New password must contain at least one number.");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(fields.next)) {
      setError("New password must contain at least one special character.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE}?route=update_credentials`,
        { type: "password", current_password: fields.current, new_password: fields.next },
        { withCredentials: true }
      );

      setSuccess(response.data?.message ?? "Password updated.");
      setFields({ current: "", next: "", confirm: "" });
      setTimeout(onSuccess, 1500);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <PasswordInput
        label="Current Password"
        name="current"
        value={fields.current}
        onChange={handleChange}
      />

      {/* New password + strength meter */}
      <div className="space-y-1">
        <PasswordInput
          label="New Password"
          name="next"
          value={fields.next}
          onChange={handleChange}
        />
        <PasswordStrengthMeter password={fields.next} />
      </div>

      <PasswordInput
        label="Confirm New Password"
        name="confirm"
        value={fields.confirm}
        onChange={handleChange}
      />

      <FeedbackRow error={error} success={success} />

      <button
        onClick={handleSubmit}
        disabled={loading || !fields.current || !fields.next || !fields.confirm}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
      >
        {loading ? "Updating…" : "Update Password"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MfaAnswerForm
// ---------------------------------------------------------------------------

/**
 * MfaAnswerForm
 *
 * Two fields: current security answer, new security answer.
 * Server verifies current (normalized) before hashing and storing new.
 *
 * @param {Object}   props
 * @param {Function} props.onSuccess
 */
function MfaAnswerForm({ onSuccess }) {
  const [fields, setFields] = useState({ current: "", next: "" });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    if (!fields.next.trim()) {
      setError("New answer cannot be empty.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE}?route=update_credentials`,
        { type: "mfa", current_answer: fields.current, new_answer: fields.next },
        { withCredentials: true }
      );

      setSuccess(response.data?.message ?? "Security answer updated.");
      setFields({ current: "", next: "" });
      setTimeout(onSuccess, 1500);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to update answer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <p className="text-xs text-slate-500">
        Security question:{" "}
        <span className="text-slate-400">What is your mother's maiden name?</span>
      </p>

      <TextInput
        label="Current Answer"
        name="current"
        value={fields.current}
        onChange={handleChange}
        placeholder="Your current answer"
      />
      <TextInput
        label="New Answer"
        name="next"
        value={fields.next}
        onChange={handleChange}
        placeholder="Your new answer"
      />

      <FeedbackRow error={error} success={success} />

      <button
        onClick={handleSubmit}
        disabled={loading || !fields.current || !fields.next}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
      >
        {loading ? "Updating…" : "Update Answer"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PasswordStrengthMeter
// ---------------------------------------------------------------------------

/**
 * PasswordStrengthMeter
 *
 * 5-segment bar + label + requirements checklist.
 * Returns null when password is empty.
 *
 * @param {Object} props
 * @param {string} props.password
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
    <div className="space-y-2 mt-1">

      {/* Segmented bar */}
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
// Shared micro-components
// ---------------------------------------------------------------------------

/**
 * PasswordInput — labeled password field.
 *
 * @param {{ label: string, name: string, value: string, onChange: Function }} props
 */
function PasswordInput({ label, name, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-slate-500 uppercase tracking-wide">
        {label}
      </label>
      <input
        type="password"
        name={name}
        value={value}
        onChange={onChange}
        autoComplete="off"
        className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-600"
      />
    </div>
  );
}

/**
 * TextInput — labeled text field for MFA answers.
 *
 * @param {{ label: string, name: string, value: string, onChange: Function, placeholder?: string }} props
 */
function TextInput({ label, name, value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-slate-500 uppercase tracking-wide">
        {label}
      </label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-600"
      />
    </div>
  );
}

/**
 * FeedbackRow — error or success message below form fields.
 *
 * @param {{ error: string|null, success: string|null }} props
 */
function FeedbackRow({ error, success }) {
  if (error) {
    return (
      <p role="alert" className="text-red-400 text-xs">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="text-emerald-400 text-xs">
        {success}
      </p>
    );
  }
  return null;
}

export default ChangeCredentials;