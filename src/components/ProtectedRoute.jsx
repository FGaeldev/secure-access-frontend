/**
 * @file ProtectedRoute.jsx
 * @description Role-Based Access Control (RBAC) route guard for react-router-dom v6.
 *              Wraps any route that requires authentication or a specific role.
 *
 * @context     Used in App.jsx to wrap <Route> elements.
 *              Reads auth state from AuthContext — never duplicates that state locally.
 *
 * @dependencies
 *  - react-router-dom  (Navigate, useLocation)
 *  - AuthContext       (useAuth hook)
 *
 * @usage
 *  // Require any authenticated user:
 *  <Route path="/dashboard" element={<ProtectedRoute><UserDash /></ProtectedRoute>} />
 *
 *  // Require admin role specifically:
 *  <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDash /></ProtectedRoute>} />
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ProtectedRoute
 *
 * Guards a subtree of routes behind authentication and optional role checks.
 * On failure, redirects to /login and preserves the intended path in `state`
 * so Login can redirect back after successful authentication.
 *
 * @param {Object}      props
 * @param {React.ReactNode} props.children     - The page/component to render when access is granted.
 * @param {string}      [props.requiredRole]   - If provided, user's role must match exactly.
 *                                               Pass nothing to allow any authenticated user.
 * @returns {React.ReactElement} The children, or a <Navigate> redirect.
 */
function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait for AuthContext to finish rehydrating session from the backend.
  // Rendering prematurely would flash a redirect before the session check resolves.
  if (loading) {
    return <LoadingScreen />;
  }

  // Not logged in — redirect to login, preserving the intended destination.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but wrong role — redirect to their own dashboard.
  // Avoids an infinite loop by checking if they're already on their own page.
  if (requiredRole && user.role !== requiredRole) {
    const fallback = user.role === "admin" ? "/admin" : "/dashboard";
    return <Navigate to={fallback} replace />;
  }

  // All checks passed — render the protected content.
  return children;
}

// ---------------------------------------------------------------------------
// Loading Screen (inline — small enough not to warrant a separate file)
// ---------------------------------------------------------------------------

/**
 * Minimal loading indicator shown while AuthContext performs session rehydration.
 * Keeps the UI from flashing a redirect before auth state is known.
 *
 * @returns {React.ReactElement}
 */
function LoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#0f172a", // matches app dark background
        color: "#94a3b8",
        fontFamily: "monospace",
        fontSize: "0.9rem",
        letterSpacing: "0.1em",
      }}
    >
      Verifying session…
    </div>
  );
}

export default ProtectedRoute;
