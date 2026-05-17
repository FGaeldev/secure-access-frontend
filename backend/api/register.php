<?php
/**
 * register.php — New User Registration Handler
 *
 * Purpose:      Creates a new user account with bcrypt-hashed password
 *               and bcrypt-hashed MFA answer. All new accounts receive
 *               the 'user' role — admin promotion is done post-registration
 *               via the admin user table.
 *
 * Route:        POST index.php?route=register
 *
 * Request Body JSON:
 *   {
 *     username:        string,   // 3–30 chars, alphanumeric/underscore/hyphen only
 *     email:           string,   // valid email, max 255 chars
 *     password:        string,   // min 8 chars, max 255 chars
 *     mfa_question:    int,      // index into the security questions pool (0–4)
 *     mfa_answer:      string    // 1–128 chars, stored normalized + hashed
 *   }
 *
 * Response JSON:
 *   On success: { success: true, message: string }
 *   On failure: { success: false, message: string }
 *
 * Dependencies: config/db.php, api/helpers.php
 *
 * Security:
 *   - All inputs validated server-side — never trust the client.
 *   - Username uniqueness enforced at DB level (UNIQUE constraint) and
 *     also checked explicitly to return a friendly error.
 *   - Email uniqueness enforced the same way.
 *   - Password hashed with PASSWORD_BCRYPT cost 12 — matches login.php.
 *   - MFA answer normalized (trim + strtolower) then hashed — matches
 *     verify_mfa.php so login works immediately after registration.
 *   - Authenticated users are blocked from registering again (redirect
 *     them on the frontend; this guard is a backend safety net).
 *   - Role is hardcoded to 'user' — never read from request body.
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
// 2. BLOCK ALREADY-AUTHENTICATED USERS
// If a logged-in user somehow hits this route, reject it.
// The frontend should redirect them away from /signup entirely.
// =============================================================
if (!empty($_SESSION['authenticated']) && $_SESSION['authenticated'] === true) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Already authenticated.']);
    exit;
}

// =============================================================
// 3. SECURITY QUESTIONS POOL
// Must stay in sync with login.php — same array, same indices.
// =============================================================
$securityQuestions = [
    0 => "What is your mother's maiden name?",
    1 => "What was the name of your first pet?",
    2 => "What city were you born in?",
    3 => "What is the name of your elementary school?",
    4 => "What was your childhood nickname?",
];

// =============================================================
// 4. PARSE & VALIDATE INPUT
// =============================================================
$body = json_decode(file_get_contents('php://input'), true);

$username    = trim($body['username']    ?? '');
$email       = trim($body['email']       ?? '');
$password    = $body['password']         ?? '';   // Do NOT trim passwords
$questionIdx = $body['mfa_question']     ?? null;
$mfaAnswer   = trim($body['mfa_answer'] ?? '');

// ── Username ──────────────────────────────────────────────────
if ($username === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Username is required.']);
    exit;
}

if (strlen($username) < 3 || strlen($username) > 30) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Username must be 3–30 characters.']);
    exit;
}

// Only alphanumeric, underscore, hyphen — prevents injection even with prepared stmts
if (!preg_match('/^[a-zA-Z0-9_-]+$/', $username)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Username may only contain letters, numbers, underscores, or hyphens.']);
    exit;
}

// ── Email ─────────────────────────────────────────────────────
if ($email === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Email is required.']);
    exit;
}

// filter_var is the standard PHP email format check
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Enter a valid email address.']);
    exit;
}

// ── Password ──────────────────────────────────────────────────
if (strlen($password) < 8) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters.']);
    exit;
}

// bcrypt silently truncates beyond 72 bytes — cap before that
if (strlen($password) > 255) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Password is too long.']);
    exit;
}

// ── MFA question index ────────────────────────────────────────
// Cast to int so non-numeric values become 0; then check whitelist
$questionIdx = (int) $questionIdx;

if (!array_key_exists($questionIdx, $securityQuestions)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid security question selected.']);
    exit;
}

// ── MFA answer ────────────────────────────────────────────────
if ($mfaAnswer === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Security answer is required.']);
    exit;
}

if (strlen($mfaAnswer) > 128) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Security answer is too long.']);
    exit;
}

// =============================================================
// 5. UNIQUENESS CHECKS
// Check before INSERT to return a readable error.
// The UNIQUE constraint in the DB is the real enforcement layer —
// these checks just improve the UX error message.
// =============================================================
$pdo = getDB();

$checkUser = $pdo->prepare('SELECT id FROM users WHERE username = :username LIMIT 1');
$checkUser->execute([':username' => $username]);
if ($checkUser->fetch()) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Username is already taken.']);
    exit;
}

$checkEmail = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
$checkEmail->execute([':email' => $email]);
if ($checkEmail->fetch()) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'An account with that email already exists.']);
    exit;
}

// =============================================================
// 6. HASH CREDENTIALS
// cost 12 matches login.php. Do NOT change cost here without
// updating login.php as well — they must agree.
// MFA answer normalized identically to verify_mfa.php:
//   trim() already applied above; strtolower() applied here.
// =============================================================
$passwordHash  = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
$normalizedMfa = strtolower($mfaAnswer); // trim() already done above
$mfaHash       = password_hash($normalizedMfa, PASSWORD_BCRYPT, ['cost' => 12]);

// =============================================================
// 7. INSERT NEW USER
// role is hardcoded — never sourced from $body.
// failed_attempts, locked_until, last_login default to 0/NULL/NULL.
// =============================================================
try {
    $insert = $pdo->prepare(
        'INSERT INTO users (username, email, password_hash, role, mfa_question, mfa_answer_hash)
         VALUES (:username, :email, :password_hash, :role, :mfa_question, :mfa_answer_hash)'
    );
    $insert->execute([
        ':username'        => $username,
        ':email'           => $email,
        ':password_hash'   => $passwordHash,
        ':role'            => 'user',           // Hardcoded — never from body
        ':mfa_question'    => $questionIdx,
        ':mfa_answer_hash' => $mfaHash,
    ]);
} catch (\PDOException $e) {
    // Catch race-condition duplicates (two requests at the same ms)
    if ($e->getCode() === '23000') {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Username or email already taken.']);
        exit;
    }

    // Unexpected DB error — log server-side, return generic message
    error_log('[REGISTER ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Registration failed. Please try again.']);
    exit;
}

$newUserId = (int) $pdo->lastInsertId();

// Audit log — use the new user's own ID as actor
logActivity($pdo, $newUserId, $username, 'ACCOUNT_CREATED', "Role: user");

echo json_encode([
    'success' => true,
    'message' => 'Account created successfully. You can now log in.',
]);