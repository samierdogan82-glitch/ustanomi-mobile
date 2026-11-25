<?php
declare(strict_types=1);
/**
 * Ustanomi Admin Console security layer.
 * - Separate admin identity (admin_users) and session (admin_sessions); never reuses the customer session.
 * - Server-side RBAC from includes/admin-rbac-policy.json. The role is always re-read from the database.
 * - Mandatory TOTP (RFC 6238), 15-minute idle timeout, 5 failed logins / 15 minutes per IP and per e-mail.
 * - Hash-chained append-only audit log, idempotency keys, four-eyes and self-dealing guards.
 */
require_once __DIR__ . '/pdo-security-bootstrap.php';

const ADMIN_DEFAULT_ESCROW_FEE_BPS = 1200;

/** @return array<string, mixed> */
function admin_policy(): array {
    static $policy = null;
    if (is_array($policy)) {
        return $policy;
    }
    $raw = file_get_contents(__DIR__ . '/admin-rbac-policy.json');
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($decoded) || !isset($decoded['permissions']) || !is_array($decoded['permissions'])) {
        json_response(['success' => false, 'error' => 'RBAC_POLICY_UNAVAILABLE'], 500);
    }
    $policy = $decoded;
    return $policy;
}

function admin_role_has(string $role, string $permission): bool {
    $permissions = admin_policy()['permissions'];
    if (!isset($permissions[$permission]) || !is_array($permissions[$permission])) {
        return false;
    }
    return in_array($role, $permissions[$permission], true);
}

/** @return list<string> */
function admin_permissions_for(string $role): array {
    $out = [];
    foreach (admin_policy()['permissions'] as $perm => $roles) {
        if (is_array($roles) && in_array($role, $roles, true)) {
            $out[] = (string)$perm;
        }
    }
    return $out;
}

function admin_client_ip(): string {
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);
}

function admin_is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ((int)($_SERVER['SERVER_PORT'] ?? 80) === 443);
}

function admin_cookie_name(): string {
    return admin_is_https() ? '__Host-ust_admin' : 'ust_admin';
}

