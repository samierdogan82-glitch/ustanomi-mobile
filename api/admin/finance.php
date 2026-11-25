<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
$method  = admin_method();
$payload = $method === 'POST' ? read_json_body() : [];
$action  = admin_action($payload);
$pdo     = db();

/**
 * Released escrow transactions that are not yet in a payout batch, with the fee version
 * that was in force when the job was created (never the current rate).
 * @return list<array<string, mixed>>
 */
function admin_payable_rows(PDO $pdo, bool $forUpdate = false): array {
    $sql = "SELECT t.id AS tx_id, t.amount_cents, t.created_at AS tx_created_at, r.id AS request_id, r.request_code,
                   r.master_id, r.created_at AS request_created_at, u.full_name AS master_name
            FROM escrow_transactions t
            JOIN service_requests r ON r.id = t.service_request_id
            LEFT JOIN users u ON u.id = r.master_id
            WHERE t.status = 'RELEASED_TO_MASTER' AND t.payout_batch_id IS NULL
            ORDER BY t.id ASC LIMIT 1000" . ($forUpdate ? ' FOR UPDATE' : '');
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $split = admin_split_kurus((int)$r['amount_cents'], admin_escrow_fee_bps_at((string)$r['request_created_at']));
        $rows[] = [
            'tx_id'              => (int)$r['tx_id'],
            'request_code'       => (string)$r['request_code'],
            'master_id'          => $r['master_id'] !== null ? (int)$r['master_id'] : null,
            'master_name'        => (string)($r['master_name'] ?? ''),
            'gross_kurus'        => (int)$r['amount_cents'],
            'pro_net_kurus'      => $split['net_kurus'],
            'platform_fee_kurus' => $split['fee_kurus'],
        ];
    }
    return $rows;
}

function admin_commission_report(PDO $pdo): array {
    $stmt = $pdo->prepare(
        "SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, 'ESCROW' AS source,
                SUM(total_amount_kurus) AS gross_kurus, SUM(platform_commission_kurus) AS fee_kurus, SUM(sub_merchant_share_kurus) AS net_kurus
         FROM ledger_transactions GROUP BY month
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, 'LIVE_GIFT' AS source,
                SUM(gross_amount_kurus), SUM(platform_fee_kurus), SUM(creator_net_kurus)
         FROM live_gift_transactions GROUP BY month
         ORDER BY month DESC, source ASC"
    );
    $stmt->execute();
    return array_map(static fn(array $r): array => [
        'month'       => (string)$r['month'],
        'source'      => (string)$r['source'],
        'gross_kurus' => (int)$r['gross_kurus'],
        'fee_kurus'   => (int)$r['fee_kurus'],
        'net_kurus'   => (int)$r['net_kurus'],
    ], $stmt->fetchAll());
}

if ($method === 'GET') {
    if ($action === 'payouts') {
        require_admin_permission('finance.view');
        $batches = $pdo->prepare(
            'SELECT b.id, b.batch_code, b.status, b.items_count, b.gross_kurus, b.pro_net_kurus, b.platform_fee_kurus, b.created_at,
                    c.full_name AS created_by, a.full_name AS approved_by, b.approved_at
             FROM payout_batches b
             JOIN admin_users c ON c.id = b.created_by_admin_id
             LEFT JOIN admin_users a ON a.id = b.approved_by_admin_id
             ORDER BY b.id DESC LIMIT 100'
        );
        $batches->execute();
        json_response(['success' => true, 'payable' => admin_payable_rows($pdo), 'batches' => $batches->fetchAll()]);
    }

    if ($action === 'commission') {
        require_admin_permission('finance.view');
        json_response(['success' => true, 'rows' => admin_commission_report($pdo)]);
    }

    if ($action === 'efatura') {
        require_admin_permission('finance.view');
        $summary = $pdo->prepare('SELECT efatura_status, COUNT(*) AS cnt, COALESCE(SUM(amount_cents),0) AS gross_kurus FROM escrow_transactions GROUP BY efatura_status');
        $summary->execute();
        $failed = $pdo->prepare(
            "SELECT t.id, r.request_code, t.amount_cents, t.efatura_status, t.efatura_uuid, t.updated_at
             FROM escrow_transactions t JOIN service_requests r ON r.id = t.service_request_id
             WHERE t.efatura_status IN ('FAILED', 'QUEUED') ORDER BY t.updated_at DESC LIMIT 200"
        );
        $failed->execute();
        json_response(['success' => true, 'summary' => $summary->fetchAll(), 'attention' => $failed->fetchAll()]);
    }

    if ($action === 'export') {
        $admin = require_admin_permission('finance.export');
        $report = (string)($_GET['report'] ?? 'commission');
        $rows = $report === 'payable' ? admin_payable_rows($pdo) : admin_commission_report($pdo);
        admin_audit($admin, 'FINANCE_EXPORTED', 'REPORT', $report, null, ['rows' => count($rows)], '');
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="ustanomi-' . ($report === 'payable' ? 'hakedis' : 'komisyon') . '-' . gmdate('Ymd') . '.csv"');
        header('Cache-Control: no-store');
        $out = fopen('php://output', 'wb');
        // UTF-8 BOM in the CSV *output* so Excel shows Turkish characters correctly.
        fwrite($out, "\xEF\xBB\xBF");
        if ($rows) {
            fputcsv($out, array_keys($rows[0]), ';');
            foreach ($rows as $row) {
                // Neutralise spreadsheet formula injection.
                fputcsv($out, array_map(static fn($v): string => preg_match('/^[=+\-@]/', (string)$v) ? "'" . $v : (string)$v, $row), ';');
            }
        }
        fclose($out);
        exit;
    }

    json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
}

