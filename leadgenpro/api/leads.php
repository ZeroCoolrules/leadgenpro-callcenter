<?php
/**
 * LeadGen Pro - Leads API
 * GET /api/leads.php - List all leads
 * POST /api/leads.php - Create new lead
 * PUT /api/leads.php - Update lead
 * DELETE /api/leads.php?id=123 - Delete lead
 */

require_once 'config.php';
$method = $_SERVER['REQUEST_METHOD'];
$user_id = validateApiKey($pdo);

switch ($method) {
    case 'GET':
        // Get leads with optional filters
        $page = intval($_GET['page'] ?? 1);
        $limit = intval($_GET['limit'] ?? 50);
        $offset = ($page - 1) * $limit;

        $where = ["user_id = ?"];
        $params = [$user_id];

        // Apply filters
        if (!empty($_GET['status'])) {
            $where[] = "status = ?";
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['quality'])) {
            $where[] = "quality = ?";
            $params[] = $_GET['quality'];
        }
        if (!empty($_GET['source'])) {
            $where[] = "source = ?";
            $params[] = $_GET['source'];
        }
        if (!empty($_GET['search'])) {
            $search = "%{$_GET['search']}%";
            $where[] = "(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company_name LIKE ?)";
            $params = array_merge($params, [$search, $search, $search, $search]);
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM leads WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetch()['total'];

        // Get leads
        $sql = "SELECT * FROM leads WHERE $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array_merge($params, [$limit, $offset]));
        $leads = $stmt->fetchAll();

        jsonResponse([
            'success' => true,
            'data' => $leads,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => ceil($total / $limit)
            ]
        ]);
        break;

    case 'POST':
        // Create new lead
        $data = json_decode(file_get_contents('php://input'), true);

        $required = ['first_name', 'last_name'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                jsonResponse(['success' => false, 'error' => "$field is required"], 400);
            }
        }

        $sql = "INSERT INTO leads (
            user_id, first_name, last_name, email, phone, company_name, 
            job_title, website, linkedin_url, industry, company_size,
            source, source_details, quality, status, notes, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $user_id,
            sanitize($data['first_name']),
            sanitize($data['last_name']),
            sanitize($data['email'] ?? ''),
            sanitize($data['phone'] ?? ''),
            sanitize($data['company_name'] ?? ''),
            sanitize($data['job_title'] ?? ''),
            sanitize($data['website'] ?? ''),
            sanitize($data['linkedin_url'] ?? ''),
            sanitize($data['industry'] ?? ''),
            $data['company_size'] ?? null,
            $data['source'] ?? 'manual_entry',
            sanitize($data['source_details'] ?? ''),
            $data['quality'] ?? 'warm',
            'new',
            sanitize($data['notes'] ?? ''),
            json_encode($data['tags'] ?? [])
        ]);

        $lead_id = $pdo->lastInsertId();

        jsonResponse([
            'success' => true,
            'message' => 'Lead created successfully',
            'data' => ['id' => $lead_id]
        ], 201);
        break;

    case 'PUT':
        // Update lead
        $data = json_decode(file_get_contents('php://input'), true);
        $id = intval($data['id'] ?? 0);

        if (!$id) {
            jsonResponse(['success' => false, 'error' => 'Lead ID required'], 400);
        }

        // Verify ownership
        $check = $pdo->prepare("SELECT id FROM leads WHERE id = ? AND user_id = ?");
        $check->execute([$id, $user_id]);
        if (!$check->fetch()) {
            jsonResponse(['success' => false, 'error' => 'Lead not found'], 404);
        }

        $allowed = ['first_name', 'last_name', 'email', 'phone', 'company_name', 
                   'job_title', 'status', 'quality', 'notes', 'assigned_to'];
        $updates = [];
        $params = [];

        foreach ($allowed as $field) {
            if (isset($data[$field])) {
                $updates[] = "$field = ?";
                $params[] = is_string($data[$field]) ? sanitize($data[$field]) : $data[$field];
            }
        }

        if (empty($updates)) {
            jsonResponse(['success' => false, 'error' => 'No fields to update'], 400);
        }

        $params[] = $id;
        $sql = "UPDATE leads SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        jsonResponse(['success' => true, 'message' => 'Lead updated successfully']);
        break;

    case 'DELETE':
        // Delete lead
        $id = intval($_GET['id'] ?? 0);

        if (!$id) {
            jsonResponse(['success' => false, 'error' => 'Lead ID required'], 400);
        }

        $stmt = $pdo->prepare("DELETE FROM leads WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $user_id]);

        if ($stmt->rowCount() === 0) {
            jsonResponse(['success' => false, 'error' => 'Lead not found'], 404);
        }

        jsonResponse(['success' => true, 'message' => 'Lead deleted successfully']);
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}
?>
