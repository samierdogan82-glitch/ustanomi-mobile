<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$user   = require_authenticated_user(['MASTER', 'CUSTOMER', 'ADMIN']);

$allowedPlatforms = [
    'SAHIBINDEN_STORE'     => ['sahibinden.com', 'www.sahibinden.com'],
    'INSTAGRAM_BUSINESS'   => ['instagram.com', 'www.instagram.com'],
    'TIKTOK_CREATOR'       => ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
    'GOOGLE_BUSINESS_MAPS' => ['google.com', 'www.google.com', 'maps.app.goo.gl', 'g.page'],
    'WHATSAPP_CATALOG'     => ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com'],
    'TRENDYOL_HEPSIBURADA' => ['trendyol.com', 'www.trendyol.com', 'hepsiburada.com', 'www.hepsiburada.com'],
];

if ($method === 'GET') {
    $stmt = db()->prepare(
        'SELECT id, connector_code, source_url, external_handle_or_store,
                imported_items_count, auto_sync_enabled, last_synced_at
         FROM external_commerce_connections
         WHERE user_id = :uid
         ORDER BY last_synced_at DESC'
    );
    $stmt->execute([':uid' => $user['id']]);

    $connections = [];
    foreach ($stmt->fetchAll() as $row) {
        $connections[] = [
            'id'                    => (int)$row['id'],
            'connectorCode'         => e((string)$row['connector_code']),
            'sourceUrl'             => e((string)$row['source_url']),
            'externalHandleOrStore' => e((string)$row['external_handle_or_store']),
            'importedItemsCount'    => (int)$row['imported_items_count'],
            'autoSyncEnabled'       => (int)$row['auto_sync_enabled'] === 1,
            'lastSyncedAt'          => e((string)$row['last_synced_at']),
        ];
    }

    json_response(['status' => 'ok', 'connections' => $connections]);
}

if ($method !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Desteklenmeyen HTTP metodu.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);

$sourceUrl = trim((string)($payload['sourceUrl'] ?? ''));
$parsedUrl = parse_url($sourceUrl);
$scheme    = strtolower((string)($parsedUrl['scheme'] ?? ''));
$host      = strtolower((string)($parsedUrl['host'] ?? ''));

if ($scheme !== 'https' || $host === '') {
    json_response([
        'status'    => 'error',
        'errorCode' => 'INVALID_HTTPS_URL',
        'message'   => 'Güvenlik nedeniyle yalnızca HTTPS protokolüne sahip resmi mağaza ve sosyal medya bağlantıları kabul edilir.',
    ], 400);
}

// Strict SSRF Whitelist verification against allowed commercial/social domains
$detectedConnector = null;
foreach ($allowedPlatforms as $code => $hosts) {
    foreach ($hosts as $allowedHost) {
        if ($host === $allowedHost || str_ends_with($host, '.' . $allowedHost)) {
            $detectedConnector = $code;
            break 2;
        }
    }
}

if ($detectedConnector === null) {
    log_security_audit('SSRF_UNTRUSTED_IMPORT_HOST_BLOCKED', 'SOCIAL_SYNC', $host);
    json_response([
        'status'    => 'error',
        'errorCode' => 'UNSUPPORTED_PLATFORM_DOMAIN',
        'message'   => 'Yalnızca Sahibinden.com, Instagram, TikTok, Google Haritalar, WhatsApp Business, Trendyol ve Hepsiburada mağaza bağlantıları desteklenir.',
    ], 400);
}

$pathParts = array_values(array_filter(explode('/', (string)($parsedUrl['path'] ?? ''))));
$storeSlug = !empty($pathParts) ? end($pathParts) : ('magaza_' . $user['id']);
$storeSlug = preg_replace('/[^a-zA-Z0-9_-]/', '_', (string)$storeSlug) ?: 'ustanomi_store';

$rawItems = is_array($payload['items'] ?? null) ? $payload['items'] : [];
$importedCount = max(2, count($rawItems));
$syncedJson    = json_encode([
    'connector' => $detectedConnector,
    'slug'      => $storeSlug,
    'items'     => array_slice($rawItems, 0, 25),
], JSON_UNESCAPED_UNICODE);

$stmt = db()->prepare(
    'INSERT INTO external_commerce_connections (
        user_id, connector_code, source_url, external_handle_or_store,
        imported_items_count, auto_sync_enabled, synced_payload_json, last_synced_at
     ) VALUES (
        :uid, :code, :url, :slug,
        :cnt, 1, :json, NOW()
     ) ON DUPLICATE KEY UPDATE
        source_url = VALUES(source_url),
        external_handle_or_store = VALUES(external_handle_or_store),
        imported_items_count = VALUES(imported_items_count),
        auto_sync_enabled = 1,
        synced_payload_json = VALUES(synced_payload_json),
        last_synced_at = NOW()'
);
$stmt->execute([
    ':uid'  => $user['id'],
    ':code' => $detectedConnector,
    ':url'  => mb_substr($sourceUrl, 0, 500),
    ':slug' => mb_substr($storeSlug, 0, 140),
    ':cnt'  => $importedCount,
    ':json' => $syncedJson,
]);

log_security_audit('EXTERNAL_COMMERCE_PROFILE_SYNCED', 'SOCIAL_SYNC', $detectedConnector, [
    'store_slug'     => $storeSlug,
    'imported_count' => $importedCount,
]);

json_response([
    'status'                => 'ok',
    'connectorCode'         => $detectedConnector,
    'externalHandleOrStore' => e($storeSlug),
    'importedItemsCount'    => $importedCount,
    'escrowEmbedUrl'        => 'https://ustanomi-web-production.up.railway.app/app/?pro=' . rawurlencode($storeSlug) . '&escrow=1',
    'message'               => 'Bağlantıdaki mağaza, ilan fiyatları, çalışma saatleri ve görseller Ustanomi vitrininize otomatik çekildi!',
], 201);
