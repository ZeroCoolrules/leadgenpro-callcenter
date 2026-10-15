<?php
/**
 * LeadGen Pro - Agentic SMS Dispatch: Conversations
 * GET  /api/sms-conversations.php                - list conversations
 * GET  /api/sms-conversations.php?phone=+1555... - list messages for one conversation
 * POST /api/sms-conversations.php                - manual human reply { phone, text }
 */

require_once 'config.php';
require_once 'sms-agent.php';

$user_id = validateApiKey($pdo);
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $phone = sanitize($_GET['phone'] ?? '');

        if ($phone) {
            // Mark conversation read and return its message thread
            $pdo->prepare("UPDATE sms_conversations SET unread_count = 0 WHERE user_id = ? AND phone = ?")->execute([$user_id, $phone]);

            $stmt = $pdo->prepare("
                SELECT a.direction, a.content, a.created_at
                FROM lead_activities a
                JOIN leads l ON a.lead_id = l.id
                WHERE l.user_id = ? AND l.phone = ? AND a.activity_type = 'sms'
                ORDER BY a.created_at ASC
            ");
            $stmt->execute([$user_id, $phone]);
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        }

        $stmt = $pdo->prepare("
            SELECT c.id, c.phone, c.status, c.unread_count, c.last_message_at,
                   TRIM(CONCAT(l.first_name, ' ', l.last_name)) as lead_name
            FROM sms_conversations c
            LEFT JOIN leads l ON c.lead_id = l.id
            WHERE c.user_id = ?
            ORDER BY c.last_message_at DESC
        ");
        $stmt->execute([$user_id]);
        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        $phone = sanitize($data['phone'] ?? '');
        $text = trim($data['text'] ?? '');

        if (empty($phone) || empty($text)) {
            jsonResponse(['success' => false, 'error' => 'phone and text are required'], 400);
        }

        $lead_id = smsUpsertLead($pdo, $user_id, $phone);
        $conversation = smsGetOrCreateConversation($pdo, $user_id, $phone, $lead_id);
        smsLogMessage($pdo, $user_id, $lead_id, $conversation, 'outbound', $text);

        jsonResponse(['success' => true, 'message' => 'Reply sent']);
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}
