<?php

/**
 * db.php — Database Connection
 *
 * Purpose:    Provides a reusable PDO connection to the MySQL database.
 * Usage:      require_once __DIR__ . '/../config/db.php'; then call getDB().
 * DB:         db_ias_jimenez
 * Dependencies: PDO, PDO_MySQL extension enabled in php.ini
 *
 * Security:   Credentials should move to environment variables in production.
 *             PDO is used over mysqli for prepared statement safety.
 */

/**
 * Database credentials.
 * TODO: Replace with $_ENV values and a .env loader (e.g., vlucas/phpdotenv)
 * before deploying to any public-facing server.
 */
define('DB_HOST', 'localhost');
define('DB_NAME', 'db_ias_jimenez');
define('DB_USER', 'root');       // Change for production
define('DB_PASS', '');           // Change for production
define('DB_CHARSET', 'utf8mb4');

/**
 * getDB()
 *
 * Returns a singleton PDO instance. Reuses the same connection across
 * multiple calls within a single request cycle — avoids redundant connections.
 *
 * @return PDO  Active PDO connection object.
 * @throws PDOException  If connection fails (caught and handled here).
 */
function getDB(): PDO {
    // Singleton holder — persists for the lifetime of the request
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_NAME,
        DB_CHARSET
    );

    $options = [
        // Throw exceptions on DB errors instead of silent failures
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        // Return rows as associative arrays by default
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Disable emulated prepares — use real prepared statements for security
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        // Do NOT expose raw DB errors to the client — log server-side only
        error_log('[DB ERROR] ' . $e->getMessage());

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database connection failed. Contact administrator.'
        ]);
        exit;
    }

    return $pdo;
}