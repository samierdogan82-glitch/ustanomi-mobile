<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
$method  = admin_method();
$payload = $method === 'POST' ? read_json_body() : [];
$action  = admin_action($payload);
$pdo     = db();

/** @return array{wet_signature:bool, cargo_waybill:bool, before_photo:bool, after_photo:bool, documents:list<array<string,mixed>>} */
function admin_dispute_evidence(PDO $pdo, int $requestId): array {
    $stmt = $pdo->prepare('SELECT id, doc_category, detected_mime, created_at FROM uploaded_documents WHERE service_request_id = :id ORDER BY id ASC');
    $stmt->execute([':id' => $requestId]);
    $docs = $stmt->fetchAll();
    $has = static fn(string $cat): bool => count(array_filter($docs, static fn(array $d): bool => $d['doc_category'] === $cat)) > 0;
    return [
        'wet_signature' => $has('WET_SIGNATURE'),
        'cargo_waybill' => $has('CARGO_WAYBILL'),
        'before_photo'  => $has('BEFORE_PHOTO') || $has('SITE_PHOTO'),
        'after_photo'   => $has('AFTER_PHOTO'),
        'documents'     => $docs,
    ];
}

if ($method === 'GET' && $action === 'list') {
    require_admin_permission('disputes.view');
    $stmt = $pdo->prepare(
        "SELECT id, request_code, title, customer_id, master_id, agreed_amount_cents, created_at
         FROM service_requests WHERE escrow_status = 'DISPUTED' ORDER BY id ASC LIMIT 200"
    );
    $stmt->execute();
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $evidence = admin_dispute_evidence($pdo, (int)$r['id']);
        $total = (int)$r['agreed_amount_cents'];
        $suggestion = $total > 0
            ? admin_suggest_dispute_decision($total, $evidence, 0, admin_escrow_fee_bps_at((string)$r['created_at']))
            : null;
        $rows[] = [
            'id'           => (int)$r['id'],
            'request_code' => (string)$r['request_code'],
            'title'        => (string)$r['title'],
            'customer_id'  => (int)$r['customer_id'],
            'master_id'    => $r['master_id'] !== null ? (int)$r['master_id'] : null,
            'total_kurus'  => $total,
            'evidence'     => $evidence,
            'suggestion'   => $suggestion,
        ];
    }
    json_response(['success' => true, 'rows' => $rows]);
}

if ($method === 'GET' && $action === 'decisions') {
    require_admin_permission('disputes.view');
    $stmt = $pdo->prepare(
        'SELECT d.service_request_id, d.total_kurus, d.suggested_decision, d.final_decision, d.customer_refund_kurus,
                d.pro_payout_kurus, d.platform_fee_kurus, d.reason, d.created_at, a.full_name AS decided_by
         FROM escrow_dispute_decisions d JOIN admin_users a ON a.id = d.decided_by_admin_id
         ORDER BY d.id DESC LIMIT 200'
    );
    $stmt->execute();
    json_response(['success' => true, 'rows' => $stmt->fetchAll()]);
}

if ($method !== 'POST' || $action !== 'decide') {
    json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
}

$admin = require_admin_permission('disputes.decide');
require_admin_csrf($admin);
$idem = require_idempotency_key();
$reason = require_admin_reason($payload);
$requestId = (int)($payload['service_request_id'] ?? 0);
$final = (string)($payload['final_decision'] ?? '');
$completionPct = (int)($payload['completion_pct'] ?? 0);
if (!in_array($final, ['RELEASE_FULL_TO_PRO', 'PARTIAL_SETTLEMENT', 'FULL_REFUND_TO_CUSTOMER'], true)) {
    json_response(['success' => false, 'error' => 'INVALID_DECISION'], 422);
}
if ($final === 'PARTIAL_SETTLEMENT' && ($completionPct < 1 || $completionPct > 99)) {
    json_response(['success' => false, 'error' => 'COMPLETION_PCT_REQUIRED'], 422);
}

