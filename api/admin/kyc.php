<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
$method  = admin_method();
$payload = $method === 'POST' ? read_json_body() : [];
$action  = admin_action($payload);
$pdo     = db();

if ($method === 'GET' && $action === 'list') {
    require_admin_permission('kyc.view');
    $status = (string)($_GET['status'] ?? 'PENDING_REVIEW');
    if (!in_array($status, ['PENDING_REVIEW', 'REJECTED', 'VERIFIED_ALGORITHMIC', 'NVİ_KPS_VERIFIED', 'SUSPENDED'], true)) {
        $status = 'PENDING_REVIEW';
    }
    $stmt = $pdo->prepare(
        'SELECT k.id, k.user_id, u.full_name, u.role, k.tckn_masked, k.vkn_masked, k.iban_masked,
                k.kyc_status, k.document_id, k.rejection_reason, k.created_at, k.reviewed_at
         FROM user_kyc_identities k JOIN users u ON u.id = k.user_id
         WHERE k.kyc_status = :s ORDER BY k.created_at ASC LIMIT 200'
    );
    $stmt->execute([':s' => $status]);
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $rows[] = [
            'id'           => (int)$r['id'],
            'user_id'      => (int)$r['user_id'],
            'full_name'    => (string)$r['full_name'],
            'role'         => (string)$r['role'],
            // Stored values are already masked; mask again defensively.
            'tckn'         => admin_mask_tckn((string)$r['tckn_masked']),
            'vkn'          => $r['vkn_masked'] !== null ? (string)$r['vkn_masked'] : null,
            'iban'         => admin_mask_iban((string)$r['iban_masked']),
            // Checksum validity was verified at registration (validateKycRegistrationPayload); rows only exist if valid.
            'checks'       => ['tckn' => true, 'iban' => $r['iban_masked'] !== null, 'vkn' => $r['vkn_masked'] !== null],
            'status'       => (string)$r['kyc_status'],
            'document_id'  => $r['document_id'] !== null ? (int)$r['document_id'] : null,
            'rejection_reason' => $r['rejection_reason'],
            'created_at'   => (string)$r['created_at'],
        ];
    }
    json_response(['success' => true, 'rows' => $rows]);
}

if ($method === 'GET' && $action === 'document') {
    $admin = require_admin_permission('kyc.view');
    $docId = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare(
        "SELECT d.stored_filename, d.detected_mime FROM uploaded_documents d
         JOIN user_kyc_identities k ON k.document_id = d.id
         WHERE d.id = :id LIMIT 1"
    );
    $stmt->execute([':id' => $docId]);
    $doc = $stmt->fetch();
    $dir = rtrim((string)(getenv('UPLOAD_DIR') ?: ''), '/\\');
    // stored_filename is generated server-side as 32 hex chars + extension; re-validate to block traversal.
    if (!$doc || $dir === '' || !preg_match('/^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/', (string)$doc['stored_filename'])) {
        json_response(['success' => false, 'error' => 'DOCUMENT_NOT_FOUND'], 404);
    }
    $path = $dir . DIRECTORY_SEPARATOR . $doc['stored_filename'];
    if (!is_file($path)) {
        json_response(['success' => false, 'error' => 'DOCUMENT_NOT_FOUND'], 404);
    }
    admin_audit($admin, 'KYC_DOCUMENT_VIEWED', 'KYC_DOCUMENT', (string)$docId, null, null, '');
    header('Content-Type: ' . (string)$doc['detected_mime']);
    header('Content-Disposition: inline; filename="kyc-' . $docId . '"');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}

if ($method !== 'POST' || $action !== 'decide') {
    json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
}

$admin = require_admin_permission('kyc.decide');
require_admin_csrf($admin);
$kycId = (int)($payload['kyc_id'] ?? 0);
$decision = (string)($payload['decision'] ?? '');
if (!in_array($decision, ['approve', 'reject'], true)) {
    json_response(['success' => false, 'error' => 'INVALID_DECISION'], 422);
}
$reason = $decision === 'reject' ? require_admin_reason($payload) : trim((string)($payload['reason'] ?? ''));

$pdo->beginTransaction();
try {
    $lock = $pdo->prepare('SELECT id, user_id, kyc_status FROM user_kyc_identities WHERE id = :id FOR UPDATE');
    $lock->execute([':id' => $kycId]);
    $row = $lock->fetch();
    if (!$row || $row['kyc_status'] !== 'PENDING_REVIEW') {
        $pdo->rollBack();
        json_response(['success' => false, 'error' => 'KYC_NOT_PENDING'], 409);
    }
    admin_assert_not_party($admin, [(int)$row['user_id']]);
    $newStatus = $decision === 'approve' ? 'VERIFIED_ALGORITHMIC' : 'REJECTED';
    $upd = $pdo->prepare(
        'UPDATE user_kyc_identities SET kyc_status = :s, rejection_reason = :r, reviewed_by_admin_id = :a, reviewed_at = NOW() WHERE id = :id'
    );
    $upd->execute([':s' => $newStatus, ':r' => $decision === 'reject' ? $reason : null, ':a' => $admin['id'], ':id' => $kycId]);
    if ($decision === 'approve') {
        $badge = $pdo->prepare("UPDATE users SET is_verified_master = 1 WHERE id = :u AND role = 'MASTER'");
        $badge->execute([':u' => (int)$row['user_id']]);
    }
    admin_audit($admin, $decision === 'approve' ? 'KYC_APPROVED' : 'KYC_REJECTED', 'KYC', (string)$kycId,
        ['status' => 'PENDING_REVIEW'], ['status' => $newStatus], $reason);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}
json_response(['success' => true, 'status' => $newStatus]);
