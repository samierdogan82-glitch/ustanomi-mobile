<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    $handle  = trim((string)($_GET['handle'] ?? ''));
    $cluster = trim((string)($_GET['cluster'] ?? ''));

    $sql    = 'SELECT p.user_id, p.handle, p.profession_title, p.cluster_code, p.city, p.district,
                      p.availability_mode, p.open_hour, p.close_hour, p.response_time_minutes,
                      p.followers_count, p.price_menu_json, p.story_highlights_json, p.media_grid_json,
                      u.full_name, u.is_verified_master
               FROM pro_social_profiles p
               INNER JOIN users u ON u.id = p.user_id AND u.is_active = 1
               WHERE 1=1';
    $params = [];

    if ($handle !== '') {
        $sql .= ' AND p.handle = :handle';
        $params[':handle'] = ltrim($handle, '@');
    }
    if ($cluster !== '') {
        $sql .= ' AND p.cluster_code = :cluster';
        $params[':cluster'] = $cluster;
    }

    $sql .= ' ORDER BY FIELD(p.availability_mode, "ON_DUTY_24_7", "OPEN", "AUTO", "CLOSED"), p.followers_count DESC LIMIT 30';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    $profiles = [];
    foreach ($stmt->fetchAll() as $row) {
        $profiles[] = [
            'userId'              => (int)$row['user_id'],
            'handle'              => '@' . e((string)$row['handle']),
            'displayName'         => e((string)$row['full_name']),
            'professionTitle'     => e((string)$row['profession_title']),
            'clusterCode'         => e((string)$row['cluster_code']),
            'city'                => e((string)$row['city']),
            'district'            => e((string)$row['district']),
            'availabilityMode'    => e((string)$row['availability_mode']),
            'openHour'            => (int)$row['open_hour'],
            'closeHour'           => (int)$row['close_hour'],
            'responseTimeMinutes' => (int)$row['response_time_minutes'],
            'followersCount'      => (int)$row['followers_count'],
            'isVerifiedPro'       => (int)$row['is_verified_master'] === 1,
            'priceMenu'           => json_decode((string)($row['price_menu_json'] ?? '[]'), true) ?: [],
            'storyHighlights'     => json_decode((string)($row['story_highlights_json'] ?? '[]'), true) ?: [],
            'mediaGrid'           => json_decode((string)($row['media_grid_json'] ?? '[]'), true) ?: [],
        ];
    }

    json_response(['status' => 'ok', 'profiles' => $profiles]);
}

if ($method !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Desteklenmeyen HTTP metodu.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);

$user = require_authenticated_user(['MASTER', 'ADMIN']);

$availabilityMode = strtoupper(trim((string)($payload['availabilityMode'] ?? 'AUTO')));
if (!in_array($availabilityMode, ['OPEN', 'CLOSED', 'ON_DUTY_24_7', 'AUTO'], true)) {
    $availabilityMode = 'AUTO';
}

$openHour        = max(0, min(23, (int)($payload['openHour'] ?? 8)));
$closeHour       = max(1, min(24, (int)($payload['closeHour'] ?? 20)));
$professionTitle = trim((string)($payload['professionTitle'] ?? 'Uzman Usta'));
$clusterCode     = trim((string)($payload['clusterCode'] ?? 'HOME_TECH'));
$city            = trim((string)($payload['city'] ?? 'İstanbul'));
$district        = trim((string)($payload['district'] ?? 'Kadıköy'));
$rawHandle       = preg_replace('/[^a-z0-9_]/', '', strtolower(trim((string)($payload['handle'] ?? ('usta_' . $user['id'])))));
$priceMenuJson   = json_encode(is_array($payload['priceMenu'] ?? null) ? $payload['priceMenu'] : [], JSON_UNESCAPED_UNICODE);

$stmt = db()->prepare(
    'INSERT INTO pro_social_profiles (
        user_id, handle, profession_title, cluster_code, city, district,
        availability_mode, open_hour, close_hour, price_menu_json, updated_at
     ) VALUES (
        :uid, :handle, :title, :cluster, :city, :district,
        :mode, :open_h, :close_h, :prices, NOW()
     ) ON DUPLICATE KEY UPDATE
        profession_title = VALUES(profession_title),
        cluster_code = VALUES(cluster_code),
        city = VALUES(city),
        district = VALUES(district),
        availability_mode = VALUES(availability_mode),
        open_hour = VALUES(open_hour),
        close_hour = VALUES(close_hour),
        price_menu_json = VALUES(price_menu_json),
        updated_at = NOW()'
);
$stmt->execute([
    ':uid'      => $user['id'],
    ':handle'   => mb_substr($rawHandle !== '' ? $rawHandle : ('usta_' . $user['id']), 0, 64),
    ':title'    => mb_substr($professionTitle, 0, 140),
    ':cluster'  => mb_substr($clusterCode, 0, 40),
    ':city'     => mb_substr($city, 0, 80),
    ':district' => mb_substr($district, 0, 80),
    ':mode'     => $availabilityMode,
    ':open_h'   => $openHour,
    ':close_h'  => $closeHour,
    ':prices'   => $priceMenuJson,
]);

log_security_audit('PRO_SHOWCASE_UPDATED', 'PRO_SOCIAL_PROFILE', (string)$user['id'], ['mode' => $availabilityMode]);

json_response([
    'status'           => 'ok',
    'availabilityMode' => $availabilityMode,
    'openHour'         => $openHour,
    'closeHour'        => $closeHour,
    'message'          => 'Çalışma saatleriniz, açık/kapalı durumunuz ve vitrin fiyat listeniz güncellendi.',
]);
