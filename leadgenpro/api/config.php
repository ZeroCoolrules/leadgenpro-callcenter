<?php
/**
 * LeadGen Pro - Database Configuration
 * Place this file in /api/config.php
 */

// Prevent direct access
if (!defined('LEADGEN_PRO')) {
    define('LEADGEN_PRO', true);
}

// Error reporting (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// CORS Headers - Allow your domain
$allowed_origins = [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
    'http://localhost',
    'http://localhost:8000'
];
// Add the deployed URL (e.g. Render's APP_URL env var) without editing this file
$deployed_origin = getenv('APP_URL');
if ($deployed_origin) {
    $allowed_origins[] = rtrim($deployed_origin, '/');
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: *");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database Configuration
// Reads from environment variables when set (e.g. on Render or any host that
// injects DB_HOST/DB_NAME/DB_USER/DB_PASSWORD), otherwise falls back to the
// placeholders below for classic cPanel-style installs where you edit this
// file directly.
$db_config = [
    'host' => getenv('DB_HOST') ?: 'localhost',
    'database' => getenv('DB_NAME') ?: 'yourusername_leadgen_pro',  // Change this
    'username' => getenv('DB_USER') ?: 'yourusername_leaduser',      // Change this
    'password' => getenv('DB_PASSWORD') ?: 'your_secure_password',   // Change this
    'charset' => 'utf8mb4'
];

// Connect to database
try {
    $dsn = "mysql:host={$db_config['host']};dbname={$db_config['database']};charset={$db_config['charset']}";
    $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed',
        'message' => $e->getMessage()
    ]);
    exit();
}

// Helper function to sanitize input
function sanitize($data) {
    return htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8');
}

// Helper function to validate API key
function validateApiKey($pdo) {
    $headers = getallheaders();
    $api_key = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    $api_key = str_replace('Bearer ', '', $api_key);

    if (empty($api_key)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'API key required']);
        exit();
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE api_key = ? AND status = 'active'");
    $stmt->execute([$api_key]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid API key']);
        exit();
    }

    return $user['id'];
}

// Helper function to send JSON response
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}
?>
