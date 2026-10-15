<?php
/**
 * LeadGen Pro - Agentic SMS Dispatch: Twilio Webhook
 * POST /api/sms-webhook.php - Configure this as your Twilio SMS webhook URL.
 * Twilio posts application/x-www-form-urlencoded fields: From, To, Body, MessageSid.
 * Returns TwiML so Twilio delivers the reply as the outbound SMS.
 *
 * The receiving "To" number is matched against each user's configured
 * twilioPhoneNumber (api/sms-settings.php) to route the message to the right account.
 */

require_once 'config.php';
require_once 'sms-agent.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method not allowed');
}

$from = $_POST['From'] ?? '';
$to = $_POST['To'] ?? '';
$body = $_POST['Body'] ?? '';

if (empty($from) || $body === '') {
    http_response_code(400);
    exit('Missing From or Body parameter.');
}

$stmt = $pdo->prepare("
    SELECT user_id FROM settings
    WHERE JSON_UNQUOTE(JSON_EXTRACT(sms_agent_settings, '$.twilioPhoneNumber')) = ?
    LIMIT 1
");
$stmt->execute([$to]);
$owner = $stmt->fetch();

header('Content-Type: text/xml');

if (!$owner) {
    echo '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    exit();
}

// Real Twilio requests aren't expected to carry this header. It exists so
// alternate senders (e.g. the Android SMS Forwarder app in mobile/sms-forwarder)
// can't be spoofed by anyone who discovers this URL, once a secret is configured.
$settings = getSmsSettings($pdo, $owner['user_id']);
if (!empty($settings['smsForwarderSecret'])) {
    $headers = getallheaders();
    $providedSecret = $headers['X-Forwarder-Secret'] ?? $headers['x-forwarder-secret'] ?? '';
    if (!hash_equals($settings['smsForwarderSecret'], $providedSecret)) {
        http_response_code(403);
        echo '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
        exit();
    }
}

try {
    $replyText = processIncomingSMS($pdo, $owner['user_id'], $from, $body);
    $escaped = htmlspecialchars($replyText, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n    <Message>$escaped</Message>\n</Response>";
} catch (Exception $e) {
    error_log('SMS webhook error: ' . $e->getMessage());
    echo '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}
