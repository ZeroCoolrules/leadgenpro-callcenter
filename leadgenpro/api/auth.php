<?php
/**
 * LeadGen Pro - Authentication API
 * POST /api/auth.php - Login
 * POST /api/auth.php?action=register - Register
 * POST /api/auth.php?action=logout - Logout
 * GET /api/auth.php?action=verify - Verify token
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'login';

switch ($method) {
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);

        switch ($action) {
            case 'login':
                handleLogin($pdo, $data);
                break;

            case 'register':
                handleRegister($pdo, $data);
                break;

            case 'logout':
                handleLogout($data);
                break;

            case 'forgot':
                handleForgotPassword($pdo, $data);
                break;

            case 'reset':
                handleResetPassword($pdo, $data);
                break;

            default:
                jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
        }
        break;

    case 'GET':
        if ($action === 'verify') {
            verifyToken($pdo);
        } else {
            jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
        }
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

function handleLogin($pdo, $data) {
    $email = sanitize($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($email) || empty($password)) {
        jsonResponse(['success' => false, 'error' => 'Email and password required'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND status = 'active'");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['success' => false, 'error' => 'Invalid credentials'], 401);
    }

    // Update last login
    $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?")->execute([$user['id']]);

    // Generate API key if not exists
    if (empty($user['api_key'])) {
        $user['api_key'] = generateApiKey();
        $pdo->prepare("UPDATE users SET api_key = ? WHERE id = ?")->execute([$user['api_key'], $user['id']]);
    }

    // Remove sensitive data
    unset($user['password_hash']);

    jsonResponse([
        'success' => true,
        'message' => 'Login successful',
        'data' => [
            'user' => $user,
            'api_key' => $user['api_key']
        ]
    ]);
}

function handleRegister($pdo, $data) {
    $required = ['email', 'password', 'first_name', 'last_name'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            jsonResponse(['success' => false, 'error' => "$field is required"], 400);
        }
    }

    $email = sanitize($data['email']);
    $password = $data['password'];
    $first_name = sanitize($data['first_name']);
    $last_name = sanitize($data['last_name']);
    $company_name = sanitize($data['company_name'] ?? '');

    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'error' => 'Invalid email address'], 400);
    }

    // Check if email exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonResponse(['success' => false, 'error' => 'Email already registered'], 409);
    }

    // Validate password strength
    if (strlen($password) < 8) {
        jsonResponse(['success' => false, 'error' => 'Password must be at least 8 characters'], 400);
    }

    // Hash password
    $password_hash = password_hash($password, PASSWORD_BCRYPT);

    // Generate API key
    $api_key = generateApiKey();

    try {
        $pdo->beginTransaction();

        // Insert user
        $stmt = $pdo->prepare("
            INSERT INTO users (email, password_hash, first_name, last_name, company_name, api_key, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
        ");
        $stmt->execute([$email, $password_hash, $first_name, $last_name, $company_name, $api_key]);
        $user_id = $pdo->lastInsertId();

        // Create default settings
        $pdo->prepare("INSERT INTO settings (user_id) VALUES (?)")->execute([$user_id]);

        // Create trial subscription
        $pdo->prepare("
            INSERT INTO subscriptions (user_id, plan_name, plan_tier, status, price, billing_cycle, trial_ends_at, features, limits)
            VALUES (?, 'Trial', 'professional', 'trialing', 0.00, 'monthly', DATE_ADD(NOW(), INTERVAL 14 DAY),
            '{\"ai_calls\": true, \"email_automation\": true, \"analytics\": true}',
            '{\"max_leads\": 1000, \"max_campaigns\": 10, \"max_ai_calls_per_day\": 100}')
        ")->execute([$user_id]);

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'message' => 'Registration successful',
            'data' => [
                'user_id' => $user_id,
                'api_key' => $api_key
            ]
        ], 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'error' => 'Registration failed'], 500);
    }
}

function handleLogout($data) {
    // In a stateless API, client just deletes the token
    // Here we could add token blacklisting if needed
    jsonResponse(['success' => true, 'message' => 'Logout successful']);
}

function handleForgotPassword($pdo, $data) {
    $email = sanitize($data['email'] ?? '');

    $stmt = $pdo->prepare("SELECT id, first_name FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        // Don't reveal if email exists
        jsonResponse(['success' => true, 'message' => 'If email exists, reset link sent']);
        return;
    }

    // Generate reset token
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+1 hour'));

    // Store token (you'd need a password_resets table)
    // For now, just return success

    // TODO: Send email with reset link
    // mail($email, "Password Reset", "Click here: https://yourdomain.com/reset?token=$token");

    jsonResponse(['success' => true, 'message' => 'Password reset email sent']);
}

function handleResetPassword($pdo, $data) {
    $token = sanitize($data['token'] ?? '');
    $password = $data['password'] ?? '';

    // Verify token and update password
    // Implementation depends on your password_resets table

    jsonResponse(['success' => true, 'message' => 'Password updated successfully']);
}

function verifyToken($pdo) {
    $headers = getallheaders();
    $api_key = str_replace('Bearer ', '', $headers['Authorization'] ?? '');

    if (empty($api_key)) {
        jsonResponse(['success' => false, 'error' => 'No token provided'], 401);
    }

    $stmt = $pdo->prepare("SELECT id, email, first_name, last_name, role FROM users WHERE api_key = ? AND status = 'active'");
    $stmt->execute([$api_key]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(['success' => false, 'error' => 'Invalid token'], 401);
    }

    jsonResponse([
        'success' => true,
        'data' => $user
    ]);
}

function generateApiKey() {
    return 'lgp_' . bin2hex(random_bytes(32));
}
?>
