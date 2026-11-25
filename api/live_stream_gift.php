<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

$giftCatalog = [
    'GOLDEN_WRENCH'     => ['cluster' => 'HOME_TECH',         'title' => 'Altın Anahtar',   'tier' => 'STANDARD', 'coins' => 50],
    'THERMAL_LENS'      => ['cluster' => 'HOME_TECH',         'title' => 'Termal Kamera',   'tier' => 'PRO',      'coins' => 200],
    'MASTER_TOOLBOX'    => ['cluster' => 'HOME_TECH',         'title' => 'Takım Sandığı',   'tier' => 'LEGEND',   'coins' => 500],
    'CERAMIC_ROTOR'     => ['cluster' => 'AUTO_LOGISTICS',    'title' => 'Seramik Disk',    'tier' => 'STANDARD', 'coins' => 100],
    'TWIN_TURBO'        => ['cluster' => 'AUTO_LOGISTICS',    'title' => 'Twin Turbo',      'tier' => 'PRO',      'coins' => 400],
    'GOLDEN_PISTON'     => ['cluster' => 'AUTO_LOGISTICS',    'title' => 'Altın Piston',    'tier' => 'LEGEND',   'coins' => 1000],
    'CINEMA_CLAPPER'    => ['cluster' => 'EVENTS_MEDIA',      'title' => 'Sinema Klaketi',  'tier' => 'STANDARD', 'coins' => 100],
    'GIMBAL_8K'         => ['cluster' => 'EVENTS_MEDIA',      'title' => '8K Gimbal Lens',  'tier' => 'PRO',      'coins' => 350],
    'PRO_DRONE'         => ['cluster' => 'EVENTS_MEDIA',      'title' => '4K Pro Drone',    'tier' => 'LEGEND',   'coins' => 800],
    'MECH_KEY'          => ['cluster' => 'DIGITAL_AI',        'title' => 'Mekanik Tuş',     'tier' => 'STANDARD', 'coins' => 80],
    'NEURAL_GPU'        => ['cluster' => 'DIGITAL_AI',        'title' => 'Nöral GPU Çipi',  'tier' => 'PRO',      'coins' => 300],
    'QUANTUM_RACK'      => ['cluster' => 'DIGITAL_AI',        'title' => 'Kuantum Kabin',   'tier' => 'LEGEND',   'coins' => 900],
    'TITANIUM_SHEARS'   => ['cluster' => 'PERSONAL_WELLNESS', 'title' => 'Titanyum Makas',  'tier' => 'STANDARD', 'coins' => 80],
    'SAPPHIRE_ELIXIR'   => ['cluster' => 'PERSONAL_WELLNESS', 'title' => 'Safir Bakım',     'tier' => 'PRO',      'coins' => 250],
    'VIP_CROWN'         => ['cluster' => 'PERSONAL_WELLNESS', 'title' => 'Stil Tacı',       'tier' => 'LEGEND',   'coins' => 750],
    'ARCH_COMPASS'      => ['cluster' => 'EDUCATION_CONSULT', 'title' => 'Mimari Pergel',   'tier' => 'STANDARD', 'coins' => 80],
    'GOLD_FOUNTAIN_PEN' => ['cluster' => 'EDUCATION_CONSULT', 'title' => 'Dolma Kalem',     'tier' => 'PRO',      'coins' => 250],
    'MASTER_CHARTER'    => ['cluster' => 'EDUCATION_CONSULT', 'title' => 'Başusta Beratı',  'tier' => 'LEGEND',   'coins' => 700],
];

if ($method === 'GET') {
    $cluster = strtoupper(trim((string)($_GET['clusterCode'] ?? 'ALL')));
    $stmt    = db()->prepare(
        'SELECT id, stream_code, streamer_user_id, cluster_code, work_title,
                current_stage_label, city, viewer_count, total_gift_coins,
                creator_net_earned_kurus, stream_status, started_at
         FROM live_work_streams
         WHERE stream_status = :status
           AND (:cluster = "ALL" OR cluster_code = :cluster2)
         ORDER BY viewer_count DESC
         LIMIT 30'
    );
    $stmt->execute([
        ':status'   => 'LIVE',
        ':cluster'  => $cluster,
        ':cluster2' => $cluster,
    ]);

    $streams = [];
    foreach ($stmt->fetchAll() as $row) {
        $streams[] = [
            'id'                 => (int)$row['id'],
            'streamCode'         => e((string)$row['stream_code']),
            'streamerUserId'     => (int)$row['streamer_user_id'],
            'clusterCode'        => e((string)$row['cluster_code']),
            'workTitle'          => e((string)$row['work_title']),
            'currentStageLabel'  => e((string)$row['current_stage_label']),
            'city'               => e((string)$row['city']),
            'viewerCount'        => (int)$row['viewer_count'],
            'totalGiftCoins'     => (int)$row['total_gift_coins'],
            'creatorNetEarnedTl' => round(((int)$row['creator_net_earned_kurus']) / 100, 2),
        ];
    }

    json_response([
        'status'  => 'ok',
        'streams' => $streams,
        'catalog' => $giftCatalog,
    ]);
}

