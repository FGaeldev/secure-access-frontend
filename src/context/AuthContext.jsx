/**
 * AuthContext.jsx — Global Authentication State
 *
 * Purpose:      Provides authentication state and actions to the entire
 *               component tree via React Context. Eliminates prop drilling
 *               for auth data across pages.
 *
 * Exports:
 *   - AuthProvider  : Wrap your app with this at the root level.
 *   - useAuth       : Hook — call inside any component to access auth state.
 *
 * State Shape:
 *   {
 *     user:        { username, role } | null   — null when not authenticated
 *     mfaState:    { required, question, questionIndex } | null
 *     loading:     boolean  — true during session rehydration on mount
 *     error:       string | null
 *     attemptsLeft: number  — remaining login attempts before lockout
 *     lockout:     { active: boolean, secondsLeft: number } | null
 *   }
 *
 * Dependencies: react, react-router-dom
 *               All fetch calls target PHP backend via BACKEND_URL constant.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';

// =============================================================
// CONSTANTS
// =============================================================

/**
 * Base URL for all PHP API calls.
 * Update this if your XAMPP vhost or folder structure differs.
 */
import API_BASE from '../config.js';
const BACKEND_URL = API_BASE;

const MAX_ATTEMPTS = 3; // Must match PHP login.php

// =============================================================
// CONTEXT CREATION
// =============================================================
const AuthContext = createContext(null);

// =============================================================
// PROVIDER COMPONENT
// =============================================================

/**
 * AuthProvider
 *
 * Wraps the application and exposes auth state + actions to all
 * descendant components via AuthContext.
 *
 * @param {React.ReactNode} children - Child components to wrap.
 * @returns {JSX.Element}
 */
export function AuthProvider({ children }) {
  const navigate = useNavigate();

  // ── Core auth state ──────────────────────────────────────
  const [user, setUser]               = useState(null);
  const [loading, setLoading]         = useState(true);  // session rehydration
  const [error, setError]             = useState(null);

  // ── MFA state ─────────────────────────────────────────────
  const [mfaState, setMfaState]       = useState(null);
  // mfaState shape: { question: string, questionIndex: number }

  // ── Lockout state ─────────────────────────────────────────
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [lockout, setLockout]           = useState(null);
  // lockout shape: { active: boolean, secondsLeft: number }

  // =============================================================
  // SESSION REHYDRATION
  // On mount, ping the backend to check if a valid PHP session
  // already exists (e.g. page refresh). Prevents flashing the
  // login page for already-authenticated users.
  // =============================================================
  useEffect(() => {
    const rehydrateSession = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}?route=get_profile`, {
          method: 'GET',
          credentials: 'include', // Send session cookie
        });
        const data = await res.json();

        if (data.success) {
          // Valid session exists — restore user state
          setUser({
            username: data.profile.username,
            role:     data.profile.role,
          });
        }
        // 401 means no session — user stays null, show login
      } catch {
        // Network error — fail silently, user will see login page
      } finally {
        // Always stop loading regardless of outcome
        setLoading(false);
      }
    };

    rehydrateSession();
  }, []); // Run once on mount only

  // =============================================================
  // LOCKOUT COUNTDOWN TIMER
  // When a lockout is active, decrement secondsLeft every second.
  // Clears itself when countdown reaches zero.
  // =============================================================
  useEffect(() => {
    if (!lockout?.active || lockout.secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setLockout(prev => {
        if (!prev || prev.secondsLeft <= 1) {
          clearInterval(timer);
          setAttemptsLeft(MAX_ATTEMPTS); // Reset attempts after lockout expires
          return null;                   // Clear lockout state
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    // Cleanup interval when component unmounts or lockout clears
    return () => clearInterval(timer);
  }, [lockout?.active]);

  // =============================================================
  // ACTION: login
  // Sends credentials to PHP. On success, stores MFA question
  // in state and waits for verifyMfa() to complete auth.
  // =============================================================

  /**
   * login()
   *
   * Submits username + password to the backend.
   * Does NOT complete authentication — triggers MFA step on success.
   *
   * @param {string} username
   * @param {string} password
   * @returns {Promise<void>}
   */
  const login = useCallback(async (username, password) => {
    setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}?route=login`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.locked) {
        // Account locked — start countdown timer
        setLockout({ active: true, secondsLeft: data.retry_after });
        setError(data.message);
        return;
      }

      if (data.success && data.mfa_required) {
        // Credentials valid — move to MFA step
        setMfaState({
          question:      data.question,
          questionIndex: data.question_index,
        });
        setAttemptsLeft(MAX_ATTEMPTS); // Reset display counter
        return;
      }

      // Credential failure
      setAttemptsLeft(data.attempts_left ?? MAX_ATTEMPTS);
      setError(data.message || 'Login failed.');
    } catch {
      setError('Network error. Check your connection.');
    }
  }, []);

  // =============================================================
  // ACTION: verifyMfa
  // Sends security question answer. On success, sets user state
  // and redirects to the appropriate dashboard.
  // =============================================================

  /**
   * verifyMfa()
   *
   * Submits the MFA answer to the backend.
   * Completes authentication and redirects on success.
   *
   * @param {string} answer - User's answer to the security question.
   * @returns {Promise<void>}
   */
  const verifyMfa = useCallback(async (answer) => {
    setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}?route=verify_mfa`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ answer }),
      });

      const data = await res.json();

      if (data.success) {
        // Full auth complete — set user and clear MFA state
        setUser({ username: data.username, role: data.role });
        setMfaState(null);

        // Redirect based on role
        navigate(data.role === 'admin' ? '/admin' : '/dashboard');
        return;
      }

      setError(data.message || 'Incorrect answer.');
    } catch {
      setError('Network error. Check your connection.');
    }
  }, [navigate]);

  // =============================================================
  // ACTION: logout
  // Calls PHP to destroy server-side session, then clears
  // all local state and redirects to home.
  // =============================================================

  /**
   * logout()
   *
   * Destroys the server-side session and resets all auth state.
   *
   * @returns {Promise<void>}
   */
  const logout = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}?route=logout`, {
        method:      'POST',
        credentials: 'include',
      });
    } catch {
      // Even if request fails, clear local state anyway
    } finally {
      setUser(null);
      setMfaState(null);
      setError(null);
      setLockout(null);
      setAttemptsLeft(MAX_ATTEMPTS);
      navigate('/');
    }
  }, [navigate]);

  // =============================================================
  // HELPER: clearError — lets UI dismiss error messages
  // =============================================================
  const clearError = useCallback(() => setError(null), []);

  // =============================================================
  // CONTEXT VALUE — everything consumers need
  // =============================================================
  const value = {
    // State
    user,
    mfaState,
    loading,
    error,
    attemptsLeft,
    lockout,

    // Derived
    isAuthenticated: !!user,
    isAdmin:         user?.role === 'admin',

    // Actions
    login,
    verifyMfa,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================
// HOOK: useAuth
// Consuming components call this instead of useContext directly.
// Throws if used outside AuthProvider — catches wiring mistakes early.
// =============================================================

/**
 * useAuth()
 *
 * Returns the current authentication context value.
 * Must be called inside a component wrapped by AuthProvider.
 *
 * @returns {object} Auth state and actions.
 * @throws  {Error}  If called outside AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used within an <AuthProvider>.');
  }
  return context;
}