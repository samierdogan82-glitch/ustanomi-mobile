<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    json_response(['success' => false, 'message' => 'Yalnızca POST metodu desteklenir.'], 405);
}

$rawBody   = (string)file_get_contents('php://input', false, null, 0, 65536);
$signature = trim((string)($_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? ''));
$secretKey = (string)(getenv('ESCROW_WEBHOOK_SECRET') ?: '');

if ($rawBody === '' || !verify_webhook_hmac($rawBody, $secretKey, $signature)) {
    log_security_audit('WEBHOOK_HMAC_VERIFICATION_FAILED', 'ESCROW_WEBHOOK', null);
    json_response([
        'success' => false,
        'error'   => 'INVALID_WEBHOOK_SIGNATURE',
        'message' => 'Webhook HMAC-SHA256 imza doğrulaması başarısız.',
    ], 401);
}

$data = json_decode($rawBody, true);
if (!is_array($data)) {
    json_response(['success' => false, 'message' => 'Geçersiz JSON yükü.'], 400);
}

$requestId   = (int)($data['service_request_id'] ?? 0);
$provider    = in_array(($data['provider'] ?? ''), ['PAYTR', 'IYZICO'], true) ? (string)$data['provider'] : 'IYZICO';
$providerRef = trim((string)($data['provider_reference'] ?? ''));
$amountCents = max(0, (int)($data['amount_cents'] ?? 0));

if ($requestId <= 0 || $providerRef === '' || $amountCents <= 0) {
    json_response(['success' => false, 'message' => 'Eksik webhook alanları.'], 400);
}

$pdo = db();
$pdo->beginTransaction();

try {
    $stmt = $pdo->prepare(
        'SELECT id, escrow_status, agreed_amount_cents
         FROM service_requests
         WHERE id = :id
         LIMIT 1
         FOR UPDATE'
    );
    $stmt->execute([':id' => $requestId]);
    $req = $stmt->fetch();

    if (!$req) {
        throw new RuntimeException('İlgili iş talebi bulunamadı.');
    }

    if (!can_transition_escrow((string)$req['escrow_status'], 'FUNDS_HELD_IN_POOL')) {
        throw new RuntimeException('İş talebi ödeme bekleyen durumda değil.');
    }

    $ins = $pdo->prepare(
        'INSERT INTO escrow_transactions (service_request_id, provider, provider_reference, amount_cents, status, webhook_verified, created_at)
         VALUES (:req_id, :provider, :ref, :amount, \'HELD\', 1, NOW())'
    );
    $ins->execute([
        ':req_id'   => $requestId,
        ':provider' => $provider,
        ':ref'      => mb_substr($providerRef, 0, 120),
        ':amount'   => $amountCents,
    ]);

    $upd = $pdo->prepare(
        'UPDATE service_requests SET escrow_status = \'FUNDS_HELD_IN_POOL\', updated_at = NOW() WHERE id = :id'
    );
    $upd->execute([':id' => $requestId]);

    $pdo->commit();
    json_response(['success' => true, 'escrow_status' => 'FUNDS_HELD_IN_POOL']);
} catch (Throwable $ex) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(['success' => false, 'message' => e($ex->getMessage())], 400);
}
