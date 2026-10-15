<?php
/**
 * LeadGen Pro - Agentic SMS Dispatch: Human Handoffs
 * GET  /api/sms-handoffs.php          - list handoffs (pending first)
 * POST /api/sms-handoffs.php          - resolve a handoff { id, notes }
 */

require_once 'config.php';

$user_id = validateApiKey($pdo);
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->prepare("
            SELECT * FROM sms_handoffs
            WHERE user_id = ?
            ORDER BY (status = 'pending') DESC, created_at DESC
            LIMIT 200
        ");
        $stmt->execute([$user_id]);
        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        $id = intval($data['id'] ?? 0);

        if (!$id) {
            jsonResponse(['success' => false, 'error' => 'Handoff ID required'], 400);
        }

        $stmt = $pdo->prepare("SELECT * FROM sms_handoffs WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $user_id]);
        $handoff = $stmt->fetch();

        if (!$handoff) {
            jsonResponse(['success' => false, 'error' => 'Handoff not found'], 404);
        }

        $notes = isset($data['notes']) ? sanitize($data['notes']) : $handoff['notes'];
        $pdo->prepare("UPDATE sms_handoffs SET status = 'resolved', notes = ?, resolved_at = NOW() WHERE id = ?")
            ->execute([$notes, $id]);

        $pdo->prepare("UPDATE sms_conversations SET status = 'ai_active' WHERE user_id = ? AND phone = ?")
            ->execute([$user_id, $handoff['phone']]);

        jsonResponse(['success' => true, 'message' => 'Handoff resolved']);
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}
