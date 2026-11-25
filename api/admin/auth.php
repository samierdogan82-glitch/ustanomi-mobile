<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
$method  = admin_method();
$payload = $method === 'POST' ? read_json_body() : [];
$action  = admin_action($payload);

if ($method === 'GET' && $action === 'me') {
    $admin = require_admin();
    json_response([
        'success'     => true,
        'admin'       => ['id' => $admin['id'], 'email' => $admin['email'], 'full_name' => $admin['full_name'], 'role' => $admin['role']],
        'permissions' => admin_permissions_for($admin['role']),
        'csrf'        => $admin['csrf_token'],
        'idleTimeoutSeconds' => (int)(admin_policy()['session']['idleTimeoutSeconds'] ?? 900),
    ]);
}

if ($method !== 'POST') {
    json_response(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
}

if ($action === 'login') {
    $email    = mb_strtolower(trim((string)($payload['email'] ?? '')));
    $password = (string)($payload['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '' || strlen($password) > 1024) {
        json_response(['success' => false, 'error' => 'INVALID_CREDENTIALS'], 401);
    }
    if (admin_login_rate_limited($email)) {
        header('Retry-After: 900');
        json_response(['success' => false, 'error' => 'RATE_LIMIT_EXCEEDED', 'message' => '15 dakika içinde 5 hatalı deneme. Lütfen bekleyin.'], 429);
    }
    $stmt = db()->prepare('SELECT id, email, password_hash, role, is_active, totp_enabled, locked_until FROM admin_users WHERE email = :e LIMIT 1');
    $stmt->execute([':e' => $email]);
    $row = $stmt->fetch();
    // Constant-time path: always run password_verify, even for unknown e-mails.
    $hash = $row ? (string)$row['password_hash'] : '$2y$12$C6UzMDM.H6dfI/f/IKcEeO5UHCb7hM8h8bXo1ybh2YsZr/qPKRo4.';
    $ok = password_verify($password, $hash);
    $locked = $row && $row['locked_until'] !== null && strtotime((string)$row['locked_until']) > time();
    if (!$row || !$ok || (int)$row['is_active'] !== 1 || $locked) {
        admin_audit(null, 'ADMIN_LOGIN_FAILED', 'ADMIN_EMAIL', $email, null, null, '');
        if ($row) {
            $upd = db()->prepare(
                'UPDATE admin_users SET failed_login_count = failed_login_count + 1,
                    locked_until = IF(failed_login_count + 1 >= 5, DATE_ADD(NOW(), INTERVAL 15 MINUTE), locked_until)
                 WHERE id = :id'
            );
            $upd->execute([':id' => (int)$row['id']]);
        }
        json_response(['success' => false, 'error' => 'INVALID_CREDENTIALS', 'message' => 'E-posta veya şifre hatalı.'], 401);
    }
    if ((int)$row['totp_enabled'] !== 1) {
        json_response(['success' => false, 'error' => 'TOTP_ENROLLMENT_REQUIRED', 'message' => '2FA kurulmamış hesap giriş yapamaz.'], 403);
    }
    if (password_needs_rehash((string)$row['password_hash'], PASSWORD_DEFAULT)) {
        $re = db()->prepare('UPDATE admin_users SET password_hash = :h WHERE id = :id');
        $re->execute([':h' => password_hash($password, PASSWORD_DEFAULT), ':id' => (int)$row['id']]);
    }
    admin_revoke_current_session();
    admin_issue_session((int)$row['id'], false);
    json_response(['success' => true, 'next' => 'TOTP']);
}

if ($action === 'totp') {
    $pending = admin_current_session();
    if ($pending === null || $pending['totp_verified']) {
        json_response(['success' => false, 'error' => 'NO_PENDING_LOGIN'], 401);
    }
    if (admin_login_rate_limited($pending['email'])) {
        admin_revoke_current_session();
        json_response(['success' => false, 'error' => 'RATE_LIMIT_EXCEEDED'], 429);
    }
    $stmt = db()->prepare('SELECT totp_secret_enc FROM admin_users WHERE id = :id AND totp_enabled = 1 LIMIT 1');
    $stmt->execute([':id' => $pending['id']]);
    $blob = $stmt->fetchColumn();
    $code = preg_replace('/\D/', '', (string)($payload['code'] ?? '')) ?? '';
    if (!is_string($blob) || !admin_totp_verify(admin_decrypt_totp_secret($blob), $code)) {
        admin_audit(null, 'ADMIN_TOTP_FAILED', 'ADMIN_EMAIL', mb_strtolower($pending['email']), null, null, '');
        json_response(['success' => false, 'error' => 'INVALID_TOTP', 'message' => 'Doğrulama kodu hatalı.'], 401);
    }
    // Rotate: the pre-2FA token is revoked and a new verified session is issued.
    admin_revoke_current_session();
    admin_issue_session($pending['id'], true);
    $reset = db()->prepare('UPDATE admin_users SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW() WHERE id = :id');
    $reset->execute([':id' => $pending['id']]);
    admin_audit($pending, 'ADMIN_LOGIN_SUCCESS', 'ADMIN', (string)$pending['id'], null, null, '');
    json_response(['success' => true]);
}

if ($action === 'logout') {
    $admin = admin_current_session();
    if ($admin !== null) {
        require_admin_csrf($admin);
        admin_audit($admin, 'ADMIN_LOGOUT', 'ADMIN', (string)$admin['id'], null, null, '');
    }
    admin_revoke_current_session();
    json_response(['success' => true]);
}

json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
