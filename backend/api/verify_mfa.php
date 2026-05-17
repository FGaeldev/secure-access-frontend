<?php

/**
 * verify_mfa.php — Multi-Factor Authentication Handler
 *
 * Purpose:      Validates the user's security question answer.
 *               Completes authentication by upgrading the session
 *               from MFA-pending to fully authenticated.
 *
 * Route:        POST index.php?route=verify_mfa
 *
 * Request Body (JSON):
 *   - answer  (string) required — user's answer to their security question
 *
 * Response JSON:
 *   On success:
 *     { success: true, role: string, username: string }
 *   On wrong answer:
 *     { success: false, message: string }
 *   On no pending MFA session:
 *     { success: false, message: string }
 *
 * Dependencies: config/db.php, login.php (logActivity helper)
 *
 * Security:
 *   - Answer compared via password_verify() against bcrypt hash
 *   - Answer normalized to lowercase before comparison (case-insensitive)
 *   - Session only upgraded after successful answer — not on credential check
 *   - MFA session keys cleared after use to prevent replay
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
// 2. SESSION GUARD — Must have a pending MFA session
// Prevents direct calls to this endpoint without going through login first.
// =============================================================
if (empty($_SESSION['mfa_pending']) || $_SESSION['mfa_pending'] !== true) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'No active login session. Please log in first.',
    ]);
    exit;
}

// =============================================================
// 3. PARSE REQUEST BODY
// =============================================================
$body   = json_decode(file_get_contents('php://input'), true);
$answer = trim($body['answer'] ?? '');

if ($answer === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Answer is required.']);
    exit;
}

// =============================================================
// 4. FETCH MFA ANSWER HASH FROM DB
// Uses the user ID stored during credential verification in login.php.
// =============================================================
$pdo    = getDB();
$userId = (int) $_SESSION['mfa_user_id'];

$stmt = $pdo->prepare(
    'SELECT mfa_answer_hash FROM users WHERE id = :id LIMIT 1'
);
$stmt->execute([':id' => $userId]);
$row = $stmt->fetch();

if (!$row) {
    // User record disappeared between login and MFA — edge case
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'User record not found. Please log in again.']);
    exit;
}

// =============================================================
// 5. VERIFY ANSWER
// Normalize to lowercase before comparison — answers are
// stored as bcrypt hash of the lowercased string.
// =============================================================
$normalizedAnswer = strtolower($answer);
$answerValid      = password_verify($normalizedAnswer, $row['mfa_answer_hash']);

if (!$answerValid) {
    logActivity(
        $pdo,
        $userId,
        $_SESSION['mfa_username'],
        'MFA_FAILED',
        'Incorrect security question answer.'
    );

    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Incorrect answer. Please try again.',
    ]);
    exit;
}

// =============================================================
// 6. MFA PASSED — Upgrade session to fully authenticated
// Regenerate session ID again to prevent fixation after full auth.
// =============================================================
// session_regenerate_id disabled on shared hosting — cookie does not
// survive the ID change between login and MFA on this environment.
// Re-enable if migrating to a VPS with sticky sessions or Redis.

// Promote pending MFA data to authenticated session keys
$_SESSION['authenticated'] = true;
$_SESSION['user_id']       = $userId;
$_SESSION['username']      = $_SESSION['mfa_username'];
$_SESSION['role']          = $_SESSION['mfa_role'];

// Clear MFA-pending keys — they are no longer needed
unset(
    $_SESSION['mfa_pending'],
    $_SESSION['mfa_user_id'],
    $_SESSION['mfa_username'],
    $_SESSION['mfa_role'],
    $_SESSION['mfa_question_idx']
);

// Update last_login timestamp
$pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = :id')
    ->execute([':id' => $userId]);

logActivity(
    $pdo,
    $userId,
    $_SESSION['username'],
    'LOGIN_SUCCESS',
    'MFA verified. Session authenticated.'
);

echo json_encode([
    'success'  => true,
    'role'     => $_SESSION['role'],
    'username' => $_SESSION['username'],
]);