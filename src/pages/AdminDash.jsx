/**
 * @file AdminDash.jsx
 * @description Dashboard for admin-role users. Displays the full paginated
 *              activity log from the backend (get_logs.php) with action
 *              filtering. Also shows the admin's own profile summary.
 *
 * @context     Rendered by App.jsx at "/admin", wrapped in:
 *              <ProtectedRoute requiredRole="admin">
 *              Non-admin authenticated users are redirected to /dashboard.
 *
 * @dependencies
 *  - react
 *  - axios
 *  - AuthContext (useAuth) — for identity and logout()
 *
 * @backend     GET ?route=get_logs&page=N&limit=N&action=X
 *              Returns: { logs: [], total: N, page: N, limit: N }
 */

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_BASE =
  "http://localhost/IAS/secure-access-frontend/backend/index.php";

/** Rows per page — must match or be ≤ backend's max allowed limit. */
const PAGE_LIMIT = 10;

/** Action filter options — must match values stored in activity_logs.action. */
const ACTION_OPTIONS = [
  { value: "",                    label: "All Actions" },
  { value: "LOGIN_SUCCESS",       label: "Login Success" },
  { value: "LOGIN_FAILED",        label: "Login Failed" },
  { value: "LOGIN_CREDENTIAL_OK", label: "Credential OK" },
  { value: "MFA_FAILED",          label: "MFA Failed" },
  { value: "LOGOUT",              label: "Logout" },
  { value: "ACCOUNT_LOCKED",      label: "Account Locked" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AdminDash
 *
 * Renders two sections:
 *  1. Admin profile summary (username, role, status).
 *  2. Paginated activity log table with action filter.
 *
 * Log fetching is re-triggered whenever `page` or `actionFilter` changes.
 *
 * @returns {React.ReactElement}
 */
function AdminDash() {
  const { user, logout } = useAuth();

  // ── Log state ──────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);

  /**
   * Fetches one page of activity logs from the backend.
   * Wrapped in useCallback so it can be listed as a stable dependency.
   */
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);

    try {
      const params = {
        route: "get_logs",
        page,
        limit: PAGE_LIMIT,
        ...(actionFilter && { action: actionFilter }), // Omit key if empty
      };

      const response = await axios.get(API_BASE, {
        params,
        withCredentials: true, // Session cookie required for admin gate
      });

      const data = response.data;
      setLogs(data.logs ?? []);
      setTotalLogs(data.pagination?.total_rows ?? 0);
    } catch (err) {
      setLogsError(err.response?.data?.error ?? "Failed to load activity logs.");
    } finally {
      setLogsLoading(false);
    }
  }, [page, actionFilter]);

  // Re-fetch whenever page or filter changes
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 whenever the filter changes (avoids showing page 3 of 1)
  function handleFilterChange(newFilter) {
    setActionFilter(newFilter);
    setPage(1);
  }

  const totalPages = Math.ceil(totalLogs / PAGE_LIMIT);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Logged in as{" "}
              <span className="text-violet-400 font-medium">
                {user?.username ?? "…"}
              </span>
            </p>
          </div>
          <LogoutButton onLogout={logout} />
        </div>

        {/* ── Admin profile strip ── */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 flex flex-wrap gap-6">
          <ProfileChip label="Role" value={user?.role} highlight />
          <ProfileChip label="Status" value="Active" />
        </div>

        {/* ── Activity Logs ── */}
        <section className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
          {/* Section header */}
          <div className="px-6 py-4 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Activity Logs
              {totalLogs > 0 && (
                <span className="ml-2 text-slate-500 font-normal normal-case">
                  ({totalLogs} total)
                </span>
              )}
            </h2>

            {/* Action filter */}
            <select
              value={actionFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Filter by action"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Log table */}
          <div className="overflow-x-auto">
            {logsLoading && (
              <p className="text-slate-500 text-sm text-center py-8">
                Loading logs…
              </p>
            )}

            {logsError && !logsLoading && (
              <div
                role="alert"
                className="mx-6 my-4 bg-red-900/30 border border-red-700 text-red-300 text-sm px-4 py-3 rounded-lg"
              >
                {logsError}
              </div>
            )}

            {!logsLoading && !logsError && logs.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-8">
                No logs found for the selected filter.
              </p>
            )}

            {!logsLoading && logs.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700">
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Action</th>
                    <th className="px-6 py-3 font-medium">IP Address</th>
                    <th className="px-6 py-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <PaginationButton
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  label="← Previous"
                />
                <PaginationButton
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  label="Next →"
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * LogRow
 *
 * Renders one row in the activity log table.
 * Applies color coding to the action column for quick scanning.
 *
 * @param {Object} props
 * @param {Object} props.log - Log entry from backend.
 * @param {number} props.log.id
 * @param {string} props.log.username
 * @param {string} props.log.action
 * @param {string} props.log.ip_address
 * @param {string} props.log.created_at
 * @returns {React.ReactElement}
 */
function LogRow({ log }) {
  return (
    <tr className="hover:bg-slate-800/50 transition-colors">
      <td className="px-6 py-3 text-slate-300 font-medium">
        {log.username ?? "—"}
      </td>
      <td className="px-6 py-3">
        <ActionBadge action={log.action} />
      </td>
      <td className="px-6 py-3 text-slate-400 font-mono text-xs">
        {log.ip_address ?? "—"}
      </td>
      <td className="px-6 py-3 text-slate-500 text-xs">
        {formatDateTime(log.created_at)}
      </td>
    </tr>
  );
}

/**
 * ActionBadge
 *
 * Color-coded pill for an action type.
 * Maps known actions to semantic colors; unknown actions render neutral.
 *
 * @param {Object} props
 * @param {string} props.action - Action string from activity_logs table.
 * @returns {React.ReactElement}
 */
function ActionBadge({ action }) {
  const colorMap = {
    login_success: "bg-emerald-900/40 text-emerald-400 border-emerald-700",
    mfa_success: "bg-emerald-900/40 text-emerald-400 border-emerald-700",
    logout: "bg-slate-700 text-slate-400 border-slate-600",
    login_failed: "bg-red-900/40 text-red-400 border-red-700",
    mfa_failed: "bg-red-900/40 text-red-400 border-red-700",
    account_locked: "bg-amber-900/40 text-amber-400 border-amber-700",
  };

  const classes =
    colorMap[action] ?? "bg-slate-800 text-slate-400 border-slate-600";

  return (
    <span
      className={`inline-block text-xs px-2.5 py-0.5 rounded-full border ${classes}`}
    >
      {action ?? "unknown"}
    </span>
  );
}

/**
 * ProfileChip
 *
 * Small label/value chip for the admin profile strip.
 *
 * @param {Object}  props
 * @param {string}  props.label     - Field label.
 * @param {string}  props.value     - Field value.
 * @param {boolean} [props.highlight] - If true, uses accent color for value.
 * @returns {React.ReactElement}
 */
function ProfileChip({ label, value, highlight }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p
        className={`text-sm font-semibold ${
          highlight ? "text-violet-400" : "text-white"
        }`}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

/**
 * LogoutButton — identical to UserDash version; consider extracting to
 * src/components/LogoutButton.jsx if the project grows further.
 *
 * @param {Object}   props
 * @param {Function} props.onLogout
 * @returns {React.ReactElement}
 */
function LogoutButton({ onLogout }) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await onLogout();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Signing out…" : "Sign Out"}
    </button>
  );
}

/**
 * PaginationButton
 *
 * @param {Object}   props
 * @param {Function} props.onClick
 * @param {boolean}  props.disabled
 * @param {string}   props.label
 * @returns {React.ReactElement}
 */
function PaginationButton({ onClick, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 border border-slate-600 px-3 py-1.5 rounded-lg transition-colors"
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Formats a MySQL datetime string to a locale-aware date + time string.
 *
 * @param {string|null} dateString
 * @returns {string}
 */
function formatDateTime(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default AdminDash;