$pdo->beginTransaction();
try {
    $dup = $pdo->prepare('SELECT service_request_id FROM escrow_dispute_decisions WHERE idempotency_key = :k LIMIT 1');
    $dup->execute([':k' => $idem]);
    if ($dup->fetch()) {
        $pdo->rollBack();
        json_response(['success' => true, 'idempotent_replay' => true]);
    }
    $lock = $pdo->prepare('SELECT id, customer_id, master_id, agreed_amount_cents, escrow_status, created_at FROM service_requests WHERE id = :id FOR UPDATE');
    $lock->execute([':id' => $requestId]);
    $req = $lock->fetch();
    if (!$req || $req['escrow_status'] !== 'DISPUTED') {
        $pdo->rollBack();
        json_response(['success' => false, 'error' => 'DISPUTE_NOT_OPEN'], 409);
    }
    admin_assert_not_party($admin, [(int)$req['customer_id'], $req['master_id'] !== null ? (int)$req['master_id'] : null]);

    $total = (int)$req['agreed_amount_cents'];
    $feeBps = admin_escrow_fee_bps_at((string)$req['created_at']);
    $evidence = admin_dispute_evidence($pdo, $requestId);
    $suggestion = admin_suggest_dispute_decision($total, $evidence, $completionPct, $feeBps);

    if ($final === 'RELEASE_FULL_TO_PRO') {
        $s = admin_split_kurus($total, $feeBps);
        $refund = 0;
        $pro = $s['net_kurus'];
        $fee = $s['fee_kurus'];
    } elseif ($final === 'PARTIAL_SETTLEMENT') {
        $proGross = intdiv($total * $completionPct + 50, 100);
        $s = admin_split_kurus($proGross, $feeBps);
        $refund = $total - $proGross;
        $pro = $s['net_kurus'];
        $fee = $s['fee_kurus'];
    } else {
        $refund = $total;
        $pro = 0;
        $fee = 0;
    }
    if ($refund + $pro + $fee !== $total) {
        throw new RuntimeException('KURUS_CONSERVATION_VIOLATION');
    }
    $next = $final === 'FULL_REFUND_TO_CUSTOMER' ? 'REFUNDED' : 'CUSTOMER_APPROVED_RELEASED';
    if (!can_transition_escrow('DISPUTED', $next)) {
        throw new RuntimeException('INVALID_ESCROW_TRANSITION');
    }

    $evidenceJson = json_encode(array_diff_key($evidence, ['documents' => true]) + ['document_ids' => array_column($evidence['documents'], 'id')], JSON_UNESCAPED_UNICODE);
    $ins = $pdo->prepare(
        'INSERT INTO escrow_dispute_decisions (idempotency_key, service_request_id, total_kurus, suggested_decision, final_decision,
            customer_refund_kurus, pro_payout_kurus, platform_fee_kurus, evidence_json, reason, decided_by_admin_id)
         VALUES (:k, :r, :t, :sug, :fin, :ref, :pro, :fee, :ev, :reason, :a)'
    );
    $ins->execute([
        ':k' => $idem, ':r' => $requestId, ':t' => $total, ':sug' => $suggestion['decision'], ':fin' => $final,
        ':ref' => $refund, ':pro' => $pro, ':fee' => $fee, ':ev' => $evidenceJson, ':reason' => $reason, ':a' => $admin['id'],
    ]);
    $upd = $pdo->prepare('UPDATE service_requests SET escrow_status = :s WHERE id = :id');
    $upd->execute([':s' => $next, ':id' => $requestId]);
    $tx = $pdo->prepare("UPDATE escrow_transactions SET status = :ts WHERE service_request_id = :id AND status = 'HELD'");
    $tx->execute([':ts' => $next === 'REFUNDED' ? 'REFUNDED_TO_CUSTOMER' : 'RELEASED_TO_MASTER', ':id' => $requestId]);
    admin_audit($admin, 'DISPUTE_DECIDED', 'ESCROW', (string)$requestId, ['escrow_status' => 'DISPUTED', 'suggested' => $suggestion['decision']],
        ['final_decision' => $final, 'customer_refund_kurus' => $refund, 'pro_payout_kurus' => $pro, 'platform_fee_kurus' => $fee, 'idempotency_key' => $idem], $reason);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}
json_response(['success' => true, 'final_decision' => $final, 'customer_refund_kurus' => $refund, 'pro_payout_kurus' => $pro, 'platform_fee_kurus' => $fee]);
