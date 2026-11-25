<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
$method  = admin_method();
$payload = $method === 'POST' ? read_json_body() : [];
$action  = admin_action($payload);
$pdo     = db();

/** Money sits in the pool in PENDING_PAYMENT, FUNDS_HELD_IN_POOL, WORK_IN_PROGRESS and DISPUTED; such accounts cannot be deleted. */
function admin_user_has_active_escrow(PDO $pdo, int $userId): bool {
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM service_requests
         WHERE (customer_id = :u1 OR master_id = :u2)
           AND escrow_status IN ('PENDING_PAYMENT', 'FUNDS_HELD_IN_POOL', 'WORK_IN_PROGRESS', 'DISPUTED')"
    );
    $stmt->execute([':u1' => $userId, ':u2' => $userId]);
    return (int)$stmt->fetchColumn() > 0;
}

function admin_load_user(PDO $pdo, int $userId): array {
    $stmt = $pdo->prepare(
        'SELECT id, email, phone, full_name, role, is_verified_master, is_active, is_suspended, suspended_reason,
                efatura_badge, deletion_requested_at, created_at
         FROM users WHERE id = :id LIMIT 1'
    );
    $stmt->execute([':id' => $userId]);
    $row = $stmt->fetch();
    if (!$row) {
        json_response(['success' => false, 'error' => 'USER_NOT_FOUND'], 404);
    }
    return $row;
}

function admin_public_user(array $row): array {
    return [
        'id'                    => (int)$row['id'],
        'email'                 => admin_mask_email((string)$row['email']),
        'phone'                 => admin_mask_phone((string)$row['phone']),
        'full_name'             => (string)$row['full_name'],
        'role'                  => (string)$row['role'],
        'verified_badge'        => (int)$row['is_verified_master'] === 1,
        'efatura_badge'         => (int)$row['efatura_badge'] === 1,
        'is_active'             => (int)$row['is_active'] === 1,
        'is_suspended'          => (int)$row['is_suspended'] === 1,
        'suspended_reason'      => $row['suspended_reason'],
        'deletion_requested_at' => $row['deletion_requested_at'],
        'created_at'            => (string)$row['created_at'],
    ];
}

if ($method === 'GET') {
    if ($action === 'list') {
        require_admin_permission('users.view');
        $p = admin_pagination();
        $q = trim((string)($_GET['q'] ?? ''));
        $role = (string)($_GET['role'] ?? '');
        $status = (string)($_GET['status'] ?? '');
        $where = ['1=1'];
        $params = [];
        if ($q !== '') {
            $where[] = '(full_name LIKE :q1 OR email LIKE :q2)';
            $params[':q1'] = '%' . $q . '%';
            $params[':q2'] = '%' . $q . '%';
        }
        if (in_array($role, ['CUSTOMER', 'MASTER', 'ADMIN'], true)) {
            $where[] = 'role = :role';
            $params[':role'] = $role;
        }
        if ($status === 'suspended') {
            $where[] = 'is_suspended = 1';
        } elseif ($status === 'active') {
            $where[] = 'is_suspended = 0 AND is_active = 1';
        }
        $sql = 'SELECT id, email, phone, full_name, role, is_verified_master, is_active, is_suspended, suspended_reason,
                       efatura_badge, deletion_requested_at, created_at
                FROM users WHERE ' . implode(' AND ', $where) . '
                ORDER BY id DESC LIMIT :lim OFFSET :off';
        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':lim', $p['limit'], PDO::PARAM_INT);
        $stmt->bindValue(':off', $p['offset'], PDO::PARAM_INT);
        $stmt->execute();
        json_response(['success' => true, 'rows' => array_map('admin_public_user', $stmt->fetchAll())]);
    }

    if ($action === 'detail') {
        require_admin_permission('users.view');
        $userId = (int)($_GET['id'] ?? 0);
        $user = admin_public_user(admin_load_user($pdo, $userId));
        $notes = $pdo->prepare(
            'SELECT n.id, n.note, n.created_at, a.full_name AS admin_name
             FROM admin_user_notes n JOIN admin_users a ON a.id = n.admin_user_id
             WHERE n.user_id = :u ORDER BY n.id DESC LIMIT 50'
        );
        $notes->execute([':u' => $userId]);
        $jobs = $pdo->prepare(
            'SELECT request_code, title, escrow_status, agreed_amount_cents
             FROM service_requests WHERE customer_id = :u1 OR master_id = :u2 ORDER BY id DESC LIMIT 20'
        );
        $jobs->execute([':u1' => $userId, ':u2' => $userId]);
        json_response(['success' => true, 'user' => $user, 'notes' => $notes->fetchAll(), 'jobs' => $jobs->fetchAll()]);
    }

    if ($action === 'deletion_queue') {
        require_admin_permission('users.view');
        $stmt = $pdo->prepare(
            'SELECT id, email, phone, full_name, role, is_verified_master, is_active, is_suspended, suspended_reason,
                    efatura_badge, deletion_requested_at, created_at
             FROM users WHERE deletion_requested_at IS NOT NULL AND is_active = 1 ORDER BY deletion_requested_at ASC LIMIT 200'
        );
        $stmt->execute();
        $rows = [];
        foreach ($stmt->fetchAll() as $r) {
            $pub = admin_public_user($r);
            $pub['blocked_by_escrow'] = admin_user_has_active_escrow($pdo, (int)$r['id']);
            $rows[] = $pub;
        }
        json_response(['success' => true, 'rows' => $rows]);
    }

    json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
}

