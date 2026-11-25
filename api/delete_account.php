<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

/**
 * KVKK Article 7, Apple App Store Guideline 5.1.1(v) & Google Play Data Safety
 * Account Deletion & PII Anonymization Endpoint
 * Blocks deletion if the user has active unresolved Escrow Pool transactions.
 */
init_secure_session();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Yalnızca POST desteklenir.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);
enforce_honeypot_trap($payload);
enforce_waf_rate_limit('delete_account', 3, 600);

$user = require_authenticated_user(['CUSTOMER', 'MASTER']);

$pdo = db();
$pdo->beginTransaction();

try {
    // 1. Ensure no active funds are locked in the Escrow Pool (FUNDS_HELD_IN_POOL / WORK_IN_PROGRESS / DISPUTED)
    $activeEscrowStmt = $pdo->prepare(
        'SELECT COUNT(*) AS active_cnt
         FROM service_requests
         WHERE (customer_id = :uid1 OR master_id = :uid2)
           AND escrow_status IN ("FUNDS_HELD_IN_POOL", "WORK_IN_PROGRESS", "DISPUTED")'
    );
    $activeEscrowStmt->execute([':uid1' => $user['id'], ':uid2' => $user['id']]);
    $activeRow = $activeEscrowStmt->fetch();

    if ((int)($activeRow['active_cnt'] ?? 0) > 0) {
        throw new RuntimeException('Güvenli Havuzda devam eden veya bloke edilmiş bir işleminiz bulunuyor. Lütfen önce aktif iş/teslim sürecini tamamlayınız.');
    }

    // 2. Anonymize PII & deactivate account (KVKK Article 7 compliance while preserving financial ledger integrity)
    $anonEmail = 'deleted_' . $user['id'] . '_' . bin2hex(random_bytes(4)) . '@anon.ustanomi.local';
    $updStmt = $pdo->prepare(
        'UPDATE users
         SET email = :email,
             phone = "0000000000",
             full_name = "Silinmiş Kullanıcı (KVKK)",
             is_active = 0
         WHERE id = :uid'
    );
    $updStmt->execute([
        ':email' => $anonEmail,
        ':uid'   => $user['id'],
    ]);

    $delKycStmt = $pdo->prepare('DELETE FROM user_kyc_identities WHERE user_id = :uid');
    $delKycStmt->execute([':uid' => $user['id']]);

    $pdo->commit();

    log_security_audit('KVKK_ACCOUNT_DELETED_ANONYMIZED', 'USER', (string)$user['id']);
    session_unset();
    session_destroy();

    json_response([
        'status'  => 'ok',
        'message' => 'Hesabınız ve kimlik verileriniz KVKK Madde 7 kapsamında kalıcı olarak anonimleştirildi ve silindi.',
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response([
        'status'    => 'error',
        'errorCode' => 'ACTIVE_ESCROW_BLOCKS_DELETION',
        'message'   => e($e->getMessage()),
    ], 409);
}
