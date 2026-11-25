<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
$method  = admin_method();
$payload = $method === 'POST' ? read_json_body() : [];
$action  = admin_action($payload);
$pdo     = db();

/** Whitelisted keys and validators. Unknown keys are rejected. */
function admin_validate_setting(string $key, mixed $value): ?string {
    switch ($key) {
        case 'escrow_platform_fee_bps':
        case 'live_gift_platform_fee_bps':
            return is_int($value) && $value >= 0 && $value <= 3000 ? null : 'BPS_OUT_OF_RANGE';
        case 'gift_catalog':
            if (!is_array($value) || count($value) !== 18) {
                return 'GIFT_CATALOG_MUST_HAVE_18_ITEMS';
            }
            foreach ($value as $g) {
                if (!is_array($g) || !preg_match('/^[A-Z0-9_]{3,40}$/', (string)($g['code'] ?? ''))
                    || mb_strlen(trim((string)($g['titleTr'] ?? ''))) < 2
                    || !is_int($g['coins'] ?? null) || $g['coins'] < 1 || $g['coins'] > 100000
                    || !is_bool($g['active'] ?? null)) {
                    return 'INVALID_GIFT_ITEM';
                }
            }
            return null;
        case 'profession_clusters':
            if (!is_array($value) || $value === []) {
                return 'CLUSTERS_REQUIRED';
            }
            foreach ($value as $c) {
                if (!is_array($c) || !preg_match('/^[A-Z_]{3,40}$/', (string)($c['code'] ?? '')) || mb_strlen(trim((string)($c['titleTr'] ?? ''))) < 2) {
                    return 'INVALID_CLUSTER';
                }
            }
            return null;
        case 'notification_templates':
            if (!is_array($value)) {
                return 'TEMPLATES_REQUIRED';
            }
            foreach ($value as $k => $t) {
                if (!preg_match('/^[a-z_]{3,40}$/', (string)$k) || !is_string($t) || mb_strlen($t) > 500) {
                    return 'INVALID_TEMPLATE';
                }
            }
            return null;
        default:
            return 'UNKNOWN_SETTING_KEY';
    }
}

if ($method === 'GET' && $action === 'list') {
    require_admin_permission('settings.view');
    $current = $pdo->prepare(
        'SELECT s.setting_key, s.setting_value_json, s.effective_from, s.created_at, a.full_name AS created_by
         FROM platform_settings s JOIN admin_users a ON a.id = s.created_by_admin_id
         ORDER BY s.setting_key ASC, s.effective_from DESC LIMIT 500'
    );
    $current->execute();
    json_response(['success' => true, 'rows' => $current->fetchAll(), 'server_time_utc' => gmdate('Y-m-d H:i:s')]);
}

if ($method !== 'POST' || $action !== 'set') {
    json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
}

$admin = require_admin_permission('settings.edit');
require_admin_csrf($admin);
$reason = require_admin_reason($payload);
$key = (string)($payload['key'] ?? '');
$value = $payload['value'] ?? null;
$error = admin_validate_setting($key, $value);
if ($error !== null) {
    json_response(['success' => false, 'error' => $error], 422);
}
$effective = (string)($payload['effective_from'] ?? '');
$effectiveTs = $effective === '' ? time() : strtotime($effective . ' UTC');
// No retroactive changes: a new version can only start now or in the future.
if ($effectiveTs === false || $effectiveTs < time() - 60) {
    json_response(['success' => false, 'error' => 'RETROACTIVE_CHANGE_FORBIDDEN', 'message' => 'Değişiklik geçmiş bir tarihten başlatılamaz.'], 422);
}
$effectiveAt = gmdate('Y-m-d H:i:s', max($effectiveTs, time()));

$pdo->beginTransaction();
try {
    $prev = $pdo->prepare('SELECT setting_value_json FROM platform_settings WHERE setting_key = :k ORDER BY effective_from DESC LIMIT 1 FOR UPDATE');
    $prev->execute([':k' => $key]);
    $before = $prev->fetchColumn();
    $ins = $pdo->prepare('INSERT INTO platform_settings (setting_key, setting_value_json, effective_from, created_by_admin_id) VALUES (:k, :v, :e, :a)');
    $ins->execute([':k' => $key, ':v' => json_encode(['value' => $value], JSON_UNESCAPED_UNICODE), ':e' => $effectiveAt, ':a' => $admin['id']]);
    admin_audit($admin, 'SETTING_VERSION_CREATED', 'SETTING', $key,
        $before !== false ? (json_decode((string)$before, true) ?: null) : null,
        ['value' => $value, 'effective_from' => $effectiveAt], $reason);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}
json_response(['success' => true, 'effective_from' => $effectiveAt]);
