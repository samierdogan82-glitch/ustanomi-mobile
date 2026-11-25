<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    json_response(['status' => 'error', 'message' => 'Yalnızca GET desteklenir.'], 405);
}

$query       = trim((string)($_GET['q'] ?? ''));
$clusterCode = trim((string)($_GET['cluster'] ?? ''));
$city        = trim((string)($_GET['city'] ?? ''));
$onlyOpen    = ((string)($_GET['onlyOpen'] ?? '0')) === '1';
$onlyKyc     = ((string)($_GET['onlyKyc'] ?? '0')) === '1';
$maxPriceTl  = isset($_GET['maxPriceTl']) ? (float)$_GET['maxPriceTl'] : 0.0;
$sortBy      = strtoupper(trim((string)($_GET['sortBy'] ?? 'TRENDING')));
$currency    = strtoupper(trim((string)($_GET['currency'] ?? 'TRY')));

$fxRates = [
    'TRY' => 1.0,
    'USD' => 0.029,
    'EUR' => 0.027,
    'GBP' => 0.023,
];
$fxRate = $fxRates[$currency] ?? 1.0;

$sql = 'SELECT t.id, t.pro_user_id, t.pro_handle, t.cluster_code, t.skill_title, t.description,
               t.starting_price_kurus, t.likes_count, t.work_requests_count, t.trending_score,
               p.city, p.district, p.availability_mode, p.response_time_minutes,
               k.kyc_status
        FROM talent_posts t
        LEFT JOIN pro_social_profiles p ON p.user_id = t.pro_user_id
        LEFT JOIN user_kyc_identities k ON k.user_id = t.pro_user_id
        WHERE 1=1';

$params = [];

if ($clusterCode !== '' && $clusterCode !== 'ALL') {
    $sql .= ' AND t.cluster_code = :cluster';
    $params[':cluster'] = $clusterCode;
}
if ($city !== '' && $city !== 'ALL') {
    $sql .= ' AND p.city = :city';
    $params[':city'] = $city;
}
if ($onlyOpen) {
    $sql .= ' AND p.availability_mode IN ("OPEN", "ON_DUTY_24_7")';
}
if ($onlyKyc) {
    $sql .= ' AND k.kyc_status IN ("VERIFIED_ALGORITHMIC", "NVİ_KPS_VERIFIED")';
}
if ($maxPriceTl > 0) {
    $sql .= ' AND t.starting_price_kurus <= :max_kurus';
    $params[':max_kurus'] = (int)round($maxPriceTl * 100);
}
if ($query !== '') {
    $sql .= ' AND (t.skill_title LIKE :q OR t.description LIKE :q OR t.pro_handle LIKE :q)';
    $params[':q'] = '%' . $query . '%';
}

if ($sortBy === 'PRICE_ASC') {
    $sql .= ' ORDER BY t.starting_price_kurus ASC';
} elseif ($sortBy === 'FASTEST_ETA') {
    $sql .= ' ORDER BY COALESCE(p.response_time_minutes, 15) ASC';
} else {
    $sql .= ' ORDER BY t.trending_score DESC, t.likes_count DESC';
}

$sql .= ' LIMIT 50';
$stmt = db()->prepare($sql);
$stmt->execute($params);

$results = [];
foreach ($stmt->fetchAll() as $row) {
    $priceTl        = ((int)$row['starting_price_kurus']) / 100;
    $convertedPrice = round($priceTl * $fxRate, 2);
    $results[] = [
        'id'                  => (int)$row['id'],
        'proUserId'           => (int)$row['pro_user_id'],
        'proHandle'           => '@' . e(ltrim((string)$row['pro_handle'], '@')),
        'clusterCode'         => e((string)$row['cluster_code']),
        'skillTitle'          => e((string)$row['skill_title']),
        'description'         => e((string)$row['description']),
        'city'                => e((string)($row['city'] ?? 'İstanbul')),
        'district'            => e((string)($row['district'] ?? 'Kadıköy')),
        'availabilityMode'    => e((string)($row['availability_mode'] ?? 'OPEN')),
        'responseTimeMinutes' => (int)($row['response_time_minutes'] ?? 5),
        'isKycVerified'       => !empty($row['kyc_status']),
        'priceTl'             => round($priceTl, 2),
        'displayPrice'        => $convertedPrice,
        'displayCurrency'     => e($currency),
        'likesCount'          => (int)$row['likes_count'],
        'workRequestsCount'   => (int)$row['work_requests_count'],
        'trendingScore'       => (int)$row['trending_score'],
    ];
}

json_response([
    'status'   => 'ok',
    'currency' => e($currency),
    'count'    => count($results),
    'results'  => $results,
]);
