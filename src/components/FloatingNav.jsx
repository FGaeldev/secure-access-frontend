/**
 * @file FloatingNav.jsx
 * @description Floating navigation bar rendered on every page via App.jsx.
 *              Links shown are derived from authentication state — users never
 *              see routes they cannot access.
 *
 *              Visibility rules:
 *                Unauthenticated → Home, Login, Sign Up
 *                user role       → Home, My Profile, Sign Out
 *                admin role      → Home, My Profile, Admin Panel, Sign Out
 *
 *              The nav is fixed to the top of the viewport, centered
 *              horizontally, and sits above all page content (z-50).
 *              It does not interfere with AnimatedBackground (z-0).
 *
 * @dependencies react, react-router-dom, AuthContext
 */

import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ---------------------------------------------------------------------------
// FloatingNav
// ---------------------------------------------------------------------------

/**
 * FloatingNav
 *
 * Reads auth state from context and renders only the routes the current
 * user is permitted to visit. Sign Out is a button, not a link — it calls
 * logout() and lets AuthContext handle the redirect.
 *
 * @returns {React.ReactElement}
 */
function FloatingNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await logout(); // AuthContext clears session and redirects to /login
  }

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "6px 8px",
        background: "rgba(2, 8, 23, 0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        borderRadius: "999px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
      }}
    >
      {/* Brand — always visible */}
      <span
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 600,
          color: "#818cf8",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          paddingLeft: "6px",
          paddingRight: "8px",
          borderRight: "1px solid rgba(99,102,241,0.2)",
          marginRight: "4px",
        }}
      >
        SC
      </span>

      {/* Always: Home */}
      <NavItem to="/">Home</NavItem>

      {/* Unauthenticated only */}
      {!user && (
        <>
          <NavItem to="/login">Sign In</NavItem>
          <NavItem to="/signup" accent>
            Sign Up
          </NavItem>
        </>
      )}

      {/* Authenticated: any role */}
      {user && <NavItem to="/dashboard">My Profile</NavItem>}

      {/* Authenticated: admin only */}
      {user?.role === "admin" && <NavItem to="/admin">Admin Panel</NavItem>}

      {/* Authenticated: sign out */}
      {user && <SignOutButton onClick={handleSignOut} loading={signingOut} />}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------

/**
 * NavItem
 *
 * Wrapper around react-router NavLink with pill styling.
 * Active route gets an indigo tint so users know where they are.
 *
 * @param {Object}          props
 * @param {string}          props.to      - Route path.
 * @param {React.ReactNode} props.children
 * @param {boolean}         [props.accent] - If true, renders as filled indigo pill (CTA style).
 * @returns {React.ReactElement}
 */
function NavItem({ to, children, accent }) {
  const baseStyle = {
    fontFamily: "system-ui, sans-serif",
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    padding: "5px 14px",
    borderRadius: "999px",
    transition: "background 0.15s, color 0.15s",
    display: "inline-block",
  };

  if (accent) {
    return (
      <NavLink
        to={to}
        style={baseStyle}
        className={({ isActive }) =>
          isActive ? "nav-accent nav-accent-active" : "nav-accent"
        }
      >
        {children}
        <style>{`
          .nav-accent {
            background: #4f46e5;
            color: #e0e7ff;
          }
          .nav-accent:hover {
            background: #6366f1;
          }
          .nav-accent-active {
            background: #4338ca;
          }
        `}</style>
      </NavLink>
    );
  }

  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...baseStyle,
        color: isActive ? "#a5b4fc" : "#94a3b8",
        background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
      })}
      onMouseEnter={(e) => {
        if (!e.currentTarget.classList.contains("active")) {
          e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          e.currentTarget.style.color = "#e2e8f0";
        }
      }}
      onMouseLeave={(e) => {
        // Let NavLink restore its own active styles via the style prop
        // Only reset if not the active route
        const isActive =
          e.currentTarget.getAttribute("aria-current") === "page";
        if (!isActive) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "#94a3b8";
        }
      }}
    >
      {children}
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// SignOutButton
// ---------------------------------------------------------------------------

/**
 * SignOutButton
 *
 * Styled to match NavItem but renders as a <button> since it triggers
 * an action rather than a navigation.
 *
 * @param {Object}   props
 * @param {Function} props.onClick  - Calls logout() from parent.
 * @param {boolean}  props.loading  - Disables and changes label while signing out.
 * @returns {React.ReactElement}
 */
function SignOutButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 500,
        color: loading ? "#64748b" : "#94a3b8",
        background: "transparent",
        border: "none",
        padding: "5px 14px",
        borderRadius: "999px",
        cursor: loading ? "not-allowed" : "pointer",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.background = "rgba(239,68,68,0.1)";
          e.currentTarget.style.color = "#fca5a5";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = loading ? "#64748b" : "#94a3b8";
      }}
    >
      {loading ? "Signing out..." : "Sign Out"}
    </button>
  );
}

export default FloatingNav;
