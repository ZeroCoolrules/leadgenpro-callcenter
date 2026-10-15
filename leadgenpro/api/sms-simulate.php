<?php
/**
 * LeadGen Pro - Agentic SMS Dispatch: Simulator
 * POST /api/sms-simulate.php { "phone": "+15551234567", "text": "Hi, I need an appointment" }
 * Lets the dashboard exercise the SMS agent without a real Twilio number.
 */

require_once 'config.php';
require_once 'sms-agent.php';

$user_id = validateApiKey($pdo);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$phone = sanitize($data['phone'] ?? '');
$text = trim($data['text'] ?? '');

if (empty($phone) || empty($text)) {
    jsonResponse(['success' => false, 'error' => 'phone and text are required'], 400);
}

try {
    $reply = processIncomingSMS($pdo, $user_id, $phone, $text);
    jsonResponse(['success' => true, 'reply' => $reply]);
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
}
