<?php
/**
 * index.php — Backend Entry Point & Request Router
 *
 * Purpose:      Single entry point for all API requests from the React frontend.
 *               Handles CORS, session initialization, and routes requests
 *               to the appropriate API handler file.
 *
 * Usage:        All frontend fetch() calls target:
 *               https://schadens.augusta2026.online/backend/index.php?route=<name>
 *
 * Dependencies: PHP 7.4+, PDO_MySQL, sessions enabled in php.ini
 *
 * Security:     - CORS restricted to allowed origins only
 *               - Only whitelisted routes are dispatched
 *               - Unknown routes return 404 JSON, not raw errors
 */

// Force session cookie to work cross-request on shared hosting
ini_set('session.cookie_samesite', 'None');
ini_set('session.cookie_secure', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.use_strict_mode', '1');

// =============================================================
// 1. CORS HEADERS
// Must come before session_start() and any output.
// Dynamically matches the request origin against a whitelist
// so credentials (cookies) are accepted by the browser.
// =============================================================
$allowedOrigins = [
    'https://schadens.augusta2026.online',
    'http://localhost:5173',
];

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($requestOrigin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
} else {
    header('Access-Control-Allow-Origin: https://schadens.augusta2026.online');
}

header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle CORS preflight — browsers send OPTIONS before credentialed requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// =============================================================
// 2. SESSION — After headers, before any handler runs
// =============================================================
session_start();

// =============================================================
// 3. ROUTE WHITELIST
// Maps ?route=<key> query param to handler file paths.
// Only files listed here can be executed — prevents path traversal.
// =============================================================
$routes = [
    'login' => __DIR__ . '/api/login.php',
    'verify_mfa' => __DIR__ . '/api/verify_mfa.php',
    'logout' => __DIR__ . '/api/logout.php',
    'get_profile' => __DIR__ . '/api/get_profile.php',
    'get_logs' => __DIR__ . '/api/get_logs.php',
    'get_users' => __DIR__ . '/api/get_users.php',
    'update_role' => __DIR__ . '/api/update_role.php',
    'update_credentials' => __DIR__ . '/api/update_credentials.php',
    'register' => __DIR__ . '/api/register.php',
];

// =============================================================
// 4. DISPATCH
// =============================================================
$route = trim($_GET['route'] ?? '');

if ($route === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'No route specified.',
    ]);
    exit;
}

if (!array_key_exists($route, $routes)) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => "Route '{$route}' not found.",
    ]);
    exit;
}

// Confirmed safe — execute the whitelisted handler
require_once $routes[$route];