if ($method !== 'POST') {
    json_response(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
}

if ($action === 'payout_create') {
    $admin = require_admin_permission('finance.payout_create');
    require_admin_csrf($admin);
    $idem = require_idempotency_key();
    $txIds = array_values(array_unique(array_map('intval', is_array($payload['tx_ids'] ?? null) ? $payload['tx_ids'] : [])));
    if ($txIds === [] || count($txIds) > 1000) {
        json_response(['success' => false, 'error' => 'TX_IDS_REQUIRED'], 422);
    }

    $pdo->beginTransaction();
    try {
        $dup = $pdo->prepare('SELECT id, batch_code FROM payout_batches WHERE idempotency_key = :k LIMIT 1');
        $dup->execute([':k' => $idem]);
        if ($existing = $dup->fetch()) {
            $pdo->rollBack();
            json_response(['success' => true, 'batch_id' => (int)$existing['id'], 'batch_code' => $existing['batch_code'], 'idempotent_replay' => true]);
        }
        $payable = admin_payable_rows($pdo, true);
        $byId = [];
        foreach ($payable as $p) {
            $byId[$p['tx_id']] = $p;
        }
        $items = [];
        foreach ($txIds as $id) {
            if (!isset($byId[$id])) {
                $pdo->rollBack();
                json_response(['success' => false, 'error' => 'TX_NOT_PAYABLE', 'tx_id' => $id], 409);
            }
            $items[] = $byId[$id];
        }
        admin_assert_not_party($admin, array_column($items, 'master_id'));
        $gross = array_sum(array_column($items, 'gross_kurus'));
        $net = array_sum(array_column($items, 'pro_net_kurus'));
        $fee = array_sum(array_column($items, 'platform_fee_kurus'));
        if ($net + $fee !== $gross) {
            throw new RuntimeException('KURUS_CONSERVATION_VIOLATION');
        }
        $code = 'PAY-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
        $ins = $pdo->prepare(
            'INSERT INTO payout_batches (batch_code, idempotency_key, items_count, gross_kurus, pro_net_kurus, platform_fee_kurus, items_json, created_by_admin_id)
             VALUES (:c, :k, :n, :g, :net, :fee, :items, :a)'
        );
        $ins->execute([':c' => $code, ':k' => $idem, ':n' => count($items), ':g' => $gross, ':net' => $net, ':fee' => $fee, ':items' => json_encode($items, JSON_UNESCAPED_UNICODE), ':a' => $admin['id']]);
        $batchId = (int)$pdo->lastInsertId();
        $mark = $pdo->prepare('UPDATE escrow_transactions SET payout_batch_id = :b WHERE id = :id AND payout_batch_id IS NULL');
        foreach ($txIds as $id) {
            $mark->execute([':b' => $batchId, ':id' => $id]);
            if ($mark->rowCount() !== 1) {
                throw new RuntimeException('TX_ALREADY_BATCHED');
            }
        }
        admin_audit($admin, 'PAYOUT_BATCH_CREATED', 'PAYOUT_BATCH', (string)$batchId, null,
            ['batch_code' => $code, 'items' => count($items), 'gross_kurus' => $gross, 'pro_net_kurus' => $net, 'platform_fee_kurus' => $fee, 'idempotency_key' => $idem], '');
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    json_response(['success' => true, 'batch_id' => $batchId, 'batch_code' => $code], 201);
}

if ($action === 'payout_approve') {
    $admin = require_admin_permission('finance.payout_approve');
    require_admin_csrf($admin);
    $idem = require_idempotency_key();
    $reason = require_admin_reason($payload);
    $batchId = (int)($payload['batch_id'] ?? 0);
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT id, status, created_by_admin_id, items_json FROM payout_batches WHERE id = :id FOR UPDATE');
        $lock->execute([':id' => $batchId]);
        $b = $lock->fetch();
        if (!$b || $b['status'] !== 'PENDING_APPROVAL') {
            $pdo->rollBack();
            json_response(['success' => false, 'error' => 'BATCH_NOT_PENDING'], 409);
        }
        if ((int)$b['created_by_admin_id'] === $admin['id']) {
            $pdo->rollBack();
            json_response(['success' => false, 'error' => 'FOUR_EYES_REQUIRED'], 403);
        }
        $items = json_decode((string)$b['items_json'], true) ?: [];
        admin_assert_not_party($admin, array_column($items, 'master_id'));
        $upd = $pdo->prepare("UPDATE payout_batches SET status = 'APPROVED', approved_by_admin_id = :a, approved_at = NOW() WHERE id = :id");
        $upd->execute([':a' => $admin['id'], ':id' => $batchId]);
        admin_audit($admin, 'PAYOUT_BATCH_APPROVED', 'PAYOUT_BATCH', (string)$batchId, ['status' => 'PENDING_APPROVAL'], ['status' => 'APPROVED', 'idempotency_key' => $idem], $reason);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    json_response(['success' => true, 'status' => 'APPROVED']);
}

json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
