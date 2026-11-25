<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
$method  = admin_method();
$payload = $method === 'POST' ? read_json_body() : [];
$action  = admin_action($payload);
$pdo     = db();

if ($method === 'GET') {
    if ($action === 'streams') {
        require_admin_permission('live.view');
        $stmt = $pdo->prepare(
            "SELECT s.id, s.stream_code, s.streamer_user_id, u.full_name AS streamer_name, s.cluster_code, s.work_title,
                    s.city, s.viewer_count, s.total_gift_coins, s.creator_net_earned_kurus, s.stream_status, s.started_at
             FROM live_work_streams s JOIN users u ON u.id = s.streamer_user_id
             WHERE s.stream_status IN ('LIVE', 'SUSPENDED') ORDER BY s.viewer_count DESC LIMIT 200"
        );
        $stmt->execute();
        json_response(['success' => true, 'rows' => $stmt->fetchAll()]);
    }

    if ($action === 'gifts') {
        require_admin_permission('live.view');
        $stmt = $pdo->prepare(
            'SELECT receipt_code, stream_id, sender_user_id, streamer_user_id, cluster_code, gift_code, gift_tier, quantity,
                    total_coins, gross_amount_kurus, creator_net_kurus, platform_fee_kurus, created_at
             FROM live_gift_transactions ORDER BY id DESC LIMIT 500'
        );
        $stmt->execute();
        $report = $pdo->prepare(
            'SELECT cluster_code, COUNT(*) AS tx_count, SUM(gross_amount_kurus) AS gross_kurus,
                    SUM(creator_net_kurus) AS creator_net_kurus, SUM(platform_fee_kurus) AS platform_fee_kurus
             FROM live_gift_transactions GROUP BY cluster_code ORDER BY gross_kurus DESC'
        );
        $report->execute();
        $split = array_map(static function (array $r): array {
            $gross = (int)$r['gross_kurus'];
            $net = (int)$r['creator_net_kurus'];
            $fee = (int)$r['platform_fee_kurus'];
            return [
                'cluster_code'       => (string)$r['cluster_code'],
                'tx_count'           => (int)$r['tx_count'],
                'gross_kurus'        => $gross,
                'creator_net_kurus'  => $net,
                'platform_fee_kurus' => $fee,
                'conserved'          => $net + $fee === $gross,
            ];
        }, $report->fetchAll());
        json_response(['success' => true, 'rows' => $stmt->fetchAll(), 'split_report' => $split]);
    }

    if ($action === 'suspicious') {
        require_admin_permission('live.view');
        $days = max(1, min(90, (int)($_GET['days'] ?? 7)));
        $stmt = $pdo->prepare(
            'SELECT sender_user_id AS sender, streamer_user_id AS streamer, SUM(gross_amount_kurus) AS gross_kurus, COUNT(*) AS tx_count
             FROM live_gift_transactions
             WHERE created_at >= (NOW() - INTERVAL :d DAY)
             GROUP BY sender_user_id, streamer_user_id'
        );
        $stmt->bindValue(':d', $days, PDO::PARAM_INT);
        $stmt->execute();
        $edges = $stmt->fetchAll();
        $cycles = admin_detect_gift_cycles(array_map(static fn(array $e): array => ['sender' => (int)$e['sender'], 'streamer' => (int)$e['streamer']], $edges));
        json_response(['success' => true, 'window_days' => $days, 'cycles' => $cycles, 'edges' => $edges]);
    }

    json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
}

if ($method !== 'POST' || $action !== 'suspend') {
    json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
}

$admin = require_admin_permission('live.suspend');
require_admin_csrf($admin);
$reason = require_admin_reason($payload);
$streamId = (int)($payload['stream_id'] ?? 0);
$pdo->beginTransaction();
try {
    $lock = $pdo->prepare('SELECT id, stream_status FROM live_work_streams WHERE id = :id FOR UPDATE');
    $lock->execute([':id' => $streamId]);
    $row = $lock->fetch();
    if (!$row || $row['stream_status'] !== 'LIVE') {
        $pdo->rollBack();
        json_response(['success' => false, 'error' => 'STREAM_NOT_LIVE'], 409);
    }
    $upd = $pdo->prepare("UPDATE live_work_streams SET stream_status = 'SUSPENDED', suspended_by_admin_id = :a, suspended_reason = :r, ended_at = NOW() WHERE id = :id");
    $upd->execute([':a' => $admin['id'], ':r' => $reason, ':id' => $streamId]);
    admin_audit($admin, 'LIVE_STREAM_SUSPENDED', 'LIVE_STREAM', (string)$streamId, ['stream_status' => 'LIVE'], ['stream_status' => 'SUSPENDED'], $reason);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}
json_response(['success' => true]);
