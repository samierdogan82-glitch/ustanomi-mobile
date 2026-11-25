<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
$method  = admin_method();
$payload = $method === 'POST' ? read_json_body() : [];
$action  = admin_action($payload);
$pdo     = db();

/** 30/40/30 milestone split in integer kuruş; the last milestone absorbs rounding. */
function admin_milestones_kurus(int $totalKurus): array {
    $m1 = intdiv($totalKurus * 30 + 50, 100);
    $m2 = intdiv($totalKurus * 40 + 50, 100);
    return [$m1, $m2, $totalKurus - $m1 - $m2];
}

if ($method === 'GET') {
    if ($action === 'list') {
        require_admin_permission('escrow.view');
        $p = admin_pagination();
        $status = (string)($_GET['status'] ?? '');
        $sql = 'SELECT r.id, r.request_code, r.title, r.customer_id, r.master_id, r.agreed_amount_cents, r.escrow_status,
                       r.released_milestones, r.created_at,
                       (SELECT t.status FROM escrow_transactions t WHERE t.service_request_id = r.id ORDER BY t.id DESC LIMIT 1) AS tx_status
                FROM service_requests r';
        $params = [];
        if (in_array($status, ['PENDING_PAYMENT', 'FUNDS_HELD_IN_POOL', 'WORK_IN_PROGRESS', 'CUSTOMER_APPROVED_RELEASED', 'DISPUTED', 'REFUNDED'], true)) {
            $sql .= ' WHERE r.escrow_status = :st';
            $params[':st'] = $status;
        }
        $sql .= ' ORDER BY r.id DESC LIMIT :lim OFFSET :off';
        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':lim', $p['limit'], PDO::PARAM_INT);
        $stmt->bindValue(':off', $p['offset'], PDO::PARAM_INT);
        $stmt->execute();
        $rows = [];
        foreach ($stmt->fetchAll() as $r) {
            $total = (int)$r['agreed_amount_cents'];
            $split = admin_split_kurus($total, admin_escrow_fee_bps_at((string)$r['created_at']));
            $rows[] = [
                'id'                  => (int)$r['id'],
                'request_code'        => (string)$r['request_code'],
                'title'               => (string)$r['title'],
                'customer_id'         => (int)$r['customer_id'],
                'master_id'           => $r['master_id'] !== null ? (int)$r['master_id'] : null,
                'total_kurus'         => $total,
                'pro_net_kurus'       => $split['net_kurus'],
                'platform_fee_kurus'  => $split['fee_kurus'],
                'milestones_kurus'    => admin_milestones_kurus($total),
                'released_milestones' => (int)$r['released_milestones'],
                'escrow_status'       => (string)$r['escrow_status'],
                'tx_status'           => $r['tx_status'],
                'created_at'          => (string)$r['created_at'],
            ];
        }
        json_response(['success' => true, 'rows' => $rows]);
    }

    if ($action === 'history') {
        require_admin_permission('escrow.view');
        $id = (int)($_GET['id'] ?? 0);
        $tx = $pdo->prepare('SELECT provider, provider_reference, amount_cents, status, created_at, updated_at FROM escrow_transactions WHERE service_request_id = :id ORDER BY id ASC');
        $tx->execute([':id' => $id]);
        $audit = $pdo->prepare(
            "SELECT action, admin_role, reason, created_at FROM admin_audit_log
             WHERE target_type = 'ESCROW' AND target_id = :id ORDER BY id ASC"
        );
        $audit->execute([':id' => (string)$id]);
        json_response(['success' => true, 'transactions' => $tx->fetchAll(), 'admin_actions' => $audit->fetchAll()]);
    }

    if ($action === 'approvals') {
        require_admin_permission('escrow.view');
        $stmt = $pdo->prepare(
            "SELECT d.id, d.action_type, d.service_request_id, d.amount_kurus, d.pro_net_kurus, d.platform_fee_kurus,
                    d.customer_refund_kurus, d.reason, d.status, d.created_at, a.full_name AS requested_by
             FROM admin_dual_approvals d JOIN admin_users a ON a.id = d.requested_by_admin_id
             WHERE d.status = 'PENDING' ORDER BY d.id ASC"
        );
        $stmt->execute();
        json_response(['success' => true, 'rows' => $stmt->fetchAll()]);
    }

    json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
}

