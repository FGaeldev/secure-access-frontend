<?php
/**
 * update_credentials.php — Change Password or MFA Answer
 *
 * Purpose:      Allows any authenticated user to update their own password
 *               or MFA security answer. Each operation requires the current
 *               credential for verification before accepting the new value.
 *
 * Route:        POST index.php?route=update_credentials
 *
 * Request Body JSON — one of two shapes:
 *
 *   Change password:
 *     { type: "password", current_password: string, new_password: string }
 *
 *   Change MFA answer:
 *     { type: "mfa", current_answer: string, new_answer: string }
 *
 * Response JSON:
 *   On success: { success: true, message: string }
 *   On failure: { success: false, message: string }
 *
 * Dependencies: config/db.php, api/helpers.php
 *
 * Security:
 *   - Authenticated session required (any role).
 *   - User ID always sourced from session — users cannot target other accounts.
 *   - Current credential verified via password_verify() before any update.
 *   - New password hashed with PASSWORD_BCRYPT before storage.
 *   - New MFA answer lowercased + trimmed then hashed — matches verify_mfa.php logic.
 *   - Minimum length enforced: password ≥ 8 chars, answer ≥ 1 char.
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
// 2. AUTH GUARD
// =============================================================
if (empty($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
    exit;
}

// =============================================================
// 3. PARSE BODY
// =============================================================
$body = json_decode(file_get_contents('php://input'), true);
$type = $body['type'] ?? '';

$pdo    = getDB();
$userId = (int) $_SESSION['user_id'];

// =============================================================
// 4. DISPATCH BY TYPE
// =============================================================

if ($type === 'password') {
    // ── Change Password ──────────────────────────────────────

    $currentPassword = $body['current_password'] ?? '';
    $newPassword     = $body['new_password']     ?? '';

    // Basic length guards (mirrors validators.js rules)
    if (strlen($newPassword) < 8) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'New password must be at least 8 characters.']);
        exit;
    }

    if (strlen($newPassword) > 255) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'New password is too long.']);
        exit;
    }

    // Fetch current hash to verify
    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $userId]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Current password is incorrect.']);
        exit;
    }

    // Prevent re-using the same password
    if (password_verify($newPassword, $row['password_hash'])) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'New password must differ from the current one.']);
        exit;
    }

    // Hash and store — PASSWORD_BCRYPT cost 12 matches what login.php uses
    $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);

    $update = $pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
    $update->execute([':hash' => $newHash, ':id' => $userId]);

    logActivity($pdo, $userId, $_SESSION['username'], 'PASSWORD_CHANGED', null);

    echo json_encode(['success' => true, 'message' => 'Password updated successfully.']);

} elseif ($type === 'mfa') {
    // ── Change MFA Answer ─────────────────────────────────────

    $currentAnswer = $body['current_answer'] ?? '';
    $newAnswer     = $body['new_answer']     ?? '';

    if (strlen(trim($newAnswer)) < 1) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'New answer cannot be empty.']);
        exit;
    }

    if (strlen($newAnswer) > 128) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'New answer is too long.']);
        exit;
    }

    // Fetch current MFA hash — column name must match your schema
    $stmt = $pdo->prepare('SELECT mfa_answer_hash FROM users WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $userId]);
    $row = $stmt->fetch();

    // Normalize current answer same way verify_mfa.php does: lowercase + trim
    $normalizedCurrent = strtolower(trim($currentAnswer));

    if (!$row || !password_verify($normalizedCurrent, $row['mfa_answer_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Current security answer is incorrect.']);
        exit;
    }

    // Normalize and hash the new answer — same normalization as above
    $normalizedNew = strtolower(trim($newAnswer));
    $newHash       = password_hash($normalizedNew, PASSWORD_BCRYPT, ['cost' => 12]);

    $update = $pdo->prepare('UPDATE users SET mfa_answer_hash = :hash WHERE id = :id');
    $update->execute([':hash' => $newHash, ':id' => $userId]);

    logActivity($pdo, $userId, $_SESSION['username'], 'MFA_ANSWER_CHANGED', null);

    echo json_encode(['success' => true, 'message' => 'Security answer updated successfully.']);

} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => "Unknown type '{$type}'. Use 'password' or 'mfa'."]);
}