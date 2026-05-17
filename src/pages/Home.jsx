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
      {/* Brand tag */}
      <span className="mb-6 inline-block bg-indigo-900/40 border border-indigo-700 text-indigo-300 text-xs px-4 py-1.5 rounded-full uppercase tracking-widest">
        Schaden's Cosplays — Member Portal
      </span>

      {/* Headline */}
      <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight max-w-2xl">
        Your Stage. <span className="text-indigo-400">Your Identity.</span>
      </h1>

      {/* Subheading */}
      <p className="mt-4 text-slate-400 text-base max-w-md leading-relaxed">
        Access your cosplay profile, manage your account, and stay connected
        with the Schaden's Cosplays community — securely.
      </p>

      {/* CTA buttons */}
      <div className="mt-10 flex items-center gap-3">
        <Link
          to={ctaHref}
          className="inline-block bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm px-7 py-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          {ctaLabel}
        </Link>

        {!user && (
          <Link
            to="/signup"
            className="inline-block bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 font-semibold text-sm px-7 py-3 rounded-lg border border-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Sign Up
          </Link>
        )}
      </div>

      {/* Feature pills */}
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        {[
          "Secure Login",
          "Two-Factor Verification",
          "Member Profiles",
          "Activity History",
          "Role-Based Access",
        ].map((feature) => (
          <span
            key={feature}
            className="bg-slate-800 border border-slate-700 text-slate-400 text-xs px-3 py-1.5 rounded-full"
          >
            {feature}
          </span>
        ))}
      </div>

      {/* Footer credit */}
      <p className="mt-16 text-slate-700 text-xs tracking-wide">
        Schaden's Cosplays &mdash; All rights reserved
      </p>
    </main>
  );
}

export default Home;
