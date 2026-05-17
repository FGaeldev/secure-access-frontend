<?php
/**
 * update_role.php — Admin: Change a User's Role
 *
 * Purpose:      Allows admins to promote or demote any user by changing
 *               their role field. Prevents an admin from demoting themselves.
 *
 * Route:        POST index.php?route=update_role
 *
 * Request Body JSON:
 *   { user_id: int, new_role: "admin"|"user" }
 *
 * Response JSON:
 *   On success: { success: true, message: string }
 *   On failure: { success: false, message: string }
 *
 * Dependencies: config/db.php, api/helpers.php
 *
 * Security:
 *   - Admin session required.
 *   - Self-demotion blocked (admin cannot remove their own admin role).
 *   - Role value validated against whitelist — no arbitrary strings accepted.
 *   - user_id cast to int, preventing injection.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/helpers.php';

// =============================================================
// 1. METHOD GUARD
// =============================================================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

// =============================================================
// 2. AUTH + ROLE GUARD
// =============================================================
if (empty($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
    exit;
}

if (($_SESSION['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden.']);
    exit;
}

// =============================================================
// 3. PARSE + VALIDATE INPUT
// =============================================================
$body = json_decode(file_get_contents('php://input'), true);

$targetUserId = isset($body['user_id']) ? (int) $body['user_id'] : 0;
$newRole      = $body['new_role'] ?? '';

// Whitelist — only these two roles exist in the system
$allowedRoles = ['admin', 'user'];

if ($targetUserId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid user ID.']);
    exit;
}

if (!in_array($newRole, $allowedRoles, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid role value.']);
    exit;
}

// =============================================================
// 4. SELF-DEMOTION GUARD
// Admins cannot remove their own admin role — prevents lockout.
// =============================================================
$actingAdminId = (int) $_SESSION['user_id'];

if ($targetUserId === $actingAdminId && $newRole !== 'admin') {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'You cannot remove your own admin role.',
    ]);
    exit;
}

// =============================================================
// 5. UPDATE ROLE
// =============================================================
$pdo = getDB();

// Verify target user exists before updating
$check = $pdo->prepare('SELECT id, username FROM users WHERE id = :id LIMIT 1');
$check->execute([':id' => $targetUserId]);
$targetUser = $check->fetch();

if (!$targetUser) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'User not found.']);
    exit;
}

$update = $pdo->prepare('UPDATE users SET role = :role WHERE id = :id');
$update->execute([':role' => $newRole, ':id' => $targetUserId]);

// Audit log — who changed whose role to what
logActivity(
    $pdo,
    $actingAdminId,
    $_SESSION['username'],
    'ROLE_CHANGED',
    "User '{$targetUser['username']}' (id:{$targetUserId}) → {$newRole}"
);

echo json_encode([
    'success' => true,
    'message' => "Role updated to '{$newRole}' for user '{$targetUser['username']}'.",
]);