if ($method !== 'POST') {
    json_response(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
}

if ($action === 'request') {
    $admin = require_admin_permission('escrow.request');
    require_admin_csrf($admin);
    $idem = require_idempotency_key();
    $reason = require_admin_reason($payload);
    $type = (string)($payload['type'] ?? '');
    if (!in_array($type, ['ESCROW_RELEASE', 'ESCROW_REFUND'], true)) {
        json_response(['success' => false, 'error' => 'INVALID_TYPE'], 422);
    }
    $requestId = (int)($payload['service_request_id'] ?? 0);

    $pdo->beginTransaction();
    try {
        $dup = $pdo->prepare('SELECT id, status FROM admin_dual_approvals WHERE idempotency_key = :k LIMIT 1');
        $dup->execute([':k' => $idem]);
        if ($existing = $dup->fetch()) {
            $pdo->rollBack();
            json_response(['success' => true, 'approval_id' => (int)$existing['id'], 'status' => $existing['status'], 'idempotent_replay' => true]);
        }
        $lock = $pdo->prepare('SELECT id, customer_id, master_id, agreed_amount_cents, escrow_status, created_at FROM service_requests WHERE id = :id FOR UPDATE');
        $lock->execute([':id' => $requestId]);
        $req = $lock->fetch();
        if (!$req) {
            $pdo->rollBack();
            json_response(['success' => false, 'error' => 'REQUEST_NOT_FOUND'], 404);
        }
        admin_assert_not_party($admin, [(int)$req['customer_id'], $req['master_id'] !== null ? (int)$req['master_id'] : null]);
        $target = $type === 'ESCROW_RELEASE' ? 'CUSTOMER_APPROVED_RELEASED' : 'REFUNDED';
        if (!can_transition_escrow((string)$req['escrow_status'], $target)) {
            $pdo->rollBack();
            json_response(['success' => false, 'error' => 'INVALID_ESCROW_TRANSITION', 'from' => $req['escrow_status'], 'to' => $target], 409);
        }
        $total = (int)$req['agreed_amount_cents'];
        if ($type === 'ESCROW_RELEASE') {
            $split = admin_split_kurus($total, admin_escrow_fee_bps_at((string)$req['created_at']));
            $net = $split['net_kurus'];
            $fee = $split['fee_kurus'];
            $refund = 0;
        } else {
            $net = 0;
            $fee = 0;
            $refund = $total;
        }
        $ins = $pdo->prepare(
            'INSERT INTO admin_dual_approvals (idempotency_key, action_type, service_request_id, amount_kurus, pro_net_kurus, platform_fee_kurus, customer_refund_kurus, reason, requested_by_admin_id)
             VALUES (:k, :t, :r, :amt, :net, :fee, :ref, :reason, :a)'
        );
        $ins->execute([':k' => $idem, ':t' => $type, ':r' => $requestId, ':amt' => $total, ':net' => $net, ':fee' => $fee, ':ref' => $refund, ':reason' => $reason, ':a' => $admin['id']]);
        $approvalId = (int)$pdo->lastInsertId();
        admin_audit($admin, $type . '_REQUESTED', 'ESCROW', (string)$requestId, ['escrow_status' => $req['escrow_status']],
            ['approval_id' => $approvalId, 'amount_kurus' => $total, 'pro_net_kurus' => $net, 'platform_fee_kurus' => $fee, 'customer_refund_kurus' => $refund], $reason);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    json_response(['success' => true, 'approval_id' => $approvalId, 'status' => 'PENDING'], 201);
}

if ($action === 'approve') {
    $admin = require_admin_permission('escrow.approve');
    require_admin_csrf($admin);
    $idem = require_idempotency_key();
    $reason = require_admin_reason($payload);
    $approvalId = (int)($payload['approval_id'] ?? 0);
    $decision = (string)($payload['decision'] ?? '');
    if (!in_array($decision, ['execute', 'reject'], true)) {
        json_response(['success' => false, 'error' => 'INVALID_DECISION'], 422);
    }

    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT * FROM admin_dual_approvals WHERE id = :id FOR UPDATE');
        $lock->execute([':id' => $approvalId]);
        $ap = $lock->fetch();
        if (!$ap || $ap['status'] !== 'PENDING') {
            $pdo->rollBack();
            json_response(['success' => false, 'error' => 'APPROVAL_NOT_PENDING'], 409);
        }
        if ((int)$ap['requested_by_admin_id'] === $admin['id']) {
            $pdo->rollBack();
            json_response(['success' => false, 'error' => 'FOUR_EYES_REQUIRED', 'message' => 'Talebi oluşturan kişi onaylayamaz.'], 403);
        }
        $reqLock = $pdo->prepare('SELECT id, customer_id, master_id, escrow_status FROM service_requests WHERE id = :id FOR UPDATE');
        $reqLock->execute([':id' => (int)$ap['service_request_id']]);
        $req = $reqLock->fetch();
        admin_assert_not_party($admin, [(int)$req['customer_id'], $req['master_id'] !== null ? (int)$req['master_id'] : null]);

        if ($decision === 'reject') {
            $rej = $pdo->prepare("UPDATE admin_dual_approvals SET status = 'REJECTED', decided_by_admin_id = :a, decided_at = NOW() WHERE id = :id");
            $rej->execute([':a' => $admin['id'], ':id' => $approvalId]);
            admin_audit($admin, $ap['action_type'] . '_REJECTED', 'ESCROW', (string)$ap['service_request_id'], null, ['approval_id' => $approvalId, 'idempotency_key' => $idem], $reason);
            $pdo->commit();
            json_response(['success' => true, 'status' => 'REJECTED']);
        }

        if ((int)$ap['pro_net_kurus'] + (int)$ap['platform_fee_kurus'] + (int)$ap['customer_refund_kurus'] !== (int)$ap['amount_kurus']) {
            throw new RuntimeException('KURUS_CONSERVATION_VIOLATION');
        }
        $target = $ap['action_type'] === 'ESCROW_RELEASE' ? 'CUSTOMER_APPROVED_RELEASED' : 'REFUNDED';
        if (!can_transition_escrow((string)$req['escrow_status'], $target)) {
            $pdo->rollBack();
            json_response(['success' => false, 'error' => 'INVALID_ESCROW_TRANSITION'], 409);
        }
        $updReq = $pdo->prepare('UPDATE service_requests SET escrow_status = :s, released_milestones = IF(:s2 = \'CUSTOMER_APPROVED_RELEASED\', 3, released_milestones) WHERE id = :id');
        $updReq->execute([':s' => $target, ':s2' => $target, ':id' => (int)$req['id']]);
        $updTx = $pdo->prepare("UPDATE escrow_transactions SET status = :ts WHERE service_request_id = :id AND status = 'HELD'");
        $updTx->execute([':ts' => $target === 'REFUNDED' ? 'REFUNDED_TO_CUSTOMER' : 'RELEASED_TO_MASTER', ':id' => (int)$req['id']]);
        $done = $pdo->prepare("UPDATE admin_dual_approvals SET status = 'EXECUTED', decided_by_admin_id = :a, decided_at = NOW() WHERE id = :id");
        $done->execute([':a' => $admin['id'], ':id' => $approvalId]);
        admin_audit($admin, $ap['action_type'] . '_EXECUTED', 'ESCROW', (string)$req['id'], ['escrow_status' => $req['escrow_status']],
            ['escrow_status' => $target, 'approval_id' => $approvalId, 'idempotency_key' => $idem], $reason);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    json_response(['success' => true, 'status' => 'EXECUTED']);
}

json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
