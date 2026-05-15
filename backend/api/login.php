<?php

/**
 * login.php — Authentication Handler
 *
 * Purpose:      Validates credentials, enforces lockout policy,
 *               and initializes session state for MFA continuation.
 *
 * Route:        POST index.php?route=login
 *
 * Request Body (JSON):
 *   - username  (string) required
 *   - password  (string) required
 *
 * Response JSON:
 *   On credential success (MFA pending):
 *     { success: true, mfa_required: true, question: string, question_index: int }
 *   On lockout:
 *     { success: false, locked: true, retry_after: int (seconds) }
 *   On failure:
 *     { success: false, message: string, attempts_left: int }
 *
 * Dependencies: config/db.php, bcryptjs equivalent = password_verify() in PHP
 *
 * Security:
 *   - Passwords verified with password_verify() against bcrypt hash
 *   - Lockout enforced DB-side (locked_until column) — not session-side
 *   - Raw input sanitized before DB query via prepared statements
 *   - Generic error messages prevent username enumeration
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/helpers.php';

// =============================================================
// 1. METHOD GUARD — Only POST accepted
// =============================================================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

// =============================================================
// 2. PARSE & VALIDATE REQUEST BODY
// =============================================================
$body = json_decode(file_get_contents('php://input'), true);

$username = trim($body['username'] ?? '');
$password  = $body['password'] ?? '';

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Username and password are required.']);
    exit;
}

// =============================================================
// 3. SECURITY QUESTIONS POOL
// Index stored in users.mfa_question — frontend maps index to text.
// Defined here so login response can return the question string.
// =============================================================
$securityQuestions = [
    0 => "What is your mother's maiden name?",
    1 => "What was the name of your first pet?",
    2 => "What city were you born in?",
    3 => "What is the name of your elementary school?",
    4 => "What was your childhood nickname?",
];

// =============================================================
// 4. FETCH USER RECORD
// =============================================================
$pdo  = getDB();
$stmt = $pdo->prepare(
    'SELECT id, username, password_hash, role,
            mfa_question, failed_attempts, locked_until
     FROM   users
     WHERE  username = :username
     LIMIT  1'
);
$stmt->execute([':username' => $username]);
$user = $stmt->fetch();

// =============================================================
// 5. LOCKOUT CHECK
// Checked before password verification to prevent timing attacks
// that could reveal whether the account exists.
// =============================================================
if ($user && $user['locked_until'] !== null) {
    $lockExpiry  = strtotime($user['locked_until']);
    $now         = time();
    $secondsLeft = $lockExpiry - $now;

    if ($secondsLeft > 0) {
        http_response_code(403);
        echo json_encode([
            'success'     => false,
            'locked'      => true,
            'retry_after' => (int) $secondsLeft,
            'message'     => "Account locked. Try again in {$secondsLeft} seconds.",
        ]);
        exit;
    }

    // Lock expired — reset counters
    $reset = $pdo->prepare(
        'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = :id'
    );
    $reset->execute([':id' => $user['id']]);
    $user['failed_attempts'] = 0;
    $user['locked_until']    = null;
}

// =============================================================
// 6. CREDENTIAL VERIFICATION
// password_verify() is timing-safe — mitigates timing attacks.
// Generic failure message used whether user exists or not.
// =============================================================
$MAX_ATTEMPTS = 3;
$LOCKOUT_SECS = 30;

$credentialsValid = $user && password_verify($password, $user['password_hash']);

if (!$credentialsValid) {
    // Log failed attempt only if user record exists
    if ($user) {
        $newAttempts = (int) $user['failed_attempts'] + 1;
        $attemptsLeft = $MAX_ATTEMPTS - $newAttempts;

        if ($newAttempts >= $MAX_ATTEMPTS) {
            // Lock the account
            $lockUntil = date('Y-m-d H:i:s', time() + $LOCKOUT_SECS);
            $lockStmt  = $pdo->prepare(
                'UPDATE users
                 SET    failed_attempts = :attempts,
                        locked_until   = :locked_until
                 WHERE  id = :id'
            );
            $lockStmt->execute([
                ':attempts'    => $newAttempts,
                ':locked_until' => $lockUntil,
                ':id'          => $user['id'],
            ]);

            // Log the lockout event
            logActivity($pdo, $user['id'], $user['username'], 'ACCOUNT_LOCKED',
                        "Locked after {$MAX_ATTEMPTS} failed attempts.");

            http_response_code(403);
            echo json_encode([
                'success'     => false,
                'locked'      => true,
                'retry_after' => $LOCKOUT_SECS,
                'message'     => "Too many failed attempts. Account locked for {$LOCKOUT_SECS} seconds.",
            ]);
            exit;
        }

        // Increment attempts without locking yet
        $incStmt = $pdo->prepare(
            'UPDATE users SET failed_attempts = :attempts WHERE id = :id'
        );
        $incStmt->execute([':attempts' => $newAttempts, ':id' => $user['id']]);

        logActivity($pdo, $user['id'], $user['username'], 'LOGIN_FAILED',
                    "Attempt {$newAttempts} of {$MAX_ATTEMPTS}.");

        http_response_code(401);
        echo json_encode([
            'success'       => false,
            'message'       => 'Invalid username or password.',
            'attempts_left' => max(0, $attemptsLeft),
        ]);
        exit;
    }

    // User does not exist — same response as wrong password (no enumeration)
    http_response_code(401);
    echo json_encode([
        'success'       => false,
        'message'       => 'Invalid username or password.',
        'attempts_left' => $MAX_ATTEMPTS,
    ]);
    exit;
}

// =============================================================
// 7. CREDENTIALS VALID — Store pending MFA state in session
// Do NOT set full auth session yet; MFA must pass first.
// =============================================================
session_regenerate_id(true); // Prevent session fixation

$_SESSION['mfa_pending']      = true;
$_SESSION['mfa_user_id']      = (int) $user['id'];
$_SESSION['mfa_username']     = $user['username'];
$_SESSION['mfa_role']         = $user['role'];
$_SESSION['mfa_question_idx'] = (int) $user['mfa_question'];

// Reset failed attempts on successful credential check
$pdo->prepare('UPDATE users SET failed_attempts = 0 WHERE id = :id')
    ->execute([':id' => $user['id']]);

logActivity($pdo, $user['id'], $user['username'], 'LOGIN_CREDENTIAL_OK',
            'Credentials verified. Awaiting MFA.');

$questionIndex = (int) $user['mfa_question'];
$questionText  = $securityQuestions[$questionIndex] ?? $securityQuestions[0];

echo json_encode([
    'success'        => true,
    'mfa_required'   => true,
    'question_index' => $questionIndex,
    'question'       => $questionText,
]);

// logActivity() is defined in helpers.php (required above)