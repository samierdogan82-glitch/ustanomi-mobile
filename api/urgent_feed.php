<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    $cluster = trim((string)($_GET['cluster'] ?? ''));
    $urgency = trim((string)($_GET['urgency'] ?? ''));
    $city    = trim((string)($_GET['city'] ?? ''));

    $sql    = 'SELECT id, urgent_post_code, customer_user_id, cluster_code, urgency_code,
                      city, district, title, description, estimated_budget_kurus, status, created_at
               FROM urgent_job_posts
               WHERE status = "OPEN"';
    $params = [];

    if ($cluster !== '') {
        $sql .= ' AND cluster_code = :cluster';
        $params[':cluster'] = $cluster;
    }
    if ($urgency !== '') {
        $sql .= ' AND urgency_code = :urgency';
        $params[':urgency'] = $urgency;
    }
    if ($city !== '') {
        $sql .= ' AND city = :city';
        $params[':city'] = $city;
    }

    $sql .= ' ORDER BY FIELD(urgency_code, "EMERGENCY_30M", "TODAY", "SCHEDULED"), created_at DESC LIMIT 50';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    $posts = [];
    foreach ($stmt->fetchAll() as $row) {
        $posts[] = [
            'id'                => (int)$row['id'],
            'urgentPostCode'    => e((string)$row['urgent_post_code']),
            'customerUserId'    => (int)$row['customer_user_id'],
            'clusterCode'       => e((string)$row['cluster_code']),
            'urgencyCode'       => e((string)$row['urgency_code']),
            'city'              => e((string)$row['city']),
            'district'          => e((string)$row['district']),
            'title'             => e((string)$row['title']),
            'description'       => e((string)$row['description']),
            'estimatedBudgetTl' => round(((int)$row['estimated_budget_kurus']) / 100, 2),
            'status'            => e((string)$row['status']),
            'createdAt'         => e((string)$row['created_at']),
        ];
    }

    json_response(['status' => 'ok', 'urgentPosts' => $posts]);
}

if ($method !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Desteklenmeyen HTTP metodu.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);

$user        = require_authenticated_user(['CUSTOMER', 'ADMIN']);
$title       = trim((string)($payload['title'] ?? ''));
$description = trim((string)($payload['description'] ?? ''));
$clusterCode = trim((string)($payload['clusterCode'] ?? 'HOME_TECH'));
$urgencyCode = trim((string)($payload['urgencyCode'] ?? 'EMERGENCY_30M'));
$city        = trim((string)($payload['city'] ?? 'İstanbul'));
$district    = trim((string)($payload['district'] ?? 'Kadıköy'));
$budgetTl    = max(0.0, (float)($payload['estimatedBudgetTl'] ?? 750));
$budgetKurus = (int)round($budgetTl * 100);

$allowedUrgencies = ['EMERGENCY_30M', 'TODAY', 'SCHEDULED'];
if (!in_array($urgencyCode, $allowedUrgencies, true)) {
    $urgencyCode = 'EMERGENCY_30M';
}

if (mb_strlen($title) < 4 || mb_strlen($description) < 8) {
    json_response([
        'status'  => 'error',
        'message' => 'Lütfen acil iş başlığını (en az 4 krk) ve açıklamasını giriniz.',
    ], 400);
}

$postCode = 'ACIL-' . date('Ymd') . '-' . random_int(10000, 99999);
$stmt = db()->prepare(
    'INSERT INTO urgent_job_posts (
        urgent_post_code, customer_user_id, cluster_code, urgency_code,
        city, district, title, description, estimated_budget_kurus, status, created_at
     ) VALUES (
        :code, :cust_id, :cluster, :urgency,
        :city, :district, :title, :desc, :budget, "OPEN", NOW()
     )'
);
$stmt->execute([
    ':code'     => $postCode,
    ':cust_id'  => $user['id'],
    ':cluster'  => mb_substr($clusterCode, 0, 40),
    ':urgency'  => $urgencyCode,
    ':city'     => mb_substr($city, 0, 80),
    ':district' => mb_substr($district, 0, 80),
    ':title'    => mb_substr($title, 0, 180),
    ':desc'     => mb_substr($description, 0, 2000),
    ':budget'   => $budgetKurus,
]);

$postId = (int)db()->lastInsertId();
log_security_audit('URGENT_JOB_POSTED', 'URGENT_POST', (string)$postId, [
    'code'    => $postCode,
    'urgency' => $urgencyCode,
    'cluster' => $clusterCode,
]);

json_response([
    'status'         => 'ok',
    'id'             => $postId,
    'urgentPostCode' => e($postCode),
    'urgencyCode'    => $urgencyCode,
    'message'        => 'Acil iş paylaşımınız bölgenizdeki açık ve nöbetçi uzmanlara iletildi.',
], 201);
