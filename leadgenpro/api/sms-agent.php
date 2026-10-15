<?php
/**
 * LeadGen Pro - Agentic SMS Dispatch Engine
 *
 * Ported from the standalone "Dispatch Agentic System" app into LeadGen Pro.
 * Handles inbound SMS text through compliance checks, an OpenAI function-calling
 * agent that can check availability / book appointments / escalate to a human,
 * and a rules-based fallback when no OpenAI key is configured (simulation mode).
 *
 * Include this file after config.php (needs $pdo).
 */

function getSmsSettings($pdo, $user_id) {
    $stmt = $pdo->prepare("SELECT sms_agent_settings FROM settings WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $row = $stmt->fetch();

    $defaults = [
        'systemPrompt' => "You are the friendly, efficient AI SMS assistant for this business. Greet leads, answer questions about services, and book appointments. Keep replies short and SMS-friendly (under 160 characters when possible).",
        'blockedWords' => ['scam', 'spam', 'hack', 'fraud', 'illegal'],
        'optOutStrings' => ['stop', 'unsubscribe', 'cancel', 'quit'],
        'allowAIReplies' => true,
        'appointmentDurationMinutes' => 60,
        'availableServices' => ['Consultation', 'Follow-up', 'Demo'],
        'twilioAccountSid' => '',
        'twilioAuthToken' => '',
        'twilioPhoneNumber' => '',
        'openaiApiKey' => '',
        'smsForwarderSecret' => ''
    ];

    if ($row && !empty($row['sms_agent_settings'])) {
        $stored = json_decode($row['sms_agent_settings'], true) ?: [];
        return array_merge($defaults, $stored);
    }

    return $defaults;
}

function saveSmsSettings($pdo, $user_id, $settings) {
    $current = getSmsSettings($pdo, $user_id);
    $merged = array_merge($current, $settings);

    $exists = $pdo->prepare("SELECT id FROM settings WHERE user_id = ?");
    $exists->execute([$user_id]);

    if ($exists->fetch()) {
        $stmt = $pdo->prepare("UPDATE settings SET sms_agent_settings = ? WHERE user_id = ?");
        $stmt->execute([json_encode($merged), $user_id]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO settings (user_id, sms_agent_settings) VALUES (?, ?)");
        $stmt->execute([$user_id, json_encode($merged)]);
    }

    return $merged;
}

function smsGetOrCreateConversation($pdo, $user_id, $phone, $lead_id = null) {
    $stmt = $pdo->prepare("SELECT * FROM sms_conversations WHERE user_id = ? AND phone = ?");
    $stmt->execute([$user_id, $phone]);
    $conv = $stmt->fetch();

    if ($conv) {
        return $conv;
    }

    $stmt = $pdo->prepare("INSERT INTO sms_conversations (user_id, lead_id, phone, status, last_message_at) VALUES (?, ?, ?, 'ai_active', NOW())");
    $stmt->execute([$user_id, $lead_id, $phone]);
    $id = $pdo->lastInsertId();

    $stmt = $pdo->prepare("SELECT * FROM sms_conversations WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
}

function smsUpsertLead($pdo, $user_id, $phone, $updates = []) {
    $stmt = $pdo->prepare("SELECT * FROM leads WHERE user_id = ? AND phone = ?");
    $stmt->execute([$user_id, $phone]);
    $lead = $stmt->fetch();

    if ($lead) {
        $fields = [];
        $params = [];
        foreach (['status', 'notes'] as $field) {
            if (isset($updates[$field])) {
                $fields[] = "$field = ?";
                $params[] = $updates[$field];
            }
        }
        if (!empty($updates['name'])) {
            $parts = explode(' ', trim($updates['name']), 2);
            $fields[] = "first_name = ?";
            $params[] = $parts[0];
            $fields[] = "last_name = ?";
            $params[] = $parts[1] ?? '';
        }
        if (!empty($fields)) {
            $params[] = $lead['id'];
            $pdo->prepare("UPDATE leads SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ?")->execute($params);
        }
        return $lead['id'];
    }

    $name = $updates['name'] ?? 'Unknown Lead';
    $parts = explode(' ', trim($name), 2);
    $stmt = $pdo->prepare("
        INSERT INTO leads (user_id, first_name, last_name, phone, source, source_details, status, notes)
        VALUES (?, ?, ?, ?, 'ai_outreach', 'SMS Dispatch', 'new', ?)
    ");
    $stmt->execute([$user_id, $parts[0], $parts[1] ?? '', $phone, $updates['notes'] ?? '']);
    return $pdo->lastInsertId();
}

function smsLogMessage($pdo, $user_id, $lead_id, $conversation, $direction, $content) {
    $pdo->prepare("
        INSERT INTO lead_activities (lead_id, user_id, activity_type, direction, content)
        VALUES (?, ?, 'sms', ?, ?)
    ")->execute([$lead_id, $user_id, $direction, $content]);

    $unreadDelta = ($direction === 'inbound') ? 1 : 0;
    $pdo->prepare("
        UPDATE sms_conversations
        SET last_message_at = NOW(), unread_count = unread_count + ?
        WHERE id = ?
    ")->execute([$unreadDelta, $conversation['id']]);
}

function smsCheckAvailability($pdo, $user_id) {
    $stmt = $pdo->prepare("SELECT * FROM sms_availability WHERE user_id = ? ORDER BY day_of_week, start_time");
    $stmt->execute([$user_id]);
    $slots = $stmt->fetchAll();

    $booked = $pdo->prepare("
        SELECT start_time FROM sms_appointments
        WHERE user_id = ? AND status != 'cancelled' AND start_time >= NOW()
    ");
    $booked->execute([$user_id]);
    $bookedTimes = array_column($booked->fetchAll(), 'start_time');

    $dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    $available = [];
    $today = new DateTime('today');

    // Project each recurring slot onto the next 7 days
    for ($offset = 0; $offset < 7; $offset++) {
        $date = (clone $today)->modify("+$offset days");
        $dow = (int)$date->format('w');

        foreach ($slots as $slot) {
            if ((int)$slot['day_of_week'] !== $dow) continue;

            $startDateTime = $date->format('Y-m-d') . ' ' . $slot['start_time'];
            if (new DateTime($startDateTime) < new DateTime()) continue;
            if (in_array($startDateTime, $bookedTimes)) continue;

            $available[] = [
                'dayName' => $dayNames[$dow],
                'date' => $date->format('Y-m-d'),
                'startTime' => $startDateTime,
                'endTime' => $date->format('Y-m-d') . ' ' . $slot['end_time'],
                'label' => substr($slot['start_time'], 0, 5) . ' to ' . substr($slot['end_time'], 0, 5)
            ];
        }
    }

    return array_slice($available, 0, 10);
}

function smsCreateAppointment($pdo, $user_id, $lead_id, $args, $durationMinutes) {
    $start = new DateTime($args['startTime']);
    $end = (clone $start)->modify("+{$durationMinutes} minutes");

    $stmt = $pdo->prepare("
        INSERT INTO sms_appointments (user_id, lead_id, client_name, client_phone, service_type, start_time, end_time, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', 'Booked automatically by AI agent.')
    ");
    $stmt->execute([
        $user_id, $lead_id, $args['clientName'], $args['clientPhone'], $args['serviceType'],
        $start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')
    ]);
    $appointment_id = $pdo->lastInsertId();

    smsUpsertLead($pdo, $user_id, $args['clientPhone'], [
        'name' => $args['clientName'],
        'status' => 'qualified',
        'notes' => 'Appointment confirmed for ' . $start->format('Y-m-d H:i')
    ]);

    // Schedule a reminder 1 hour before the appointment
    $sendAt = (clone $start)->modify('-1 hour');
    $message = "Hi {$args['clientName']}, this is a reminder for your {$args['serviceType']} at " . $start->format('g:i A') . ". Reply STOP to opt out.";
    $pdo->prepare("
        INSERT INTO sms_reminders (user_id, appointment_id, recipient_phone, recipient_name, message, send_at, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
    ")->execute([$user_id, $appointment_id, $args['clientPhone'], $args['clientName'], $message, $sendAt->format('Y-m-d H:i:s')]);

    return ['success' => true, 'appointment_id' => $appointment_id, 'start_time' => $start->format('Y-m-d H:i:s')];
}

function smsEscalateToHuman($pdo, $user_id, $lead_id, $phone, $leadName, $reason, $notes = '') {
    $stmt = $pdo->prepare("
        INSERT INTO sms_handoffs (user_id, lead_id, phone, lead_name, reason, status, notes)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
    ");
    $stmt->execute([$user_id, $lead_id, $phone, $leadName, $reason, $notes]);

    smsUpsertLead($pdo, $user_id, $phone, ['status' => 'contacted', 'notes' => "Human handoff triggered: $reason"]);
    $pdo->prepare("UPDATE sms_conversations SET status = 'human_handoff' WHERE user_id = ? AND phone = ?")->execute([$user_id, $phone]);

    return ['success' => true, 'handoff_id' => $pdo->lastInsertId()];
}

function smsIsOptOut($text, $optOutStrings) {
    $lower = strtolower(trim($text));
    foreach ($optOutStrings as $word) {
        $word = strtolower($word);
        if ($lower === $word || strpos($lower, $word . ' ') === 0) return true;
    }
    return false;
}

function smsContainsBlockedWords($text, $blockedWords) {
    $lower = strtolower($text);
    foreach ($blockedWords as $word) {
        if (stripos($lower, strtolower($word)) !== false) return true;
    }
    return false;
}

/**
 * Runs the given text through the OpenAI function-calling agent.
 * Returns null if no key is configured or the call fails, so callers fall back to rules.
 */
function smsRunOpenAIAgent($pdo, $user_id, $lead_id, $phone, $leadName, $text, $settings) {
    $apiKey = $settings['openaiApiKey'] ?? '';
    if (empty($apiKey)) return null;

    $historyStmt = $pdo->prepare("
        SELECT direction, content FROM lead_activities
        WHERE lead_id = ? AND activity_type = 'sms'
        ORDER BY created_at DESC LIMIT 15
    ");
    $historyStmt->execute([$lead_id]);
    $history = array_reverse($historyStmt->fetchAll());

    $messages = [[
        'role' => 'system',
        'content' => $settings['systemPrompt'] . "\n\nCURRENT CONTEXT:\n- Customer phone: $phone\n- Customer name: $leadName\n" .
            "- Standard appointment duration: {$settings['appointmentDurationMinutes']} minutes.\n" .
            "- Available services: " . implode(', ', $settings['availableServices']) . "\n" .
            "Always call check_availability before confirming a time."
    ]];

    foreach ($history as $msg) {
        $messages[] = [
            'role' => $msg['direction'] === 'inbound' ? 'user' : 'assistant',
            'content' => $msg['content']
        ];
    }
    $messages[] = ['role' => 'user', 'content' => $text];

    $tools = [
        [
            'type' => 'function',
            'function' => [
                'name' => 'check_availability',
                'description' => 'Checks available scheduling slots for the next 7 days.',
                'parameters' => ['type' => 'object', 'properties' => new stdClass()]
            ]
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'create_appointment',
                'description' => 'Books an appointment once day, time, service, and name are confirmed.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'clientName' => ['type' => 'string'],
                        'clientPhone' => ['type' => 'string'],
                        'serviceType' => ['type' => 'string'],
                        'startTime' => ['type' => 'string', 'description' => 'ISO 8601 date-time, e.g. 2026-07-07 14:00:00']
                    ],
                    'required' => ['clientName', 'clientPhone', 'serviceType', 'startTime']
                ]
            ]
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'escalate_to_human',
                'description' => 'Escalates the conversation to a human operator (angry customer, refund request, risky topic, or confusion).',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'reason' => ['type' => 'string', 'enum' => ['confused', 'risky', 'angry', 'payment_related', 'manual']]
                    ],
                    'required' => ['reason']
                ]
            ]
        ]
    ];

    $callOpenAI = function($messages) use ($apiKey, $tools) {
        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'model' => 'gpt-4o-mini',
            'messages' => $messages,
            'tools' => $tools,
            'tool_choice' => 'auto',
            'temperature' => 0.7
        ]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) return null;
        return json_decode($response, true);
    };

    $result = $callOpenAI($messages);
    if (!$result || empty($result['choices'])) return null;

    $choice = $result['choices'][0]['message'];
    $toolCalls = $choice['tool_calls'] ?? [];

    if (empty($toolCalls)) {
        return $choice['content'] ?? null;
    }

    $messages[] = $choice;

    foreach ($toolCalls as $call) {
        $name = $call['function']['name'];
        $args = json_decode($call['function']['arguments'], true) ?: [];
        $toolResult = ['success' => false];

        if ($name === 'check_availability') {
            $toolResult = ['availableSlots' => smsCheckAvailability($pdo, $user_id)];
        } elseif ($name === 'create_appointment') {
            $toolResult = smsCreateAppointment($pdo, $user_id, $lead_id, $args, $settings['appointmentDurationMinutes']);
        } elseif ($name === 'escalate_to_human') {
            $toolResult = smsEscalateToHuman($pdo, $user_id, $lead_id, $phone, $leadName, $args['reason'] ?? 'manual', "AI agent auto-escalation from SMS: \"$text\"");
        }

        $messages[] = [
            'role' => 'tool',
            'tool_call_id' => $call['id'],
            'content' => json_encode($toolResult)
        ];
    }

    $followUp = $callOpenAI($messages);
    if ($followUp && !empty($followUp['choices'])) {
        return $followUp['choices'][0]['message']['content'] ?? 'Got it — updated your booking. Anything else I can help with?';
    }

    return 'Got it — updated your booking. Anything else I can help with?';
}

/**
 * Rules-based fallback used when no OpenAI key is configured (simulation mode).
 */
function smsRunFallbackAgent($pdo, $user_id, $lead_id, $phone, $leadName, $text, $settings) {
    $lower = strtolower($text);

    if (preg_match('/\b(hello|hi|hey)\b/', $lower)) {
        return "Hi there! I can help you schedule " . implode(', ', $settings['availableServices']) . ". What are you looking for today? (Simulation Mode)";
    }

    if (strpos($lower, 'refund') !== false || strpos($lower, 'supervisor') !== false || strpos($lower, 'angry') !== false || strpos($lower, 'bad service') !== false) {
        smsEscalateToHuman($pdo, $user_id, $lead_id, $phone, $leadName, 'angry', "Customer texted: \"$text\"");
        return "I'm sorry to hear that. I've escalated this to a human support agent who will follow up with you directly.";
    }

    if (strpos($lower, 'yes') !== false || strpos($lower, 'confirm') !== false || strpos($lower, 'book') !== false) {
        $slots = smsCheckAvailability($pdo, $user_id);
        if (!empty($slots)) {
            $slot = $slots[0];
            smsCreateAppointment($pdo, $user_id, $lead_id, [
                'clientName' => $leadName === 'Unknown Lead' ? 'New Lead' : $leadName,
                'clientPhone' => $phone,
                'serviceType' => $settings['availableServices'][0],
                'startTime' => $slot['startTime']
            ], $settings['appointmentDurationMinutes']);
            $when = (new DateTime($slot['startTime']))->format('D, M j \a\t g:i A');
            return "Confirmed! Booked for $when. You'll receive a text reminder shortly. (Simulation Mode)";
        }
        return "I don't see any open slots right now — a team member will follow up to find a time.";
    }

    $slots = smsCheckAvailability($pdo, $user_id);
    if (!empty($slots)) {
        $when = (new DateTime($slots[0]['startTime']))->format('D, M j \a\t g:i A');
        return "We have an opening $when. Does that work for you? (Simulation Mode)";
    }

    return "Thanks for reaching out! Let me check our availability and get back to you shortly. (Simulation Mode)";
}

/**
 * Main entry point: process one inbound SMS and return the reply text.
 */
function processIncomingSMS($pdo, $user_id, $phone, $text) {
    $settings = getSmsSettings($pdo, $user_id);
    $lead_id = smsUpsertLead($pdo, $user_id, $phone);
    $conversation = smsGetOrCreateConversation($pdo, $user_id, $phone, $lead_id);

    smsLogMessage($pdo, $user_id, $lead_id, $conversation, 'inbound', $text);

    $leadStmt = $pdo->prepare("SELECT first_name, last_name FROM leads WHERE id = ?");
    $leadStmt->execute([$lead_id]);
    $leadRow = $leadStmt->fetch();
    $leadName = $leadRow ? trim($leadRow['first_name'] . ' ' . $leadRow['last_name']) : 'Unknown Lead';
    if ($leadName === '') $leadName = 'Unknown Lead';

    // 1. Compliance: opt-out
    if (smsIsOptOut($text, $settings['optOutStrings'])) {
        smsUpsertLead($pdo, $user_id, $phone, ['status' => 'nurture', 'notes' => 'Opted out of SMS communications']);
        $reply = "You have been opted out of further notifications. Reply START to rejoin.";
        smsLogMessage($pdo, $user_id, $lead_id, $conversation, 'outbound', $reply);
        return $reply;
    }

    // 2. Compliance: blocked words -> immediate escalation, no AI reply
    if (smsContainsBlockedWords($text, $settings['blockedWords'])) {
        smsEscalateToHuman($pdo, $user_id, $lead_id, $phone, $leadName, 'risky', "Blocked word triggered. Customer texted: \"$text\"");
        $reply = "Thank you for reaching out. We've transferred your inquiry to a team member who will review it shortly.";
        smsLogMessage($pdo, $user_id, $lead_id, $conversation, 'outbound', $reply);
        return $reply;
    }

    // 3. If already escalated, suppress AI replies
    if ($conversation['status'] === 'human_handoff') {
        return "A team member has been alerted and will reply to you directly soon.";
    }

    // 4. Global AI-off switch
    if (!$settings['allowAIReplies']) {
        smsEscalateToHuman($pdo, $user_id, $lead_id, $phone, $leadName, 'manual', 'AI replies disabled. Waiting for human response.');
        return "Thank you. We're routing your message to our team.";
    }

    // 5. Try the OpenAI agent, fall back to rules engine
    $reply = smsRunOpenAIAgent($pdo, $user_id, $lead_id, $phone, $leadName, $text, $settings);
    if (empty($reply)) {
        $reply = smsRunFallbackAgent($pdo, $user_id, $lead_id, $phone, $leadName, $text, $settings);
    }

    smsLogMessage($pdo, $user_id, $lead_id, $conversation, 'outbound', $reply);
    return $reply;
}
