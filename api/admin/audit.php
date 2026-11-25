<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
if (admin_method() !== 'GET') {
    // The audit trail is append-only: there is deliberately no update or delete action.
    json_response(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
}
$action = admin_action();
$pdo = db();

if ($action === 'list') {
    require_admin_permission('audit.view');
    $p = admin_pagination();
    $where = ['1=1'];
    $params = [];
    $actionFilter = (string)($_GET['filter_action'] ?? '');
    if (preg_match('/^[A-Z_]{2,80}$/', $actionFilter)) {
        $where[] = 'l.action = :act';
        $params[':act'] = $actionFilter;
    }
    $targetType = (string)($_GET['target_type'] ?? '');
    if (preg_match('/^[A-Z_]{2,50}$/', $targetType)) {
        $where[] = 'l.target_type = :tt';
        $params[':tt'] = $targetType;
    }
    $stmt = $pdo->prepare(
        'SELECT l.id, l.created_at, l.admin_role, a.full_name AS admin_name, l.action, l.target_type, l.target_id,
                l.before_json, l.after_json, l.reason, l.ip_address
         FROM admin_audit_log l LEFT JOIN admin_users a ON a.id = l.admin_user_id
         WHERE ' . implode(' AND ', $where) . '
         ORDER BY l.id DESC LIMIT :lim OFFSET :off'
    );
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':lim', $p['limit'], PDO::PARAM_INT);
    $stmt->bindValue(':off', $p['offset'], PDO::PARAM_INT);
    $stmt->execute();
    json_response(['success' => true, 'rows' => $stmt->fetchAll()]);
}

if ($action === 'verify_chain') {
    require_admin_permission('audit.view');
    $stmt = $pdo->prepare(
        'SELECT id, admin_user_id, admin_role, action, target_type, target_id, before_json, after_json, reason, ip_address, prev_hash, row_hash,
                DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') AS ts
         FROM admin_audit_log ORDER BY id ASC'
    );
    $stmt->execute();
    $expectedPrev = str_repeat('0', 64);
    $checked = 0;
    while ($r = $stmt->fetch()) {
        $hash = admin_audit_row_hash(
            (string)$r['prev_hash'], $r['admin_user_id'] !== null ? (int)$r['admin_user_id'] : null, (string)$r['admin_role'],
            (string)$r['action'], (string)$r['target_type'], $r['target_id'] !== null ? (string)$r['target_id'] : null,
            $r['before_json'] !== null ? (string)$r['before_json'] : null, $r['after_json'] !== null ? (string)$r['after_json'] : null,
            (string)$r['reason'], (string)$r['ip_address'], (string)$r['ts']
        );
        if ($r['prev_hash'] !== $expectedPrev || !hash_equals((string)$r['row_hash'], $hash)) {
            json_response(['success' => true, 'intact' => false, 'broken_at_id' => (int)$r['id'], 'checked' => $checked]);
        }
        $expectedPrev = (string)$r['row_hash'];
        $checked++;
    }
    json_response(['success' => true, 'intact' => true, 'checked' => $checked]);
}

json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
