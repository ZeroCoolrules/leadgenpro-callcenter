<?php
/**
 * LeadGen Pro - Agentic SMS Dispatch: Appointments
 * GET    /api/sms-appointments.php            - list upcoming appointments
 * POST   /api/sms-appointments.php            - manually create an appointment
 * DELETE /api/sms-appointments.php?id=123     - cancel an appointment
 */

require_once 'config.php';
require_once 'sms-agent.php';

$user_id = validateApiKey($pdo);
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->prepare("
            SELECT * FROM sms_appointments
            WHERE user_id = ?
            ORDER BY start_time DESC
            LIMIT 200
        ");
        $stmt->execute([$user_id]);
        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        $required = ['clientName', 'clientPhone', 'serviceType', 'startTime'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                jsonResponse(['success' => false, 'error' => "$field is required"], 400);
            }
        }

        $settings = getSmsSettings($pdo, $user_id);
        $lead_id = smsUpsertLead($pdo, $user_id, sanitize($data['clientPhone']), ['name' => sanitize($data['clientName'])]);

        $result = smsCreateAppointment($pdo, $user_id, $lead_id, [
            'clientName' => sanitize($data['clientName']),
            'clientPhone' => sanitize($data['clientPhone']),
            'serviceType' => sanitize($data['serviceType']),
            'startTime' => $data['startTime']
        ], $settings['appointmentDurationMinutes']);

        jsonResponse(['success' => true, 'data' => $result], 201);
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);
        if (!$id) {
            jsonResponse(['success' => false, 'error' => 'Appointment ID required'], 400);
        }

        $stmt = $pdo->prepare("UPDATE sms_appointments SET status = 'cancelled' WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $user_id]);

        if ($stmt->rowCount() === 0) {
            jsonResponse(['success' => false, 'error' => 'Appointment not found'], 404);
        }

        jsonResponse(['success' => true, 'message' => 'Appointment cancelled']);
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}
