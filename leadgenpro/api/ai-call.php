<?php
/**
 * LeadGen Pro - AI Voice Calling API
 * POST /api/ai-call.php - Trigger AI call
 * GET /api/ai-call.php?campaign_id=123 - Get call status
 */

require_once 'config.php';
$method = $_SERVER['REQUEST_METHOD'];
$user_id = validateApiKey($pdo);

// Get user settings for AI configuration
$settingsStmt = $pdo->prepare("SELECT * FROM settings WHERE user_id = ?");
$settingsStmt->execute([$user_id]);
$settings = $settingsStmt->fetch();

// Get API integrations
$apiStmt = $pdo->prepare("SELECT * FROM api_integrations WHERE user_id = ? AND is_active = true");
$apiStmt->execute([$user_id]);
$apis = $apiStmt->fetchAll(PDO::FETCH_KEY_PAIR);

switch ($method) {
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);

        $lead_id = intval($data['lead_id'] ?? 0);
        $campaign_id = intval($data['campaign_id'] ?? 0);
        $phone = sanitize($data['phone'] ?? '');
        $script = $data['script'] ?? '';

        if (empty($phone)) {
            jsonResponse(['success' => false, 'error' => 'Phone number required'], 400);
        }

        // Check if Bland AI is configured
        if (empty($apis['bland_ai'])) {
            // Simulate call for demo
            $call_id = 'sim_' . uniqid();

            // Log simulated call
            if ($campaign_id && $lead_id) {
                $stmt = $pdo->prepare("INSERT INTO campaign_leads 
                    (campaign_id, lead_id, ai_call_id, status, sent_at) 
                    VALUES (?, ?, ?, 'contacted', NOW())
                    ON DUPLICATE KEY UPDATE 
                    ai_call_id = VALUES(ai_call_id), 
                    status = VALUES(status),
                    sent_at = VALUES(sent_at)");
                $stmt->execute([$campaign_id, $lead_id, $call_id]);
            }

            jsonResponse([
                'success' => true,
                'message' => 'Call initiated (simulation mode)',
                'data' => [
                    'call_id' => $call_id,
                    'status' => 'dialing',
                    'simulation' => true
                ]
            ]);
        }

        // Real Bland AI integration
        $bland_key = $apis['bland_ai']['api_key_encrypted']; // Decrypt in production

        $callData = [
            'phone_number' => $phone,
            'task' => $script,
            'voice' => $data['voice'] ?? 'maya',
            'wait_for_greeting' => true,
            'record' => true,
            'amd' => true, // Answering machine detection
            'interruption_threshold' => 100,
            'temperature' => 0.7
        ];

        $ch = curl_init('https://api.bland.ai/call');
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($callData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: ' . $bland_key,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            $result = json_decode($response, true);
            $call_id = $result['call_id'] ?? null;

            // Log to database
            if ($campaign_id && $lead_id && $call_id) {
                $stmt = $pdo->prepare("INSERT INTO campaign_leads 
                    (campaign_id, lead_id, ai_call_id, status, sent_at) 
                    VALUES (?, ?, ?, 'contacted', NOW())
                    ON DUPLICATE KEY UPDATE 
                    ai_call_id = VALUES(ai_call_id), 
                    status = VALUES(status)");
                $stmt->execute([$campaign_id, $lead_id, $call_id]);
            }

            jsonResponse([
                'success' => true,
                'message' => 'AI call initiated',
                'data' => $result
            ]);
        } else {
            jsonResponse([
                'success' => false,
                'error' => 'Failed to initiate call',
                'details' => json_decode($response, true)
            ], 500);
        }
        break;

    case 'GET':
        // Get call status or campaign stats
        $campaign_id = intval($_GET['campaign_id'] ?? 0);
        $call_id = sanitize($_GET['call_id'] ?? '');

        if ($call_id) {
            // Get specific call status from Bland AI
            $ch = curl_init("https://api.bland.ai/call/$call_id");
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: ' . ($apis['bland_ai']['api_key_encrypted'] ?? '')]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            $response = curl_exec($ch);
            curl_close($ch);

            jsonResponse([
                'success' => true,
                'data' => json_decode($response, true)
            ]);
        }

        if ($campaign_id) {
            // Get campaign call stats
            $stmt = $pdo->prepare("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
                    SUM(CASE WHEN status = 'responded' THEN 1 ELSE 0 END) as responded,
                    SUM(CASE WHEN ai_outcome = 'meeting_booked' THEN 1 ELSE 0 END) as meetings,
                    AVG(ai_call_duration) as avg_duration
                FROM campaign_leads 
                WHERE campaign_id = ?
            ");
            $stmt->execute([$campaign_id]);
            $stats = $stmt->fetch();

            jsonResponse(['success' => true, 'data' => $stats]);
        }

        jsonResponse(['success' => false, 'error' => 'Campaign ID or Call ID required'], 400);
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}
?>
