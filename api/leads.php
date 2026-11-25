<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$user   = require_authenticated_user(['CUSTOMER', 'MASTER', 'ADMIN']);

if ($method === 'GET') {
    $leadId   = isset($_GET['leadId']) ? (int)$_GET['leadId'] : 0;
    $status   = trim((string)($_GET['status'] ?? ''));
    $category = trim((string)($_GET['category'] ?? ''));
    $city     = trim((string)($_GET['city'] ?? ''));

    // Anti-IDOR: CUSTOMERS see only their own leads; verified MASTERS see OPEN_FOR_OFFERS or their assigned leads
    $sql    = 'SELECT id, owner_customer_id, phone, service_title, category, city, details, urgency, state,
                      accepted_offer_id, assigned_pro_user_id, assigned_job_id, version
               FROM leads WHERE 1=1';
    $params = [];

    if ($user['role'] === 'CUSTOMER') {
        $sql .= ' AND owner_customer_id = :owner_id';
        $params[':owner_id'] = $user['id'];
    } elseif ($user['role'] === 'MASTER') {
        if ((int)$user['is_verified_master'] !== 1) {
            json_response([
                'errorCode' => 'PRO_VERIFICATION_REQUIRED',
                'message'   => 'Açık hizmet taleplerini görüntülemek için doğrulanmış usta hesabı gereklidir.',
            ], 403);
        }
        $sql .= ' AND (state = "OPEN_FOR_OFFERS" OR assigned_pro_user_id = :pro_id)';
        $params[':pro_id'] = $user['id'];
    }

    if ($leadId > 0) {
        $sql .= ' AND id = :lead_id';
        $params[':lead_id'] = $leadId;
    }
    if ($status !== '') {
        $sql .= ' AND state = :state';
        $params[':state'] = $status;
    }
    if ($category !== '') {
        $sql .= ' AND category = :category';
        $params[':category'] = $category;
    }
    if ($city !== '') {
        $sql .= ' AND city = :city';
        $params[':city'] = $city;
    }

    $sql .= ' ORDER BY created_at DESC LIMIT 100';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    $leads = [];
    foreach ($stmt->fetchAll() as $row) {
        $maskedPhone = '***' . substr((string)$row['phone'], -4);
        $leads[] = [
            'leadId'                   => (int)$row['id'],
            'ownerCustomerId'          => (int)$row['owner_customer_id'],
            'serviceTitle'             => e((string)$row['service_title']),
            'category'                 => e((string)$row['category']),
            'city'                     => e((string)$row['city']),
            'details'                  => e((string)$row['details']),
            'urgency'                  => e((string)$row['urgency']),
            'contactPhoneMaskedOrFull' => e($maskedPhone),
            'state'                    => e((string)$row['state']),
            'acceptedOfferId'          => $row['accepted_offer_id'] !== null ? (int)$row['accepted_offer_id'] : null,
            'assignedProUserId'        => $row['assigned_pro_user_id'] !== null ? (int)$row['assigned_pro_user_id'] : null,
            'assignedJobId'            => $row['assigned_job_id'] !== null ? e((string)$row['assigned_job_id']) : null,
            'isDemoEnvironment'        => false,
            'version'                  => (int)$row['version'],
        ];
    }

    json_response([
        'status'     => 'ok',
        'viewerRole' => e((string)$user['role']),
        'leads'      => $leads,
    ]);
}

if ($method !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Desteklenmeyen HTTP metodu.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);

$claimedRole = trim((string)($payload['claimedRole'] ?? ''));
if ($claimedRole !== '' && strtoupper($claimedRole) !== strtoupper((string)$user['role'])) {
    log_security_audit('ROLE_SPOOFING_REJECTED', 'LEAD', null, ['claimed' => $claimedRole, 'actual' => $user['role']]);
    json_response([
        'errorCode' => 'ROLE_SPOOFING_REJECTED',
        'message'   => 'İstemci rolü ile doğrulanmış oturum rolü uyuşmuyor.',
    ], 403);
}

if ($user['role'] !== 'CUSTOMER' && $user['role'] !== 'ADMIN') {
    json_response([
        'errorCode' => 'ROLE_FORBIDDEN',
        'message'   => 'Yalnızca müşteri hesapları hizmet talebi oluşturabilir.',
    ], 403);
}

$serviceTitle = trim((string)($payload['serviceTitle'] ?? ''));
$category     = trim((string)($payload['category'] ?? 'Genel Tadilat'));
$city         = trim((string)($payload['city'] ?? 'İstanbul'));
$details      = trim((string)($payload['details'] ?? ''));
$urgency      = trim((string)($payload['urgency'] ?? 'Bu Hafta İçinde'));
$publishNow   = (bool)($payload['publishImmediately'] ?? true);
$initialState = $publishNow ? 'OPEN_FOR_OFFERS' : 'DRAFT';

if (mb_strlen($serviceTitle) < 4 || mb_strlen($details) < 10) {
    json_response([
        'errorCode' => 'VALIDATION_ERROR',
        'message'   => 'Lütfen iş başlığını (en az 4 karakter) ve detayları (en az 10 karakter) giriniz.',
    ], 400);
}

$stmt = db()->prepare(
    'INSERT INTO leads (owner_customer_id, phone, service_title, category, city, details, urgency, verified, state, created_at)
     VALUES (:owner_id, :phone, :title, :category, :city, :details, :urgency, 1, :state, NOW())'
);
$stmt->execute([
    ':owner_id' => $user['id'],
    ':phone'    => '+905*********',
    ':title'    => mb_substr($serviceTitle, 0, 180),
    ':category' => mb_substr($category, 0, 80),
    ':city'     => mb_substr($city, 0, 80),
    ':details'  => mb_substr($details, 0, 2500),
    ':urgency'  => mb_substr($urgency, 0, 80),
    ':state'    => $initialState,
]);

$leadId = (int)db()->lastInsertId();
log_security_audit('LEAD_CREATED', 'LEAD', (string)$leadId, ['state' => $initialState]);

json_response([
    'status' => 'ok',
    'lead'   => [
        'leadId'                   => $leadId,
        'ownerCustomerId'          => (int)$user['id'],
        'serviceTitle'             => e($serviceTitle),
        'category'                 => e($category),
        'city'                     => e($city),
        'details'                  => e($details),
        'urgency'                  => e($urgency),
        'contactPhoneMaskedOrFull' => '+905*********',
        'state'                    => $initialState,
        'acceptedOfferId'          => null,
        'assignedProUserId'        => null,
        'assignedJobId'            => null,
        'isDemoEnvironment'        => false,
        'version'                  => 1,
    ],
], 201);