function admin_set_cookie(string $value, int $expiresAt): void {
    setcookie(admin_cookie_name(), $value, [
        'expires'  => $expiresAt,
        'path'     => '/',
        'secure'   => admin_is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

/** Issues a fresh opaque session token. Only its SHA-256 is stored. */
function admin_issue_session(int $adminId, bool $totpVerified): void {
    $token = bin2hex(random_bytes(32));
    $csrf  = bin2hex(random_bytes(32));
    $absolute = (int)(admin_policy()['session']['absoluteTimeoutSeconds'] ?? 28800);
    $expiresAt = time() + $absolute;
    $stmt = db()->prepare(
        'INSERT INTO admin_sessions (admin_user_id, session_token_sha256, csrf_token, totp_verified, ip_address, user_agent, created_at, last_activity_at, expires_at)
         VALUES (:aid, :tok, :csrf, :totp, :ip, :ua, NOW(), NOW(), FROM_UNIXTIME(:exp))'
    );
    $stmt->execute([
        ':aid'  => $adminId,
        ':tok'  => hash('sha256', $token),
        ':csrf' => $csrf,
        ':totp' => $totpVerified ? 1 : 0,
        ':ip'   => admin_client_ip(),
        ':ua'   => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        ':exp'  => $expiresAt,
    ]);
    admin_set_cookie($token, $expiresAt);
}

function admin_revoke_current_session(): void {
    $token = (string)($_COOKIE[admin_cookie_name()] ?? '');
    if ($token !== '') {
        $stmt = db()->prepare('UPDATE admin_sessions SET revoked_at = NOW() WHERE session_token_sha256 = :tok AND revoked_at IS NULL');
        $stmt->execute([':tok' => hash('sha256', $token)]);
    }
    admin_set_cookie('', time() - 3600);
}

/**
 * Loads the current admin session. Role and active flag come from admin_users, never from the client.
 * @return array{session_id:int, id:int, email:string, full_name:string, role:string, linked_user_id:?int, csrf_token:string, totp_verified:bool}|null
 */
function admin_current_session(): ?array {
    $token = (string)($_COOKIE[admin_cookie_name()] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        return null;
    }
    $stmt = db()->prepare(
        'SELECT s.id AS session_id, s.csrf_token, s.totp_verified, s.expires_at, s.revoked_at,
                TIMESTAMPDIFF(SECOND, s.last_activity_at, NOW()) AS idle_seconds,
                a.id, a.email, a.full_name, a.role, a.linked_user_id, a.is_active
         FROM admin_sessions s
         JOIN admin_users a ON a.id = s.admin_user_id
         WHERE s.session_token_sha256 = :tok
         LIMIT 1'
    );
    $stmt->execute([':tok' => hash('sha256', $token)]);
    $row = $stmt->fetch();
    if (!$row || $row['revoked_at'] !== null || (int)$row['is_active'] !== 1) {
        return null;
    }
    $idleLimit = (int)(admin_policy()['session']['idleTimeoutSeconds'] ?? 900);
    if ((int)$row['idle_seconds'] > $idleLimit || strtotime((string)$row['expires_at']) < time()) {
        $revoke = db()->prepare('UPDATE admin_sessions SET revoked_at = NOW() WHERE id = :id');
        $revoke->execute([':id' => (int)$row['session_id']]);
        return null;
    }
    $touch = db()->prepare('UPDATE admin_sessions SET last_activity_at = NOW() WHERE id = :id');
    $touch->execute([':id' => (int)$row['session_id']]);

    return [
        'session_id'     => (int)$row['session_id'],
        'id'             => (int)$row['id'],
        'email'          => (string)$row['email'],
        'full_name'      => (string)$row['full_name'],
        'role'           => (string)$row['role'],
        'linked_user_id' => $row['linked_user_id'] !== null ? (int)$row['linked_user_id'] : null,
        'csrf_token'     => (string)$row['csrf_token'],
        'totp_verified'  => (int)$row['totp_verified'] === 1,
    ];
}

/** @return array{session_id:int, id:int, email:string, full_name:string, role:string, linked_user_id:?int, csrf_token:string, totp_verified:bool} */
function require_admin(): array {
    $admin = admin_current_session();
    if ($admin === null || !$admin['totp_verified']) {
        json_response(['success' => false, 'error' => 'ADMIN_UNAUTHORIZED', 'message' => 'Oturum süresi doldu veya 2FA tamamlanmadı.'], 401);
    }
    return $admin;
}

/** Server-side permission gate. Wrong role => HTTP 403 + audit entry. */
function require_admin_permission(string $permission): array {
    $admin = require_admin();
    if (!admin_role_has($admin['role'], $permission)) {
        admin_audit($admin, 'RBAC_DENIED', 'PERMISSION', $permission, null, null, '');
        json_response(['success' => false, 'error' => 'FORBIDDEN', 'permission' => $permission, 'message' => 'Bu işlem için yetkiniz yok.'], 403);
    }
    return $admin;
}

function require_admin_csrf(array $admin): void {
    $header = (string)($_SERVER['HTTP_X_ADMIN_CSRF'] ?? '');
    if ($header === '' || !hash_equals($admin['csrf_token'], $header)) {
        json_response(['success' => false, 'error' => 'CSRF_VALIDATION_FAILED'], 403);
    }
}

function require_idempotency_key(): string {
    $key = (string)($_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{16,96}$/', $key)) {
        json_response(['success' => false, 'error' => 'IDEMPOTENCY_KEY_REQUIRED'], 400);
    }
    return $key;
}

function require_admin_reason(array $payload, int $minLength = 10): string {
    $reason = trim((string)($payload['reason'] ?? ''));
    if (mb_strlen($reason) < $minLength) {
        json_response(['success' => false, 'error' => 'REASON_REQUIRED', 'message' => 'En az ' . $minLength . ' karakterlik gerekçe zorunludur.'], 422);
    }
    return mb_substr($reason, 0, 500);
}

function admin_method(): string {
    return strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
}

function admin_action(array $payload = []): string {
    $raw = (string)($payload['action'] ?? ($_GET['action'] ?? 'list'));
    return preg_match('/^[a-z_]{2,40}$/', $raw) ? $raw : 'invalid';
}

/** Admins can never move money to themselves or decide their own case. */
function admin_assert_not_party(array $admin, array $partyUserIds): void {
    $linked = $admin['linked_user_id'];
    if ($linked === null) {
        return;
    }
    foreach ($partyUserIds as $uid) {
        if ($uid !== null && (int)$uid === $linked) {
            admin_audit($admin, 'SELF_DEALING_BLOCKED', 'USER', (string)$linked, null, null, '');
            json_response(['success' => false, 'error' => 'SELF_DEALING_FORBIDDEN', 'message' => 'Taraf olduğunuz işlemde işlem yapamazsınız.'], 403);
        }
    }
}

/** Canonical row hash. Reproducible from the stored row, so tampering is detectable. */
function admin_audit_row_hash(string $prev, ?int $adminId, string $role, string $action, string $targetType, ?string $targetId, ?string $before, ?string $after, string $reason, string $ip, string $ts): string {
    return hash('sha256', implode("\x1F", [
        $prev, (string)$adminId, $role, $action, $targetType, (string)$targetId,
        (string)$before, (string)$after, $reason, $ip, $ts,
    ]));
}

/**
 * Append-only hash-chained audit entry. Caller may already be inside a transaction.
 */
function admin_audit(?array $admin, string $action, string $targetType, ?string $targetId, ?array $before, ?array $after, string $reason): void {
    $pdo = db();
    $ownTx = !$pdo->inTransaction();
    if ($ownTx) {
        $pdo->beginTransaction();
    }
    try {
        $last = $pdo->query('SELECT row_hash FROM admin_audit_log ORDER BY id DESC LIMIT 1 FOR UPDATE');
        $prev = $last ? (string)($last->fetchColumn() ?: str_repeat('0', 64)) : str_repeat('0', 64);
        $beforeJson = $before !== null ? json_encode($before, JSON_UNESCAPED_UNICODE) : null;
        $afterJson  = $after !== null ? json_encode($after, JSON_UNESCAPED_UNICODE) : null;
        $ts = gmdate('Y-m-d H:i:s');
        $adminId = isset($admin['id']) ? (int)$admin['id'] : null;
        $role = (string)($admin['role'] ?? 'ANONYMOUS');
        $reason = mb_substr($reason, 0, 500);
        $rowHash = admin_audit_row_hash($prev, $adminId, $role, $action, $targetType, $targetId, $beforeJson, $afterJson, $reason, admin_client_ip(), $ts);
        $stmt = $pdo->prepare(
            'INSERT INTO admin_audit_log (admin_user_id, admin_role, action, target_type, target_id, before_json, after_json, reason, ip_address, prev_hash, row_hash, created_at)
             VALUES (:aid, :role, :action, :ttype, :tid, :before, :after, :reason, :ip, :prev, :hash, :ts)'
        );
        $stmt->execute([
            ':aid'    => $adminId,
            ':role'   => $role,
            ':action' => $action,
            ':ttype'  => $targetType,
            ':tid'    => $targetId,
            ':before' => $beforeJson,
            ':after'  => $afterJson,
            ':reason' => $reason,
            ':ip'     => admin_client_ip(),
            ':prev'   => $prev,
            ':hash'   => $rowHash,
            ':ts'     => $ts,
        ]);
        if ($ownTx) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($ownTx && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/** True when 5+ failed logins came from this IP or for this e-mail in the last 15 minutes. */
function admin_login_rate_limited(string $email): bool {
    $limit  = admin_policy()['loginRateLimit'];
    $max    = (int)($limit['maxAttempts'] ?? 5);
    $window = (int)($limit['windowSeconds'] ?? 900);
    $stmt = db()->prepare(
        "SELECT
            SUM(ip_address = :ip) AS by_ip,
            SUM(target_id = :email) AS by_email
         FROM admin_audit_log
         WHERE action IN ('ADMIN_LOGIN_FAILED', 'ADMIN_TOTP_FAILED')
           AND created_at >= (UTC_TIMESTAMP() - INTERVAL :win SECOND)"
    );
    $stmt->execute([':ip' => admin_client_ip(), ':email' => mb_strtolower($email), ':win' => $window]);
    $row = $stmt->fetch() ?: ['by_ip' => 0, 'by_email' => 0];
    return (int)$row['by_ip'] >= $max || (int)$row['by_email'] >= $max;
}

/** Integer kuruş split. fee + net === total, always. */
function admin_split_kurus(int $totalKurus, int $feeBps): array {
    if ($totalKurus < 0 || $feeBps < 0 || $feeBps > 10000) {
        throw new InvalidArgumentException('INVALID_SPLIT_INPUT');
    }
    $fee = intdiv($totalKurus * $feeBps + 5000, 10000);
    return ['net_kurus' => $totalKurus - $fee, 'fee_kurus' => $fee, 'total_kurus' => $totalKurus];
}

/** Versioned setting lookup: latest version whose effective_from <= $at. */
function admin_setting_at(string $key, string $at, mixed $default): mixed {
    $stmt = db()->prepare(
        'SELECT setting_value_json FROM platform_settings
         WHERE setting_key = :k AND effective_from <= :at
         ORDER BY effective_from DESC LIMIT 1'
    );
    $stmt->execute([':k' => $key, ':at' => $at]);
    $raw = $stmt->fetchColumn();
    if ($raw === false) {
        return $default;
    }
    $decoded = json_decode((string)$raw, true);
    return $decoded['value'] ?? $default;
}

function admin_mask_phone(?string $v): string {
    $d = preg_replace('/\D/', '', (string)$v) ?? '';
    return strlen($d) >= 4 ? str_repeat('*', max(0, strlen($d) - 2)) . substr($d, -2) : '****';
}

function admin_mask_tckn(?string $v): string {
    $d = preg_replace('/\D/', '', (string)$v) ?? '';
    return strlen($d) === 11 ? substr($d, 0, 2) . '*******' . substr($d, -2) : '***********';
}

function admin_mask_iban(?string $v): string {
    $c = strtoupper(preg_replace('/\s+/', '', (string)$v) ?? '');
    return strlen($c) >= 8 ? substr($c, 0, 4) . str_repeat('*', strlen($c) - 8) . substr($c, -4) : 'TR**';
}

function admin_mask_email(?string $v): string {
    $parts = explode('@', (string)$v, 2);
    if (count($parts) !== 2 || $parts[0] === '') {
        return '***';
    }
    return mb_substr($parts[0], 0, 1) . '***@' . $parts[1];
}

// ---------------------------------------------------------------------------
// TOTP (RFC 6238, HMAC-SHA1, 30 s step, 6 digits) + encrypted secret storage
// ---------------------------------------------------------------------------

function admin_base32_decode(string $b32): string {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $clean = strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $b32) ?? '');
    $bits = '';
    foreach (str_split($clean) as $ch) {
        $pos = strpos($alphabet, $ch);
        if ($pos === false) {
            throw new InvalidArgumentException('INVALID_BASE32');
        }
        $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 8) as $byte) {
        if (strlen($byte) === 8) {
            $out .= chr((int)bindec($byte));
        }
    }
    return $out;
}

function admin_totp_code(string $rawSecret, int $timestamp, int $digits = 6, int $step = 30): string {
    $counter = intdiv($timestamp, $step);
    $binCounter = pack('N2', ($counter >> 32) & 0xFFFFFFFF, $counter & 0xFFFFFFFF);
    $hash = hash_hmac('sha1', $binCounter, $rawSecret, true);
    $offset = ord($hash[19]) & 0x0F;
    $value = ((ord($hash[$offset]) & 0x7F) << 24)
        | ((ord($hash[$offset + 1]) & 0xFF) << 16)
        | ((ord($hash[$offset + 2]) & 0xFF) << 8)
        | (ord($hash[$offset + 3]) & 0xFF);
    return str_pad((string)($value % (10 ** $digits)), $digits, '0', STR_PAD_LEFT);
}

function admin_totp_verify(string $rawSecret, string $code, int $window = 1): bool {
    if (!preg_match('/^\d{6}$/', $code)) {
        return false;
    }
    $now = time();
    for ($i = -$window; $i <= $window; $i++) {
        if (hash_equals(admin_totp_code($rawSecret, $now + ($i * 30)), $code)) {
            return true;
        }
    }
    return false;
}

function admin_totp_key(): string {
    $key = base64_decode((string)getenv('ADMIN_TOTP_KEY'), true);
    if (!is_string($key) || strlen($key) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES) {
        json_response(['success' => false, 'error' => 'ADMIN_TOTP_KEY_NOT_CONFIGURED'], 500);
    }
    return $key;
}

function admin_encrypt_totp_secret(string $rawSecret): string {
    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    return $nonce . sodium_crypto_secretbox($rawSecret, $nonce, admin_totp_key());
}

function admin_decrypt_totp_secret(string $blob): string {
    $nonce = substr($blob, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher = substr($blob, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $plain = sodium_crypto_secretbox_open($cipher, $nonce, admin_totp_key());
    if ($plain === false) {
        json_response(['success' => false, 'error' => 'TOTP_SECRET_CORRUPT'], 500);
    }
    return $plain;
}

function admin_base32_encode(string $raw): string {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = '';
    foreach (str_split($raw) as $ch) {
        $bits .= str_pad(decbin(ord($ch)), 8, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 5) as $chunk) {
        $out .= $alphabet[(int)bindec(str_pad($chunk, 5, '0', STR_PAD_RIGHT))];
    }
    return $out;
}

/** Shared guard for every admin endpoint: security headers + no caching. */
function admin_endpoint_headers(): void {
    header('Cache-Control: no-store');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
}

/**
 * Server-side port of resolveEscrowDisputeCase (www/capacitor-bridge.js), in integer kuruş.
 * Returns a suggestion only; the admin's final decision is recorded separately.
 */
function admin_suggest_dispute_decision(int $totalKurus, array $evidence, int $completionPct, int $feeBps): array {
    if ($totalKurus <= 0) {
        throw new InvalidArgumentException('DISPUTE_ESCROW_AMOUNT_REQUIRED');
    }
    $signature = !empty($evidence['wet_signature']);
    $cargo     = !empty($evidence['cargo_waybill']);
    $photos    = !empty($evidence['before_photo']) && !empty($evidence['after_photo']);
    if ($signature || ($cargo && $photos)) {
        $s = admin_split_kurus($totalKurus, $feeBps);
        return ['decision' => 'RELEASE_FULL_TO_PRO', 'customer_refund_kurus' => 0, 'pro_payout_kurus' => $s['net_kurus'], 'platform_fee_kurus' => $s['fee_kurus']];
    }
    $pct = max(0, min(100, $completionPct));
    if ($pct > 0 && $photos) {
        $proGross = intdiv($totalKurus * $pct + 50, 100);
        $s = admin_split_kurus($proGross, $feeBps);
        return ['decision' => 'PARTIAL_SETTLEMENT', 'customer_refund_kurus' => $totalKurus - $proGross, 'pro_payout_kurus' => $s['net_kurus'], 'platform_fee_kurus' => $s['fee_kurus']];
    }
    return ['decision' => 'FULL_REFUND_TO_CUSTOMER', 'customer_refund_kurus' => $totalKurus, 'pro_payout_kurus' => 0, 'platform_fee_kurus' => 0];
}

/**
 * Detects gift loops (A->B->...->A) in a list of [sender, streamer] edges.
 * @param list<array{sender:int, streamer:int}> $edges
 * @return list<list<int>>
 */
function admin_detect_gift_cycles(array $edges, int $maxLength = 4): array {
    $graph = [];
    foreach ($edges as $e) {
        $a = (int)$e['sender'];
        $b = (int)$e['streamer'];
        if ($a !== $b) {
            $graph[$a][$b] = true;
        }
    }
    $found = [];
    $seen = [];
    foreach (array_keys($graph) as $start) {
        $stack = [[$start, [$start]]];
        while ($stack) {
            [$node, $path] = array_pop($stack);
            foreach (array_keys($graph[$node] ?? []) as $next) {
                if ($next === $start && count($path) >= 2) {
                    $key = $path;
                    sort($key);
                    $sig = implode('-', $key);
                    if (!isset($seen[$sig])) {
                        $seen[$sig] = true;
                        $found[] = $path;
                    }
                } elseif (!in_array($next, $path, true) && count($path) < $maxLength) {
                    $stack[] = [$next, [...$path, $next]];
                }
            }
        }
    }
    return $found;
}

/** @return array{limit:int, offset:int} */
function admin_pagination(): array {
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 50)));
    $page = max(1, (int)($_GET['page'] ?? 1));
    return ['limit' => $limit, 'offset' => ($page - 1) * $limit];
}

function admin_escrow_fee_bps_at(string $at): int {
    $bps = (int)admin_setting_at('escrow_platform_fee_bps', $at, ADMIN_DEFAULT_ESCROW_FEE_BPS);
    return max(0, min(10000, $bps));
}
