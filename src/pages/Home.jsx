/**
 * @file Home.jsx
 * @description Public landing page — accessible without authentication.
 *              Serves as the root route ("/"). Presents the system name and
 *              a call-to-action that routes authenticated users to their
 *              dashboard or unauthenticated users to login.
 *
 * @context     Rendered by App.jsx at "/" — no ProtectedRoute wrapper.
 *              Reads auth state only to decide CTA destination; does NOT
 *              redirect automatically (users may want to view this page first).
 *
 * @dependencies
 *  - react-router-dom (Link)
 *  - AuthContext (useAuth)
 */

import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Home
 *
 * Public landing page. The CTA link adapts based on auth state:
 *  - Authenticated user  → links to their role-appropriate dashboard.
 *  - Unauthenticated     → links to /login.
 *
 * @returns {React.ReactElement}
 */
function Home() {
  const { user } = useAuth();

  // Determine where the CTA should point
  let ctaHref = "/login";
  let ctaLabel = "Sign In";

  if (user) {
    ctaHref = user.role === "admin" ? "/admin" : "/dashboard";
    ctaLabel = "Go to Dashboard";
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
      {/* System badge */}
      <span className="mb-6 inline-block bg-indigo-900/40 border border-indigo-700 text-indigo-300 text-xs px-4 py-1.5 rounded-full uppercase tracking-widest">
        Integrated Access System
      </span>

      {/* Headline */}
      <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight max-w-xl">
        Secure Access,{" "}
        <span className="text-indigo-400">Role-Aware</span> Control
      </h1>

      {/* Subheading */}
      <p className="mt-4 text-slate-400 text-base max-w-md leading-relaxed">
        A controlled authentication environment with multi-factor verification,
        activity logging, and role-based dashboards.
      </p>

      {/* CTA */}
      <Link
        to={ctaHref}
        className="mt-10 inline-block bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm px-7 py-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950"
      >
        {ctaLabel}
      </Link>

      {/* Feature pills */}
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        {[
          "bcrypt Authentication",
          "3-Attempt Lockout",
          "MFA Security Questions",
          "Activity Logging",
          "RBAC Dashboards",
        ].map((feature) => (
          <span
            key={feature}
            className="bg-slate-800 border border-slate-700 text-slate-400 text-xs px-3 py-1.5 rounded-full"
          >
            {feature}
          </span>
        ))}
      </div>
    </main>
  );
}

export default Home;
