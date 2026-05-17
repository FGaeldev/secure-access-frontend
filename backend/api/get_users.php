<?php
/**
 * get_users.php — Admin: List All Users
 *
 * Purpose:      Returns all user records for the admin user table.
 *               Excludes sensitive columns (password_hash, mfa_answer_hash).
 *
 * Route:        GET index.php?route=get_users
 *
 * Response JSON:
 *   On success: { success: true, users: [ { id, username, email, role,
 *                  created_at, last_login, is_locked } ] }
 *   On failure: { success: false, message: string }
 *
 * Dependencies: config/db.php
 *
 * Security:
 *   - Admin role enforced via session check.
 *   - Sensitive columns explicitly excluded from SELECT.
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
// 2. AUTH + ROLE GUARD
// Must be a fully authenticated admin — mfa_pending sessions rejected.
// =============================================================
if (empty($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
    exit;
}

if (($_SESSION['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden. Admins only.']);
    exit;
}

// =============================================================
// 3. FETCH ALL USERS
// Sensitive columns (password_hash, mfa_answer_hash) are never selected.
// =============================================================
$pdo = getDB();

$stmt = $pdo->query(
    'SELECT id, username, email, role, created_at, last_login,
            CASE WHEN locked_until > NOW() THEN 1 ELSE 0 END AS is_locked
     FROM   users
     ORDER  BY id ASC'
);

$users = $stmt->fetchAll();

echo json_encode([
    'success' => true,
    'users'   => $users,
]);