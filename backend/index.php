<?php

/**
 * index.php — Backend Entry Point & Request Router
 *
 * Purpose:      Single entry point for all API requests from the React frontend.
 *               Handles CORS, session initialization, and routes requests
 *               to the appropriate API handler file.
 *
 * Usage:        All frontend fetch() calls target:
 *               http://localhost/IAS/secure-access-frontend/backend/index.php?route=<name>
 *
 * Dependencies: PHP 7.4+, PDO_MySQL, sessions enabled in php.ini
 *
 * Security:     - CORS restricted to local dev origin (update for production)
 *               - Only whitelisted routes are dispatched
 *               - Unknown routes return 404 JSON, not raw errors
 */

// =============================================================
// 1. SESSION — Start before any output
// =============================================================
session_start();

// =============================================================
// 2. CORS HEADERS
// Allows the Vite dev server (port 5173) to communicate with
// this PHP backend. Update ALLOWED_ORIGIN for production.
// =============================================================
define('ALLOWED_ORIGIN', 'http://localhost:5173');

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($requestOrigin === ALLOWED_ORIGIN) {
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
} else {
    // Deny unknown origins — do not echo a wildcard in production
    header('Access-Control-Allow-Origin: null');
}

header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Preflight request — browsers send OPTIONS before POST with credentials
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204); // No Content
    exit;
}

// =============================================================
// 3. RESPONSE FORMAT — All responses are JSON
// =============================================================
header('Content-Type: application/json; charset=utf-8');

// =============================================================
// 4. ROUTE WHITELIST
// Maps ?route=<key> query param to handler file paths.
// Only files listed here can be executed — prevents path traversal.
// =============================================================
$routes = [
    'login'       => __DIR__ . '/api/login.php',
    'verify_mfa'  => __DIR__ . '/api/verify_mfa.php',
    'logout'      => __DIR__ . '/api/logout.php',
    'get_profile' => __DIR__ . '/api/get_profile.php',
    'get_logs'    => __DIR__ . '/api/get_logs.php',
    'get_users'   => __DIR__ . '/api/get_users.php',
    'update_role' => __DIR__ . '/api/update_role.php',
];

// =============================================================
// 5. DISPATCH
// =============================================================
$route = trim($_GET['route'] ?? '');

if ($route === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'No route specified.'
    ]);
    exit;
}

if (!array_key_exists($route, $routes)) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => "Route '{$route}' not found."
    ]);
    exit;
}

// Confirmed safe — execute the whitelisted handler
require_once $routes[$route];