if ($method !== 'POST') {
    json_response(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
}

$userId = (int)($payload['user_id'] ?? 0);

if ($action === 'suspend' || $action === 'unsuspend') {
    $admin = require_admin_permission('users.suspend');
    require_admin_csrf($admin);
    $reason = require_admin_reason($payload);
    $before = admin_load_user($pdo, $userId);
    $flag = $action === 'suspend' ? 1 : 0;
    $stmt = $pdo->prepare('UPDATE users SET is_suspended = :f, suspended_reason = :r WHERE id = :id');
    $stmt->execute([':f' => $flag, ':r' => $flag === 1 ? $reason : null, ':id' => $userId]);
    admin_audit($admin, $action === 'suspend' ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED', 'USER', (string)$userId,
        ['is_suspended' => (int)$before['is_suspended']], ['is_suspended' => $flag], $reason);
    json_response(['success' => true]);
}

if ($action === 'badge') {
    $admin = require_admin_permission('users.badge');
    require_admin_csrf($admin);
    $badge = (string)($payload['badge'] ?? '');
    $value = !empty($payload['value']) ? 1 : 0;
    $column = match ($badge) {
        'verified' => 'is_verified_master',
        'efatura'  => 'efatura_badge',
        default    => null,
    };
    if ($column === null) {
        json_response(['success' => false, 'error' => 'INVALID_BADGE'], 422);
    }
    $before = admin_load_user($pdo, $userId);
    // Column name comes from the fixed whitelist above, never from user input.
    $stmt = $pdo->prepare('UPDATE users SET ' . $column . ' = :v WHERE id = :id');
    $stmt->execute([':v' => $value, ':id' => $userId]);
    admin_audit($admin, 'USER_BADGE_CHANGED', 'USER', (string)$userId, [$badge => (int)$before[$column]], [$badge => $value], '');
    json_response(['success' => true]);
}

if ($action === 'note') {
    $admin = require_admin_permission('users.note');
    require_admin_csrf($admin);
    $note = trim((string)($payload['note'] ?? ''));
    if (mb_strlen($note) < 2) {
        json_response(['success' => false, 'error' => 'NOTE_REQUIRED'], 422);
    }
    admin_load_user($pdo, $userId);
    $safe = redactKvkkPhp($note);
    $stmt = $pdo->prepare('INSERT INTO admin_user_notes (user_id, admin_user_id, note) VALUES (:u, :a, :n)');
    $stmt->execute([':u' => $userId, ':a' => $admin['id'], ':n' => mb_substr($safe, 0, 1000)]);
    admin_audit($admin, 'USER_NOTE_ADDED', 'USER', (string)$userId, null, ['note' => mb_substr($safe, 0, 200)], '');
    json_response(['success' => true]);
}

if ($action === 'reveal_pii') {
    $admin = require_admin_permission('pii.reveal');
    require_admin_csrf($admin);
    $reason = require_admin_reason($payload);
    $field = (string)($payload['field'] ?? '');
    if (!in_array($field, ['phone', 'email', 'tckn', 'iban'], true)) {
        json_response(['success' => false, 'error' => 'INVALID_FIELD'], 422);
    }
    $user = admin_load_user($pdo, $userId);
    if ($field === 'tckn' || $field === 'iban') {
        // By design the raw TCKN/IBAN never reaches the database (only SHA-256 + masked forms).
        $kyc = $pdo->prepare('SELECT tckn_masked, iban_masked FROM user_kyc_identities WHERE user_id = :u LIMIT 1');
        $kyc->execute([':u' => $userId]);
        $k = $kyc->fetch() ?: [];
        $value = (string)($field === 'tckn' ? ($k['tckn_masked'] ?? '') : ($k['iban_masked'] ?? ''));
        $note = 'Ham değer saklanmaz; yalnızca maskeli kayıt mevcuttur.';
    } else {
        $value = (string)$user[$field];
        $note = '';
    }
    admin_audit($admin, 'PII_REVEALED', 'USER', (string)$userId, null, ['field' => $field], $reason);
    json_response(['success' => true, 'field' => $field, 'value' => $value, 'note' => $note]);
}

if ($action === 'process_deletion') {
    $admin = require_admin_permission('users.delete');
    require_admin_csrf($admin);
    $reason = require_admin_reason($payload);
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT id, is_active FROM users WHERE id = :id FOR UPDATE');
        $lock->execute([':id' => $userId]);
        if (!$lock->fetch()) {
            $pdo->rollBack();
            json_response(['success' => false, 'error' => 'USER_NOT_FOUND'], 404);
        }
        if (admin_user_has_active_escrow($pdo, $userId)) {
            $pdo->rollBack();
            json_response(['success' => false, 'error' => 'ACTIVE_ESCROW_BLOCKS_DELETION', 'message' => 'Havuzda parası olan hesap silinemez.'], 409);
        }
        $anon = $pdo->prepare(
            "UPDATE users SET email = CONCAT('deleted_', id, '@anon.ustanomi.local'), phone = '', full_name = 'Silinmiş Kullanıcı',
                    password_hash = '', is_active = 0, deletion_requested_at = COALESCE(deletion_requested_at, NOW())
             WHERE id = :id"
        );
        $anon->execute([':id' => $userId]);
        admin_audit($admin, 'USER_DELETED_ANONYMIZED', 'USER', (string)$userId, null, ['anonymized' => true], $reason);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    json_response(['success' => true]);
}

json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);

function redactKvkkPhp(string $text): string {
    $t = preg_replace('/\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/i', 'TR**[IBAN]**', $text) ?? $text;
    $t = preg_replace('/\b(?:\+?90|0)?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/', '+905**[TEL]**', $t) ?? $t;
    return preg_replace('/\b[1-9]\d{10}\b/', '***[TCKN]***', $t) ?? $t;
}
