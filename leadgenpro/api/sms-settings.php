<?php
/**
 * LeadGen Pro - Agentic SMS Dispatch: Settings
 * GET  /api/sms-settings.php - get current SMS agent configuration
 * POST /api/sms-settings.php - update SMS agent configuration (merged with existing)
 */

require_once 'config.php';
require_once 'sms-agent.php';

$user_id = validateApiKey($pdo);
$method = $_SERVER['REQUEST_METHOD'];

const SMS_SECRET_FIELDS = ['twilioAuthToken', 'openaiApiKey', 'smsForwarderSecret'];

switch ($method) {
    case 'GET':
        $settings = getSmsSettings($pdo, $user_id);
        // Never echo back the raw secret values to the client
        foreach (SMS_SECRET_FIELDS as $field) {
            $settings[$field] = empty($settings[$field]) ? '' : '••••••••';
        }
        jsonResponse(['success' => true, 'data' => $settings]);
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        // Don't overwrite secrets with the masked placeholder sent back by the UI
        foreach (SMS_SECRET_FIELDS as $secretField) {
            if (isset($data[$secretField]) && strpos($data[$secretField], '•') !== false) {
                unset($data[$secretField]);
            }
        }

        $allowed = [
            'systemPrompt', 'blockedWords', 'optOutStrings', 'allowAIReplies',
            'appointmentDurationMinutes', 'availableServices',
            'twilioAccountSid', 'twilioAuthToken', 'twilioPhoneNumber', 'openaiApiKey',
            'smsForwarderSecret'
        ];
        $updates = array_intersect_key($data, array_flip($allowed));

        $saved = saveSmsSettings($pdo, $user_id, $updates);
        foreach (SMS_SECRET_FIELDS as $field) {
            $saved[$field] = empty($saved[$field]) ? '' : '••••••••';
        }

        jsonResponse(['success' => true, 'data' => $saved]);
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}
