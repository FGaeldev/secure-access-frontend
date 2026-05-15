<?php

/**
 * helpers.php — Shared Backend Utility Functions
 *
 * Purpose:      Provides shared helper functions used across multiple
 *               API handlers. Extracted here so handlers can include
 *               only what they need without executing each other's
 *               request-handling code.
 *
 * Usage:        require_once __DIR__ . '/helpers.php';
 *
 * Dependencies: None — callers must pass a PDO instance to logActivity().
 */

/**
 * logActivity()
 *
 * Inserts an audit record into the activity_logs table.
 * Called from login.php, verify_mfa.php, and logout.php.
 *
 * @param PDO         $pdo      Active database connection.
 * @param int|null    $userId   ID of the user performing the action (null for unknown users).
 * @param string      $username Username string (denormalized for log safety — survives user deletion).
 * @param string      $action   Short action code e.g. 'LOGIN_FAILED', 'LOGOUT'.
 * @param string|null $detail   Optional extra context string.
 *
 * @return void
 */
function logActivity(PDO $pdo, ?int $userId, string $username, string $action, ?string $detail = null): void
{
    // REMOTE_ADDR may be spoofable via proxies — acceptable for local/school project.
    // Replace with a proxy-aware solution (e.g. X-Forwarded-For with trusted proxy list)
    // before deploying to production.
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    $stmt = $pdo->prepare(
        'INSERT INTO activity_logs (user_id, username, action, detail, ip_address)
         VALUES (:user_id, :username, :action, :detail, :ip)'
    );
    $stmt->execute([
        ':user_id'  => $userId,
        ':username' => $username,
        ':action'   => $action,
        ':detail'   => $detail,
        ':ip'       => $ip,
    ]);
}
