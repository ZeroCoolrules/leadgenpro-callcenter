<?php
/**
 * LeadGen Pro - Call Center Outcome Webhook
 * POST /api/call-center-outcome.php
 *
 * Called by the call-center app (see its server/leadgenpro.ts) after a call
 * or SMS conversation with a lead ends, so the outcome shows up on the lead
 * here without anyone copying it over by hand.
 */

require_once 'config.php';
$method = $_SERVER['REQUEST_METHOD'];
$user_id = validateApiKey($pdo);

if ($method !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

$data = json_decode(file_get_contents('php://input'), true);

$lead_id = intval($data['lead_id'] ?? 0);
$channel = in_array($data['channel'] ?? '', ['voice', 'sms']) ? $data['channel'] : 'voice';
$allowed_outcomes = ['meeting_booked', 'callback_requested', 'not_interested', 'voicemail', 'no_answer', 'wrong_number', 'other'];
$outcome = in_array($data['outcome'] ?? '', $allowed_outcomes) ? $data['outcome'] : 'other';
$call_id = sanitize($data['call_id'] ?? '');
$duration = intval($data['duration_seconds'] ?? 0) ?: null;
$recording_url = !empty($data['recording_url']) ? sanitize($data['recording_url']) : null;
$transcript = isset($data['transcript']) ? substr((string) $data['transcript'], 0, 20000) : null;
$notes = isset($data['notes']) ? sanitize($data['notes']) : '';

if (empty($lead_id)) {
    jsonResponse(['success' => false, 'error' => 'lead_id is required'], 400);
}

// Make sure this lead belongs to the user whose API key this is.
$stmt = $pdo->prepare("SELECT id FROM leads WHERE id = ? AND user_id = ?");
$stmt->execute([$lead_id, $user_id]);
if (!$stmt->fetch()) {
    jsonResponse(['success' => false, 'error' => 'Lead not found'], 404);
}

$new_status = $outcome === 'meeting_booked' ? 'qualified'
    : ($outcome === 'not_interested' ? 'nurture' : 'contacted');

$pdo->beginTransaction();
try {
    $content = 'Call center outcome: ' . $outcome . ($call_id ? " (call $call_id)" : '') . ($notes ? " — $notes" : '');
    $stmt = $pdo->prepare("INSERT INTO lead_activities
        (lead_id, user_id, activity_type, direction, content, duration_seconds, call_recording_url, ai_transcript)
        VALUES (?, ?, ?, 'outbound', ?, ?, ?, ?)");
    $stmt->execute([
        $lead_id,
        $user_id,
        $channel === 'voice' ? 'ai_call' : 'sms',
        $content,
        $duration,
        $recording_url,
        $transcript,
    ]);

    $stmt = $pdo->prepare("UPDATE leads SET status = ?, last_contacted_at = NOW() WHERE id = ?");
    $stmt->execute([$new_status, $lead_id]);

    $pdo->commit();
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['success' => false, 'error' => 'Could not record outcome', 'message' => $e->getMessage()], 500);
}

jsonResponse(['success' => true, 'data' => ['lead_id' => $lead_id, 'status' => $new_status, 'outcome' => $outcome]]);
