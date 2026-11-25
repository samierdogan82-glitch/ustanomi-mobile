<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
$method  = admin_method();
$payload = $method === 'POST' ? read_json_body() : [];
$action  = admin_action($payload);
$pdo     = db();

if ($method === 'GET' && $action === 'list') {
    require_admin_permission('moderation.view');
    $status = (string)($_GET['status'] ?? 'OPEN');
    if (!in_array($status, ['OPEN', 'HIDDEN', 'DELETED', 'WARNED', 'DISMISSED'], true)) {
        $status = 'OPEN';
    }
    $stmt = $pdo->prepare(
        'SELECT r.id, r.target_type, r.target_id, r.target_owner_user_id, r.reason_code, r.details, r.status, r.created_at,
                u.full_name AS reporter_name
         FROM moderation_reports r JOIN users u ON u.id = r.reporter_user_id
         WHERE r.status = :s ORDER BY r.id ASC LIMIT 200'
    );
    $stmt->execute([':s' => $status]);
    json_response(['success' => true, 'rows' => $stmt->fetchAll()]);
}

if ($method !== 'POST' || $action !== 'act') {
    json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
}

$admin = require_admin_permission('moderation.act');
require_admin_csrf($admin);
$reason = require_admin_reason($payload, 5);
$reportId = (int)($payload['report_id'] ?? 0);
$decision = (string)($payload['decision'] ?? '');
$statusMap = ['hide' => 'HIDDEN', 'delete' => 'DELETED', 'warn' => 'WARNED', 'dismiss' => 'DISMISSED'];
if (!isset($statusMap[$decision])) {
    json_response(['success' => false, 'error' => 'INVALID_DECISION'], 422);
}

$pdo->beginTransaction();
try {
    $lock = $pdo->prepare('SELECT id, target_type, target_id, target_owner_user_id, status FROM moderation_reports WHERE id = :id FOR UPDATE');
    $lock->execute([':id' => $reportId]);
    $rep = $lock->fetch();
    if (!$rep || $rep['status'] !== 'OPEN') {
        $pdo->rollBack();
        json_response(['success' => false, 'error' => 'REPORT_NOT_OPEN'], 409);
    }
    $targetId = (int)$rep['target_id'];
    if ($decision === 'hide' || $decision === 'delete') {
        $state = $decision === 'hide' ? 'HIDDEN' : 'DELETED';
        // Soft delete only: content stays for legal retention, but is no longer shown.
        if ($rep['target_type'] === 'TALENT_POST') {
            $u = $pdo->prepare('UPDATE talent_posts SET moderation_state = :s WHERE id = :id');
            $u->execute([':s' => $state, ':id' => $targetId]);
        } elseif ($rep['target_type'] === 'DM_MESSAGE') {
            $u = $pdo->prepare('UPDATE dm_messages SET moderation_state = :s WHERE id = :id');
            $u->execute([':s' => $state, ':id' => $targetId]);
        } elseif ($rep['target_type'] === 'LIVE_STREAM') {
            $u = $pdo->prepare("UPDATE live_work_streams SET stream_status = 'SUSPENDED', suspended_by_admin_id = :a, suspended_reason = :r WHERE id = :id AND stream_status = 'LIVE'");
            $u->execute([':a' => $admin['id'], ':r' => $reason, ':id' => $targetId]);
        }
    }
    $upd = $pdo->prepare('UPDATE moderation_reports SET status = :s, handled_by_admin_id = :a, handled_at = NOW() WHERE id = :id');
    $upd->execute([':s' => $statusMap[$decision], ':a' => $admin['id'], ':id' => $reportId]);
    admin_audit($admin, 'MODERATION_' . strtoupper($decision), 'MODERATION_REPORT', (string)$reportId,
        ['status' => 'OPEN'], ['status' => $statusMap[$decision], 'target_type' => $rep['target_type'], 'target_id' => $targetId], $reason);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}
json_response(['success' => true, 'status' => $statusMap[$decision]]);
