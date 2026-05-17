/**
 * @file UserDash.jsx
 * @description Dashboard for standard (non-admin) authenticated users.
 *              Displays the user's profile data fetched from the backend
 *              and provides a logout button.
 *
 * @context     Rendered by App.jsx at "/dashboard", wrapped in ProtectedRoute
 *              (no requiredRole — any authenticated user may access).
 *              Profile data comes from GET /api/get_profile.php via backend.
 *
 * @dependencies
 *  - react
 *  - AuthContext (useAuth) — for user identity and logout()
 *  - axios — for profile fetch (credentials: 'include')
 */

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import ChangeCredentials from "../components/ChangeCredentials";

// Backend base URL — keep in sync with vite.config.js proxy or .env
const API_BASE =
  "http://localhost/IAS/secure-access-frontend/backend/index.php";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UserDash
 *
 * Fetches the authenticated user's profile on mount and renders it.
 * Logout button delegates to AuthContext which handles session destruction
 * and state cleanup before redirecting to /login.
 *
 * @returns {React.ReactElement}
 */
function UserDash() {
  const { user, logout } = useAuth();

  // Profile returned from get_profile.php (may contain more fields than context user)
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  // Fetch full profile on mount — backend returns only safe columns
  useEffect(() => {
    let cancelled = false; // Prevent state update on unmounted component

    async function fetchProfile() {
      try {
        const response = await axios.get(`${API_BASE}?route=get_profile`, {
          withCredentials: true, // Required — session cookie auth
        });

        if (!cancelled) {
          setProfile(response.data?.profile ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setProfileError(
            err.response?.data?.error ?? "Failed to load profile.",
          );
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    fetchProfile();

    // Cleanup: mark cancelled so async callbacks don't update unmounted state
    return () => {
      cancelled = true;
    };
  }, []); // Empty dep array — fetch once on mount

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">
              Schaden's Cosplays
            </p>
            <h1 className="text-2xl font-bold text-white">My Profile</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Welcome back,{" "}
              <span className="text-indigo-400 font-medium">
                {user?.username ?? "..."}
              </span>
            </p>
          </div>
          <LogoutButton onLogout={logout} />
        </div>

        {/* Role badge */}
        <RoleBadge role={user?.role} />

        {/* Profile card */}
        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Account Details
          </h2>

          {profileLoading && (
            <p className="text-slate-500 text-sm">Loading profile...</p>
          )}

          {profileError && (
            <div
              role="alert"
              className="bg-red-900/30 border border-red-700 text-red-300 text-sm px-4 py-3 rounded-lg"
            >
              {profileError}
            </div>
          )}

          {profile && !profileLoading && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProfileField label="Username" value={profile.username} />
              <ProfileField label="Role" value={profile.role} />
              <ProfileField
                label="Account Status"
                value={profile.is_locked ? "Locked" : "Active"}
                valueClass={
                  profile.is_locked ? "text-red-400" : "text-emerald-400"
                }
              />
              <ProfileField
                label="Member Since"
                value={formatDate(profile.created_at)}
              />
            </dl>
          )}
        </section>

        {/* Security settings */}
        <ChangeCredentials />

        {/* Activity notice */}
        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Activity
          </h2>
          <p className="text-slate-500 text-sm">
            Your login history and activity logs are visible to administrators.
            Reach out to your admin if you need a copy of your records.
          </p>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

/**
 * LogoutButton
 *
 * Triggers the AuthContext logout() action on click.
 * Disabled while logout is processing (logout() itself handles the loading state).
 *
 * @param {Object}   props
 * @param {Function} props.onLogout - logout() from AuthContext.
 * @returns {React.ReactElement}
 */
function LogoutButton({ onLogout }) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await onLogout(); // AuthContext handles redirect after session destroy
    // No need to setLoading(false) — component will unmount on redirect
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
 * RoleBadge
 *
 * Displays the user's role as a colored pill.
 *
 * @param {Object}      props
 * @param {string|null} props.role - "admin", "user", or null while loading.
 * @returns {React.ReactElement}
 */
function RoleBadge({ role }) {
  const colorMap = {
    admin: "bg-violet-900/40 border-violet-700 text-violet-300",
    user: "bg-slate-800 border-slate-600 text-slate-400",
  };

  const classes = colorMap[role] ?? colorMap.user;

  return (
    <span
      className={`inline-block text-xs font-medium px-3 py-1 rounded-full border uppercase tracking-widest ${classes}`}
    >
      {role ?? "…"}
    </span>
  );
}

/**
 * ProfileField
 *
 * Renders a definition-list term/value pair for the profile grid.
 *
 * @param {Object}  props
 * @param {string}  props.label      - Field label (dt).
 * @param {string}  props.value      - Field value (dd).
 * @param {string}  [props.valueClass] - Optional override class for the value text.
 * @returns {React.ReactElement}
 */
function ProfileField({ label, value, valueClass = "text-white" }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-slate-500 uppercase tracking-wide">
        {label}
      </dt>
      <dd className={`text-sm font-medium ${valueClass}`}>{value ?? "—"}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Formats a MySQL datetime string into a human-readable local date.
 *
 * @param {string|null} dateString - MySQL datetime (e.g. "2024-01-15 10:30:00").
 * @returns {string} Formatted date string, or "—" if invalid/null.
 */
function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

export default UserDash;
