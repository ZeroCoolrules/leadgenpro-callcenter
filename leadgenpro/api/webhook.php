<?php
/**
 * LeadGen Pro - Webhook Handler for AI Call Updates
 * POST /api/webhook.php - Receives call status updates from Bland AI
 */

require_once 'config.php';

// Verify webhook signature (implement in production)
$signature = $_SERVER['HTTP_X_BLAND_SIGNATURE'] ?? '';
$payload = file_get_contents('php://input');
$data = json_decode($payload, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit();
}

$call_id = $data['call_id'] ?? '';
$status = $data['status'] ?? '';
$transcript = $data['transcript'] ?? '';
$recording_url = $data['recording_url'] ?? '';
$duration = intval($data['duration'] ?? 0);

// Determine outcome based on transcript analysis
$outcome = 'other';
$sentiment = 'neutral';

if (stripos($transcript, 'meeting') !== false || stripos($transcript, 'schedule') !== false) {
    $outcome = 'meeting_booked';
} elseif (stripos($transcript, 'callback') !== false || stripos($transcript, 'call back') !== false) {
    $outcome = 'callback_requested';
} elseif (stripos($transcript, 'not interested') !== false) {
    $outcome = 'not_interested';
} elseif (stripos($transcript, 'voicemail') !== false || $duration < 30) {
    $outcome = 'voicemail';
}

// Analyze sentiment
$positive_words = ['interested', 'great', 'perfect', 'yes', 'sure', 'absolutely', 'love'];
$negative_words = ['no', 'never', 'stop', 'remove', 'unsubscribe', 'not interested', 'busy'];

$positive_count = 0;
$negative_count = 0;
foreach ($positive_words as $word) {
    if (stripos($transcript, $word) !== false) $positive_count++;
}
foreach ($negative_words as $word) {
    if (stripos($transcript, $word) !== false) $negative_count++;
}

if ($positive_count > $negative_count) $sentiment = 'positive';
elseif ($negative_count > $positive_count) $sentiment = 'negative';

// Update database
$stmt = $pdo->prepare("
    UPDATE campaign_leads 
    SET 
        ai_call_duration = ?,
        ai_recording_url = ?,
        ai_transcript = ?,
        ai_outcome = ?,
        status = CASE 
            WHEN ? = 'meeting_booked' THEN 'converted'
            WHEN ? IN ('callback_requested', 'not_interested') THEN 'responded'
            ELSE 'contacted'
        END,
        responded_at = NOW()
    WHERE ai_call_id = ?
");
$stmt->execute([$duration, $recording_url, $transcript, $outcome, $outcome, $outcome, $call_id]);

// Also add to activities
$stmt = $pdo->prepare("
    INSERT INTO lead_activities (lead_id, activity_type, direction, content, duration_seconds, call_recording_url, ai_transcript, ai_sentiment)
    SELECT lead_id, 'ai_call', 'outbound', ?, ?, ?, ?, ?
    FROM campaign_leads 
    WHERE ai_call_id = ?
");
$stmt->execute([
    "AI Call completed. Outcome: $outcome",
    $duration,
    $recording_url,
    $transiment,
    $call_id
]);

// Update lead status
$stmt = $pdo->prepare("
    UPDATE leads l
    JOIN campaign_leads cl ON l.id = cl.lead_id
    SET 
        l.status = CASE 
            WHEN ? = 'meeting_booked' THEN 'qualified'
            ELSE 'contacted'
        END,
        l.last_contacted_at = NOW()
    WHERE cl.ai_call_id = ?
");
$stmt->execute([$outcome, $call_id]);

// Return success
http_response_code(200);
echo json_encode(['success' => true, 'message' => 'Webhook processed']);
?>
