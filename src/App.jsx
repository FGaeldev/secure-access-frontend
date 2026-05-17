/**
 * @file App.jsx
 * @description Root application component. Defines all client-side routes
 *              using react-router-dom v6 <Routes> / <Route>.
 *
 *              Route protection strategy:
 *               - Public routes  → no wrapper
 *               - Auth-required  → <ProtectedRoute>  (any authenticated user)
 *               - Admin-only     → <ProtectedRoute requiredRole="admin">
 *
 *              ProtectedRoute redirects unauthenticated users to /login,
 *              preserving the intended destination in router state so Login
 *              can redirect back after successful auth.
 *
 * @context     Rendered by main.jsx, which wraps this in:
 *                <BrowserRouter>
 *                  <AuthProvider>
 *                    <App />
 *                  </AuthProvider>
 *                </BrowserRouter>
 *
 * @dependencies
 *  - react-router-dom (Routes, Route, Navigate)
 *  - All page components
 *  - ProtectedRoute
 */

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import UserDash from "./pages/UserDash";
import AdminDash from "./pages/AdminDash";
import ProtectedRoute from "./components/ProtectedRoute";
import Signup from "./pages/Signup";
import FloatingNav from "./components/FloatingNav";
import AnimatedBackground from "./components/AnimatedBackground";

/**
 * App
 *
 * Route map:
 *  /              → Home         (public)
 *  /login         → Login        (public — redirects away if already authed)
 *  /dashboard     → UserDash     (any authenticated user)
 *  /admin         → AdminDash    (admin role only)
 *  *              → /            (catch-all redirect)
 *
 * @returns {React.ReactElement}
 */
function App() {
  return (
    <>
      {/* Fixed behind everything — pages sit on top of it */}
      <div className="fixed inset-0 bg-slate-950 -z-10 overflow-hidden">
        <AnimatedBackground />
      </div>
      <FloatingNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} /> {/* ← new */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <UserDash />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDash />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
