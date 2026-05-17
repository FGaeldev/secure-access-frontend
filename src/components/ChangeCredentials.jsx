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
 * @dependencies react, axios, AuthContext
 */

import React, { useState } from "react";
import axios from "axios";

const API_BASE =
  "http://localhost/IAS/secure-access-frontend/backend/index.php";

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
  // Which sub-form is open: null | "password" | "mfa"
  const [activeForm, setActiveForm] = useState(null);

  function toggleForm(form) {
    setActiveForm((prev) => (prev === form ? null : form));
  }

  return (
    <section className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Security Settings
        </h2>
      </div>

      <div className="divide-y divide-slate-800">
        {/* ── Password change ── */}
        <CollapsibleForm
          label="Change Password"
          isOpen={activeForm === "password"}
          onToggle={() => toggleForm("password")}
        >
          <PasswordForm onSuccess={() => setActiveForm(null)} />
        </CollapsibleForm>

        {/* ── MFA answer change ── */}
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
// CollapsibleForm — accordion wrapper
// ---------------------------------------------------------------------------

/**
 * CollapsibleForm
 *
 * Toggle header + animated body. Keeps layout clean when both forms present.
 *
 * @param {Object}           props
 * @param {string}           props.label    - Button label shown in header.
 * @param {boolean}          props.isOpen   - Controls expanded state.
 * @param {Function}         props.onToggle - Called when header is clicked.
 * @param {React.ReactNode}  props.children - Form content when expanded.
 * @returns {React.ReactElement}
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
        {/* Chevron rotates when open */}
        <span
          className={`text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          ▾
        </span>
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
 * Client validates confirm match before sending.
 * Server verifies current password before updating.
 *
 * @param {Object}   props
 * @param {Function} props.onSuccess - Called after successful update (collapses form).
 * @returns {React.ReactElement}
 */
function PasswordForm({ onSuccess }) {
  const [fields, setFields] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    // Clear feedback on any edit
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    // Client-side confirm match
    if (fields.next !== fields.confirm) {
      setError("New passwords do not match.");
      return;
    }

    if (fields.next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE}?route=update_credentials`,
        {
          type: "password",
          current_password: fields.current,
          new_password: fields.next,
        },
        { withCredentials: true },
      );

      setSuccess(response.data?.message ?? "Password updated.");
      setFields({ current: "", next: "", confirm: "" });
      // Collapse form after a brief success display
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
      <PasswordInput
        label="New Password"
        name="next"
        value={fields.next}
        onChange={handleChange}
      />
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
 * @param {Function} props.onSuccess - Called after successful update.
 * @returns {React.ReactElement}
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
        {
          type: "mfa",
          current_answer: fields.current,
          new_answer: fields.next,
        },
        { withCredentials: true },
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
      {/* Remind user of the question so they know what they're answering */}
      <p className="text-xs text-slate-500">
        Security question:{" "}
        <span className="text-slate-400">
          What is your mother's maiden name?
        </span>
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
// Shared micro-components
// ---------------------------------------------------------------------------

/**
 * PasswordInput — labeled password field with consistent styling.
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
 * TextInput — labeled text field (for MFA answers).
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
 * FeedbackRow — shows error or success message below form fields.
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
