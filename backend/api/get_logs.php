<?php

/**
 * get_logs.php — Activity Logs Handler
 *
 * Purpose:      Returns paginated activity log entries from the audit trail.
 *               Restricted to users with role = 'admin'.
 *
 * Route:        GET index.php?route=get_logs
 *
 * Query Params (optional):
 *   - page    (int) Page number, 1-indexed. Default: 1.
 *   - limit   (int) Rows per page. Default: 20. Max: 100.
 *   - action  (string) Filter by action code e.g. 'LOGIN_FAILED'. Default: all.
 *
 * Response JSON:
 *   On success:
 *     {
 *       success: true,
 *       logs: [
 *         {
 *           id:         int,
 *           user_id:    int|null,
 *           username:   string,
 *           action:     string,
 *           detail:     string|null,
 *           ip_address: string,
 *           created_at: string
 *         }, ...
 *       ],
 *       pagination: {
 *         page:        int,
 *         limit:       int,
 *         total_rows:  int,
 *         total_pages: int
 *       }
 *     }
 *   On unauthorized:
 *     { success: false, message: string }
 *
 * Dependencies: config/db.php
 *
 * Security:
 *   - Double-gated: session auth check + role = 'admin' check
 *   - Pagination params sanitized and clamped before use in query
 *   - Action filter uses prepared statement binding — no raw interpolation
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
// 2. AUTH GUARD — Must be fully authenticated
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
// 3. RBAC GUARD — Admin role only
// Role is read from session (server-side), not from request params.
// =============================================================
if ($_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Forbidden. Admin access required.',
    ]);
    exit;
}

// =============================================================
// 4. SANITIZE PAGINATION PARAMS
// Clamp values to safe ranges — prevents abuse via huge LIMIT values.
// =============================================================
$page   = max(1, (int) ($_GET['page']  ?? 1));
$limit  = min(100, max(1, (int) ($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;

// Optional action filter — empty string means no filter
$actionFilter = trim($_GET['action'] ?? '');

// =============================================================
// 5. BUILD QUERY
// Conditionally append WHERE clause only when action filter provided.
// All values bound via prepared statements — no string interpolation.
// =============================================================
$pdo    = getDB();
$params = [];

// Base WHERE fragment — extended if action filter is active
$whereClause = '';
if ($actionFilter !== '') {
    $whereClause    = 'WHERE action = :action';
    $params[':action'] = $actionFilter;
}

// Count total matching rows for pagination metadata
$countStmt = $pdo->prepare(
    "SELECT COUNT(*) as total FROM activity_logs {$whereClause}"
);
$countStmt->execute($params);
$totalRows  = (int) $countStmt->fetch()['total'];
$totalPages = (int) ceil($totalRows / $limit);

// Fetch the current page of logs — newest first
$params[':limit']  = $limit;
$params[':offset'] = $offset;

$logsStmt = $pdo->prepare(
    "SELECT   id, user_id, username, action, detail, ip_address, created_at
     FROM     activity_logs
     {$whereClause}
     ORDER BY created_at DESC
     LIMIT    :limit
     OFFSET   :offset"
);

// PDO requires explicit int binding for LIMIT/OFFSET — string binding breaks MySQL
$logsStmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
$logsStmt->bindValue(':offset', $offset, PDO::PARAM_INT);

if ($actionFilter !== '') {
    $logsStmt->bindValue(':action', $actionFilter, PDO::PARAM_STR);
}

$logsStmt->execute();
$logs = $logsStmt->fetchAll();

echo json_encode([
    'success' => true,
    'logs'    => $logs,
    'pagination' => [
        'page'        => $page,
        'limit'       => $limit,
        'total_rows'  => $totalRows,
        'total_pages' => $totalPages,
    ],
]);