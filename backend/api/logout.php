<?php

/**
 * logout.php — Session Termination Handler
 *
 * Purpose:      Destroys the authenticated session completely,
 *               clears the session cookie, and logs the event.
 *
 * Route:        POST index.php?route=logout
 *
 * Request Body: None required.
 *
 * Response JSON:
 *   { success: true, message: string }
 *
 * Dependencies: config/db.php, login.php (logActivity helper)
 *
 * Security:
 *   - Session data wiped before destroy (belt-and-suspenders)
 *   - Cookie explicitly expired to prevent client-side reuse
 *   - Logout logged before session is destroyed (data still accessible)
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/helpers.php'; // logActivity()

// =============================================================
// 1. METHOD GUARD
// =============================================================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

// =============================================================
// 2. LOG BEFORE DESTROY
// Capture identity now — session data gone after session_destroy().
// Only log if a real authenticated session exists.
// =============================================================
$userId   = $_SESSION['user_id']   ?? null;
$username = $_SESSION['username']  ?? 'unknown';

if ($userId !== null) {
    $pdo = getDB();
    logActivity(
        $pdo,
        (int) $userId,
        $username,
        'LOGOUT',
        'User logged out.'
    );
}

// =============================================================
// 3. DESTROY SESSION — Three-step wipe (PHP manual recommendation)
// Step 1: Clear all session variables from memory
// Step 2: Expire the session cookie on the client
// Step 3: Destroy the server-side session data
// =============================================================

// Step 1 — Wipe session data array
$_SESSION = [];

// Step 2 — Expire the session cookie immediately
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',                         // Empty value
        time() - 42000,             // Past expiry — forces browser to delete cookie
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

// Step 3 — Destroy server-side session record
session_destroy();

echo json_encode([
    'success' => true,
    'message' => 'Logged out successfully.',
]);