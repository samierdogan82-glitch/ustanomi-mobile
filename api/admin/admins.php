<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
$method  = admin_method();
$payload = $method === 'POST' ? read_json_body() : [];
$action  = admin_action($payload);
$pdo     = db();
$roles   = ['SUPER_ADMIN', 'FINANCE', 'MODERATOR', 'SUPPORT'];

if ($method === 'GET' && $action === 'list') {
    require_admin_permission('admins.manage');
    $stmt = $pdo->prepare('SELECT id, email, full_name, role, is_active, totp_enabled, linked_user_id, last_login_at, created_at FROM admin_users ORDER BY id ASC');
    $stmt->execute();
    json_response(['success' => true, 'rows' => $stmt->fetchAll()]);
}

if ($method !== 'POST') {
    json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
}

$admin = require_admin_permission('admins.manage');
require_admin_csrf($admin);

if ($action === 'create') {
    $email = mb_strtolower(trim((string)($payload['email'] ?? '')));
    $name = trim((string)($payload['full_name'] ?? ''));
    $role = (string)($payload['role'] ?? '');
    $password = (string)($payload['password'] ?? '');
    $linked = isset($payload['linked_user_id']) && $payload['linked_user_id'] !== null ? (int)$payload['linked_user_id'] : null;
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($name) < 3 || !in_array($role, $roles, true)) {
        json_response(['success' => false, 'error' => 'INVALID_INPUT'], 422);
    }
    if (strlen($password) < 12 || !preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/\d/', $password)) {
        json_response(['success' => false, 'error' => 'WEAK_PASSWORD', 'message' => 'En az 12 karakter, büyük/küçük harf ve rakam.'], 422);
    }
    $rawSecret = random_bytes(20);
    $stmt = $pdo->prepare(
        'INSERT INTO admin_users (email, password_hash, full_name, role, totp_secret_enc, totp_enabled, linked_user_id, created_by_admin_id)
         VALUES (:e, :h, :n, :r, :t, 1, :l, :c)'
    );
    try {
        $stmt->execute([
            ':e' => $email, ':h' => password_hash($password, PASSWORD_DEFAULT), ':n' => $name, ':r' => $role,
            ':t' => admin_encrypt_totp_secret($rawSecret), ':l' => $linked, ':c' => $admin['id'],
        ]);
    } catch (PDOException) {
        json_response(['success' => false, 'error' => 'EMAIL_ALREADY_EXISTS'], 409);
    }
    $newId = (int)$pdo->lastInsertId();
    admin_audit($admin, 'ADMIN_CREATED', 'ADMIN', (string)$newId, null, ['email' => $email, 'role' => $role], '');
    // The otpauth URI is returned exactly once so the new admin can scan it; it is never stored in plain text.
    $secret = admin_base32_encode($rawSecret);
    json_response([
        'success'  => true,
        'admin_id' => $newId,
        'otpauth'  => 'otpauth://totp/Ustanomi%20Admin:' . rawurlencode($email) . '?secret=' . $secret . '&issuer=Ustanomi&digits=6&period=30',
    ], 201);
}

$targetId = (int)($payload['admin_id'] ?? 0);
if ($targetId === $admin['id']) {
    json_response(['success' => false, 'error' => 'CANNOT_MODIFY_SELF'], 403);
}

if ($action === 'set_role') {
    $role = (string)($payload['role'] ?? '');
    if (!in_array($role, $roles, true)) {
        json_response(['success' => false, 'error' => 'INVALID_ROLE'], 422);
    }
    $prev = $pdo->prepare('SELECT role FROM admin_users WHERE id = :id');
    $prev->execute([':id' => $targetId]);
    $before = $prev->fetchColumn();
    if ($before === false) {
        json_response(['success' => false, 'error' => 'ADMIN_NOT_FOUND'], 404);
    }
    $upd = $pdo->prepare('UPDATE admin_users SET role = :r WHERE id = :id');
    $upd->execute([':r' => $role, ':id' => $targetId]);
    // Force re-login so the new role takes effect immediately.
    $rev = $pdo->prepare('UPDATE admin_sessions SET revoked_at = NOW() WHERE admin_user_id = :id AND revoked_at IS NULL');
    $rev->execute([':id' => $targetId]);
    admin_audit($admin, 'ADMIN_ROLE_CHANGED', 'ADMIN', (string)$targetId, ['role' => $before], ['role' => $role], '');
    json_response(['success' => true]);
}

if ($action === 'deactivate' || $action === 'activate') {
    $flag = $action === 'activate' ? 1 : 0;
    $upd = $pdo->prepare('UPDATE admin_users SET is_active = :f WHERE id = :id');
    $upd->execute([':f' => $flag, ':id' => $targetId]);
    if ($flag === 0) {
        $rev = $pdo->prepare('UPDATE admin_sessions SET revoked_at = NOW() WHERE admin_user_id = :id AND revoked_at IS NULL');
        $rev->execute([':id' => $targetId]);
    }
    admin_audit($admin, $flag === 1 ? 'ADMIN_ACTIVATED' : 'ADMIN_DEACTIVATED', 'ADMIN', (string)$targetId, null, ['is_active' => $flag], '');
    json_response(['success' => true]);
}

json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
