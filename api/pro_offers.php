<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$user   = require_authenticated_user(['CUSTOMER', 'MASTER', 'ADMIN']);

if ($method === 'GET') {
    $leadId = isset($_GET['leadId']) ? (int)$_GET['leadId'] : 0;
    if ($leadId <= 0) {
        json_response(['errorCode' => 'INVALID_LEAD_ID', 'message' => 'Geçerli bir leadId belirtilmelidir.'], 400);
    }

    $leadStmt = db()->prepare('SELECT id, owner_customer_id, state, assigned_pro_user_id FROM leads WHERE id = :id LIMIT 1');
    $leadStmt->execute([':id' => $leadId]);
    $lead = $leadStmt->fetch();

    if (!$lead) {
        json_response(['errorCode' => 'LEAD_NOT_FOUND', 'message' => 'İlgili hizmet talebi bulunamadı.'], 404);
    }

    // Anti-IDOR check
    if ($user['role'] === 'CUSTOMER' && (int)$lead['owner_customer_id'] !== (int)$user['id']) {
        json_response(['errorCode' => 'OWNERSHIP_FORBIDDEN', 'message' => 'Başka bir müşterinin tekliflerini görüntüleyemezsiniz.'], 403);
    }

    if ($user['role'] === 'MASTER') {
        $stmt = db()->prepare(
            'SELECT id, lead_id, pro_user_id, sub_merchant_id, pro_display_name, category,
                    price_kurus, estimated_duration, warranty_label, proposal_note, state
             FROM pro_offers
             WHERE lead_id = :lead_id AND pro_user_id = :pro_id
             ORDER BY created_at DESC'
        );
        $stmt->execute([':lead_id' => $leadId, ':pro_id' => $user['id']]);
    } else {
        $stmt = db()->prepare(
            'SELECT id, lead_id, pro_user_id, sub_merchant_id, pro_display_name, category,
                    price_kurus, estimated_duration, warranty_label, proposal_note, state
             FROM pro_offers
             WHERE lead_id = :lead_id
             ORDER BY price_kurus ASC'
        );
        $stmt->execute([':lead_id' => $leadId]);
    }

    $offers = [];
    foreach ($stmt->fetchAll() as $row) {
        $offers[] = [
            'offerId'           => (int)$row['id'],
            'leadId'            => (int)$row['lead_id'],
            'proUserId'         => (int)$row['pro_user_id'],
            'subMerchantId'     => e((string)$row['sub_merchant_id']),
            'proDisplayName'    => e((string)$row['pro_display_name']),
            'category'          => e((string)$row['category']),
            'priceTl'           => round(((int)$row['price_kurus']) / 100, 2),
            'estimatedDuration' => e((string)$row['estimated_duration']),
            'warrantyLabel'     => e((string)$row['warranty_label']),
            'proposalNote'      => e((string)$row['proposal_note']),
            'state'             => e((string)$row['state']),
        ];
    }

    json_response([
        'status'    => 'ok',
        'leadId'    => $leadId,
        'leadState' => e((string)$lead['state']),
        'offers'    => $offers,
    ]);
}

if ($method !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Desteklenmeyen HTTP metodu.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);

$claimedRole = trim((string)($payload['claimedRole'] ?? ''));
if ($claimedRole !== '' && strtoupper($claimedRole) !== strtoupper((string)$user['role'])) {
    json_response(['errorCode' => 'ROLE_SPOOFING_REJECTED', 'message' => 'Rol uyuşmazlığı tespit edildi.'], 403);
}

if ($user['role'] !== 'MASTER' || (int)$user['is_verified_master'] !== 1) {
    json_response([
        'errorCode' => 'PRO_VERIFICATION_REQUIRED',
        'message'   => 'Yalnızca MEB/MYK belgeli doğrulanmış ustalar teklif verebilir.',
    ], 403);
}

$leadId            = (int)($payload['leadId'] ?? 0);
$priceTl           = (float)($payload['priceTl'] ?? 0);
$priceKurus        = (int)round($priceTl * 100);
$estimatedDuration = trim((string)($payload['estimatedDuration'] ?? '1-2 İş Günü'));
$warrantyLabel     = trim((string)($payload['warrantyLabel'] ?? '12 Ay Ustanomi İşçilik Garantisi'));
$proposalNote      = trim((string)($payload['proposalNote'] ?? ''));

if ($leadId <= 0 || $priceKurus <= 0 || mb_strlen($proposalNote) < 5) {
    json_response(['errorCode' => 'VALIDATION_ERROR', 'message' => 'Geçerli bir fiyat ve teklif açıklaması giriniz.'], 400);
}

$leadStmt = db()->prepare('SELECT id, owner_customer_id, category, state FROM leads WHERE id = :id LIMIT 1');
$leadStmt->execute([':id' => $leadId]);
$lead = $leadStmt->fetch();

if (!$lead) {
    json_response(['errorCode' => 'LEAD_NOT_FOUND', 'message' => 'Talep bulunamadı.'], 404);
}
if ((int)$lead['owner_customer_id'] === (int)$user['id']) {
    json_response(['errorCode' => 'SELF_BIDDING_FORBIDDEN', 'message' => 'Kendi açtığınız talebe teklif veremezsiniz.'], 403);
}
if ((string)$lead['state'] !== 'OPEN_FOR_OFFERS') {
    json_response([
        'errorCode'    => 'LEAD_NOT_OPEN',
        'currentState' => e((string)$lead['state']),
        'message'      => 'Bu talep yeni tekliflere kapalıdır.',
    ], 409);
}

$subMerchantId = 'IYZ-SM-' . $user['id'];
$stmt = db()->prepare(
    'INSERT INTO pro_offers (lead_id, pro_user_id, sub_merchant_id, pro_display_name, category, price_kurus, estimated_duration, warranty_label, proposal_note, state, created_at)
     VALUES (:lead_id, :pro_id, :sub_id, :pro_name, :category, :price_kurus, :duration, :warranty, :note, "PENDING", NOW())'
);
$stmt->execute([
    ':lead_id'     => $leadId,
    ':pro_id'      => $user['id'],
    ':sub_id'      => $subMerchantId,
    ':pro_name'    => mb_substr((string)$user['full_name'], 0, 150),
    ':category'    => mb_substr((string)$lead['category'], 0, 80),
    ':price_kurus' => $priceKurus,
    ':duration'    => mb_substr($estimatedDuration, 0, 80),
    ':warranty'    => mb_substr($warrantyLabel, 0, 120),
    ':note'        => mb_substr($proposalNote, 0, 1500),
]);

$offerId = (int)db()->lastInsertId();
log_security_audit('PRO_OFFER_SUBMITTED', 'PRO_OFFER', (string)$offerId, ['lead_id' => $leadId, 'price_kurus' => $priceKurus]);

json_response([
    'status' => 'ok',
    'offer'  => [
        'offerId'           => $offerId,
        'leadId'            => $leadId,
        'proUserId'         => (int)$user['id'],
        'subMerchantId'     => e($subMerchantId),
        'proDisplayName'    => e((string)$user['full_name']),
        'category'          => e((string)$lead['category']),
        'priceTl'           => round($priceKurus / 100, 2),
        'estimatedDuration' => e($estimatedDuration),
        'warrantyLabel'     => e($warrantyLabel),
        'proposalNote'      => e($proposalNote),
        'state'             => 'PENDING',
    ],
], 201);
