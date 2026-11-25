<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Yalnızca POST desteklenir.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);

$user           = require_authenticated_user(['CUSTOMER', 'ADMIN']);
$leadId         = (int)($payload['leadId'] ?? 0);
$offerId        = (int)($payload['offerId'] ?? 0);
$subMerchantId  = trim((string)($payload['subMerchantId'] ?? ''));
$idempotencyKey = trim((string)($payload['idempotencyKey'] ?? ('chk_' . $leadId . '_' . $offerId)));

if ($leadId <= 0 || $offerId <= 0 || $subMerchantId === '') {
    json_response(['status' => 'error', 'message' => 'Geçersiz ödeme veya teklif parametresi.'], 400);
}

$pdo = db();
$pdo->beginTransaction();

try {
    // 1. Check idempotency to prevent double-charge
    $idemStmt = $pdo->prepare(
        'SELECT transaction_id, total_amount_kurus, sub_merchant_share_kurus, platform_commission_kurus, escrow_status
         FROM ledger_transactions
         WHERE idempotency_key = :idem
         LIMIT 1'
    );
    $idemStmt->execute([':idem' => $idempotencyKey]);
    $existingTx = $idemStmt->fetch();

    if ($existingTx) {
        $pdo->commit();
        json_response([
            'status'             => 'ok',
            'transactionId'      => e((string)$existingTx['transaction_id']),
            'totalAmount'        => round(((int)$existingTx['total_amount_kurus']) / 100, 2),
            'subMerchantShare'   => round(((int)$existingTx['sub_merchant_share_kurus']) / 100, 2),
            'platformCommission' => round(((int)$existingTx['platform_commission_kurus']) / 100, 2),
            'escrowStatus'       => e((string)$existingTx['escrow_status']),
        ]);
    }

    // 2. Lock lead and verify ownership & OPEN_FOR_OFFERS state
    $leadStmt = $pdo->prepare(
        'SELECT id, owner_customer_id, state
         FROM leads
         WHERE id = :lead_id
         LIMIT 1
         FOR UPDATE'
    );
    $leadStmt->execute([':lead_id' => $leadId]);
    $lead = $leadStmt->fetch();

    if (!$lead) {
        throw new RuntimeException('Hizmet talebi bulunamadı.');
    }
    if ($user['role'] === 'CUSTOMER' && (int)$lead['owner_customer_id'] !== (int)$user['id']) {
        throw new RuntimeException('Yalnızca talebin sahibi olan müşteri teklif kabul edebilir.');
    }
    if ((string)$lead['state'] !== 'OPEN_FOR_OFFERS') {
        throw new RuntimeException('Bu talep için daha önce bir teklif kabul edilmiş veya talep kapatılmış.');
    }

    // 3. Lock selected offer and use server-side price_kurus (never trust client amount)
    $offerStmt = $pdo->prepare(
        'SELECT id, pro_user_id, sub_merchant_id, price_kurus, state
         FROM pro_offers
         WHERE id = :offer_id AND lead_id = :lead_id
         LIMIT 1
         FOR UPDATE'
    );
    $offerStmt->execute([':offer_id' => $offerId, ':lead_id' => $leadId]);
    $offer = $offerStmt->fetch();

    if (!$offer || (string)$offer['state'] !== 'PENDING') {
        throw new RuntimeException('Seçilen usta teklifi artık geçerli değil.');
    }

    // 4. Kuruş-exact 88% Sub-Merchant / 12% Platform Commission Split-Payment calculation
    $totalKurus      = (int)$offer['price_kurus'];
    $commissionKurus = (int)round(($totalKurus * 1200) / 10000);
    $masterKurus     = $totalKurus - $commissionKurus;
    $transactionId   = 'UST-TX-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
    $assignedJobId   = 'JOB-' . $leadId . '-' . $offerId;

    // 5. Transition winning offer -> ACCEPTED, sibling offers -> REJECTED, lead -> OFFER_ACCEPTED
    $accStmt = $pdo->prepare('UPDATE pro_offers SET state = "ACCEPTED" WHERE id = :id');
    $accStmt->execute([':id' => $offerId]);

    $rejStmt = $pdo->prepare('UPDATE pro_offers SET state = "REJECTED" WHERE lead_id = :lead_id AND id != :id AND state = "PENDING"');
    $rejStmt->execute([':lead_id' => $leadId, ':id' => $offerId]);

    $updLead = $pdo->prepare(
        'UPDATE leads
         SET state = "OFFER_ACCEPTED",
             accepted_offer_id = :offer_id,
             assigned_pro_user_id = :pro_id,
             assigned_job_id = :job_id,
             version = version + 1
         WHERE id = :lead_id'
    );
    $updLead->execute([
        ':offer_id' => $offerId,
        ':pro_id'   => (int)$offer['pro_user_id'],
        ':job_id'   => $assignedJobId,
        ':lead_id'  => $leadId,
    ]);

    // 6. Insert ledger transaction
    $txStmt = $pdo->prepare(
        'INSERT INTO ledger_transactions (
            transaction_id, idempotency_key, lead_id, offer_id, sub_merchant_id,
            total_amount_kurus, sub_merchant_share_kurus, platform_commission_kurus,
            payment_gateway, escrow_status, created_at
         ) VALUES (
            :tx_id, :idem, :lead_id, :offer_id, :sub_id,
            :total, :share, :comm, "IYZICO_ESCROW", "HAVUZ_HESAPTA", NOW()
         )'
    );
    $txStmt->execute([
        ':tx_id'    => $transactionId,
        ':idem'     => mb_substr($idempotencyKey, 0, 96),
        ':lead_id'  => $leadId,
        ':offer_id' => $offerId,
        ':sub_id'   => (string)$offer['sub_merchant_id'],
        ':total'    => $totalKurus,
        ':share'    => $masterKurus,
        ':comm'     => $commissionKurus,
    ]);

    $pdo->commit();

    log_security_audit('SPLIT_PAYMENT_CHECKOUT_LOCKED', 'LEDGER_TX', $transactionId, [
        'lead_id'          => $leadId,
        'offer_id'         => $offerId,
        'total_kurus'      => $totalKurus,
        'sub_share_kurus'  => $masterKurus,
        'commission_kurus' => $commissionKurus,
    ]);

    json_response([
        'status'             => 'ok',
        'transactionId'      => e($transactionId),
        'totalAmount'        => round($totalKurus / 100, 2),
        'subMerchantShare'   => round($masterKurus / 100, 2),
        'platformCommission' => round($commissionKurus / 100, 2),
        'escrowStatus'       => 'HAVUZ_HESAPTA',
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(['status' => 'error', 'message' => e($e->getMessage())], 409);
}
