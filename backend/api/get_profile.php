<?php

/**
 * get_profile.php — User Profile Handler
 *
 * Purpose:      Returns profile data for the currently authenticated user.
 *               Accessible by both 'user' and 'admin' roles.
 *
 * Route:        GET index.php?route=get_profile
 *
 * Request Body: None — identity sourced from session.
 *
 * Response JSON:
 *   On success:
 *     {
 *       success:    true,
 *       profile: {
 *         id:         int,
 *         username:   string,
 *         email:      string,
 *         role:       string,
 *         created_at: string,
 *         last_login: string|null
 *       }
 *     }
 *   On unauthenticated:
 *     { success: false, message: string }
 *
 * Dependencies: config/db.php
 *
 * Security:
 *   - Session authentication required before any DB query
 *   - User ID sourced from server-side session, never from request body
 *   - Password hash and MFA answer hash explicitly excluded from SELECT
 */

require_once __DIR__ . '/../config/db.php';

// =============================================================
// 1. METHOD GUARD
// =============================================================
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

// =============================================================
// 2. AUTH GUARD
// Rejects requests without a fully authenticated session.
// mfa_pending sessions do NOT pass this check — MFA must complete first.
// =============================================================
if (empty($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Unauthorized. Please log in.',
    ]);
    exit;
}

// =============================================================
// 3. FETCH PROFILE
// User ID is always pulled from the session — never from GET/POST params.
// This prevents horizontal privilege escalation (user A reading user B's profile).
// =============================================================
$pdo = getDB();
$userId = (int) $_SESSION['user_id'];

$stmt = $pdo->prepare(
    'SELECT id, username, email, role, created_at, last_login,
    CASE WHEN locked_until > NOW() THEN 1 ELSE 0 END AS is_locked
    FROM users WHERE id = :id LIMIT 1'
);
$stmt->execute([':id' => $userId]);
$profile = $stmt->fetch();

if (!$profile) {
    // User deleted after session was created — edge case
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'User record not found. Please log in again.',
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'profile' => $profile,
]);