if ($method !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Desteklenmeyen HTTP metodu.'], 405);
}

$user    = require_authenticated_user(['CUSTOMER', 'MASTER', 'ADMIN']);
$payload = read_json_body();
require_valid_csrf($payload);

$streamId       = (int)($payload['streamId'] ?? 0);
$streamerUserId = (int)($payload['streamerUserId'] ?? 0);
$giftCode       = strtoupper(trim((string)($payload['giftCode'] ?? '')));
$quantity       = min(100, max(1, (int)($payload['quantity'] ?? 1)));
$rawNote        = trim((string)($payload['note'] ?? ''));

if ($streamId <= 0 || $streamerUserId <= 0 || !isset($giftCatalog[$giftCode])) {
    json_response(['status' => 'error', 'message' => 'Geçerli bir canlı yayın ve meslek hediyesi seçilmelidir.'], 400);
}

// Anti-IDOR / AML Guard: Streamer cannot send gifts to their own live stream
if ((int)$user['id'] === $streamerUserId) {
    json_response(['status' => 'error', 'message' => 'Yayıncı kendi canlı yayınına hediye gönderemez.'], 403);
}

$gift            = $giftCatalog[$giftCode];
$totalCoins      = ((int)$gift['coins']) * $quantity;
$grossKurus      = $totalCoins * 50; // 1 Jeton = 50 kuruş
$platformFeeKurus = (int)round(($grossKurus * 1500) / 10000);
$creatorNetKurus = $grossKurus - $platformFeeKurus;
$receiptCode     = 'GFT-2026-' . $streamId . '-' . bin2hex(random_bytes(4));

$safeNote = preg_replace('/\b(?:\+?90|0)?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/', '+905**[KVKK]**', $rawNote) ?? $rawNote;

$pdo = db();
$pdo->beginTransaction();
try {
    $insertStmt = $pdo->prepare(
        'INSERT INTO live_gift_transactions (
            receipt_code, stream_id, sender_user_id, streamer_user_id,
            cluster_code, gift_code, gift_tier, quantity, total_coins,
            gross_amount_kurus, creator_net_kurus, platform_fee_kurus,
            supporter_note, created_at
         ) VALUES (
            :rcode, :sid, :uid, :proid,
            :cluster, :gcode, :gtier, :qty, :coins,
            :gross, :net, :fee,
            :note, NOW()
         )'
    );
    $insertStmt->execute([
        ':rcode'   => $receiptCode,
        ':sid'     => $streamId,
        ':uid'     => $user['id'],
        ':proid'   => $streamerUserId,
        ':cluster' => $gift['cluster'],
        ':gcode'   => $giftCode,
        ':gtier'   => $gift['tier'],
        ':qty'     => $quantity,
        ':coins'   => $totalCoins,
        ':gross'   => $grossKurus,
        ':net'     => $creatorNetKurus,
        ':fee'     => $platformFeeKurus,
        ':note'    => mb_substr($safeNote, 0, 240),
    ]);

    $updateStmt = $pdo->prepare(
        'UPDATE live_work_streams
         SET total_gift_coins = total_gift_coins + :coins,
             creator_net_earned_kurus = creator_net_earned_kurus + :net
         WHERE id = :sid'
    );
    $updateStmt->execute([
        ':coins' => $totalCoins,
        ':net'   => $creatorNetKurus,
        ':sid'   => $streamId,
    ]);

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

log_security_audit('LIVE_STREAM_GIFT_SENT', 'LIVE_STREAM', (string)$streamId, [
    'receipt' => $receiptCode,
    'gift'    => $giftCode,
    'coins'   => $totalCoins,
]);

json_response([
    'status'        => 'ok',
    'receiptCode'   => $receiptCode,
    'giftCode'      => $giftCode,
    'giftTitle'     => $gift['title'],
    'quantity'      => $quantity,
    'totalCoins'    => $totalCoins,
    'grossTl'       => round($grossKurus / 100, 2),
    'creatorNetTl'  => round($creatorNetKurus / 100, 2),
    'platformFeeTl' => round($platformFeeKurus / 100, 2),
], 201);
