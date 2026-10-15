<?php
/**
 * LeadGen Pro - Agentic SMS Dispatch: Reminder Processor
 * GET /api/sms-process-reminders.php
 *
 * Intended to be hit by a cron job every few minutes. Finds reminders whose
 * send_at has passed, "sends" them (simulation mode: logs the message and
 * marks it sent — swap in a real Twilio REST API call once Twilio is wired up),
 * and records the outbound message on the lead's activity timeline.
 */

require_once 'config.php';
require_once 'sms-agent.php';

$stmt = $pdo->query("SELECT * FROM sms_reminders WHERE status = 'pending' AND send_at <= NOW()");
$due = $stmt->fetchAll();
$sent = 0;

foreach ($due as $reminder) {
    $leadStmt = $pdo->prepare("SELECT id FROM leads WHERE user_id = ? AND phone = ?");
    $leadStmt->execute([$reminder['user_id'], $reminder['recipient_phone']]);
    $lead = $leadStmt->fetch();
    $lead_id = $lead ? $lead['id'] : smsUpsertLead($pdo, $reminder['user_id'], $reminder['recipient_phone'], ['name' => $reminder['recipient_name']]);

    $conversation = smsGetOrCreateConversation($pdo, $reminder['user_id'], $reminder['recipient_phone'], $lead_id);
    smsLogMessage($pdo, $reminder['user_id'], $lead_id, $conversation, 'outbound', '[REMINDER] ' . $reminder['message']);

    $pdo->prepare("UPDATE sms_reminders SET status = 'sent' WHERE id = ?")->execute([$reminder['id']]);
    $sent++;
}

jsonResponse(['success' => true, 'processed' => $sent]);
