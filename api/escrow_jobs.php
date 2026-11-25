<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    $user = require_authenticated_user(['CUSTOMER', 'MASTER', 'ADMIN']);

    if ($user['role'] === 'ADMIN') {
        $stmt = db()->prepare(
            'SELECT r.id, r.request_code, r.customer_id, r.master_id, r.category, r.city, r.district,
                    r.title, r.description, r.agreed_amount_cents, r.escrow_status, r.created_at
             FROM service_requests r
             ORDER BY r.created_at DESC
             LIMIT 100'
        );
        $stmt->execute();
    } elseif ($user['role'] === 'MASTER') {
        $stmt = db()->prepare(
            'SELECT r.id, r.request_code, r.customer_id, r.master_id, r.category, r.city, r.district,
                    r.title, r.description, r.agreed_amount_cents, r.escrow_status, r.created_at
             FROM service_requests r
             WHERE r.master_id = :master_id
             ORDER BY r.created_at DESC
             LIMIT 100'
        );
        $stmt->execute([':master_id' => $user['id']]);
    } else {
        $stmt = db()->prepare(
            'SELECT r.id, r.request_code, r.customer_id, r.master_id, r.category, r.city, r.district,
                    r.title, r.description, r.agreed_amount_cents, r.escrow_status, r.created_at
             FROM service_requests r
             WHERE r.customer_id = :customer_id
             ORDER BY r.created_at DESC
             LIMIT 100'
        );
        $stmt->execute([':customer_id' => $user['id']]);
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = [
            'id'                  => (int)$row['id'],
            'request_code'        => e((string)$row['request_code']),
            'customer_id'         => (int)$row['customer_id'],
            'master_id'           => $row['master_id'] !== null ? (int)$row['master_id'] : null,
            'category'            => e((string)$row['category']),
            'city'                => e((string)$row['city']),
            'district'            => e((string)$row['district']),
            'title'               => e((string)$row['title']),
            'description'         => e((string)$row['description']),
            'agreed_amount_cents' => (int)$row['agreed_amount_cents'],
            'escrow_status'       => e((string)$row['escrow_status']),
            'created_at'          => e((string)$row['created_at']),
        ];
    }

    json_response(['success' => true, 'requests' => $items]);
}

if ($method !== 'POST') {
    json_response(['success' => false, 'message' => 'Desteklenmeyen HTTP metodu.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);

$action = trim((string)($payload['action'] ?? 'create_request'));

if ($action === 'create_request') {
    $user        = require_authenticated_user(['CUSTOMER', 'ADMIN']);
    $category    = trim((string)($payload['category'] ?? 'Tesisat & Tadilat'));
    $city        = trim((string)($payload['city'] ?? 'İstanbul'));
    $district    = trim((string)($payload['district'] ?? 'Kadıköy'));
    $title       = trim((string)($payload['title'] ?? ''));
    $description = trim((string)($payload['description'] ?? ''));
    $amountCents = max(0, (int)($payload['agreed_amount_cents'] ?? 0));

    if (mb_strlen($title) < 4 || mb_strlen($description) < 10) {
        json_response(['success' => false, 'message' => 'Lütfen iş başlığını ve detaylı açıklamayı giriniz.'], 400);
    }

    $requestCode = 'UST-' . date('Y') . '-' . random_int(100000, 999999);
    $stmt = db()->prepare(
        'INSERT INTO service_requests (request_code, customer_id, category, city, district, title, description, agreed_amount_cents, escrow_status, created_at)
         VALUES (:request_code, :customer_id, :category, :city, :district, :title, :description, :amount, :status, NOW())'
    );
    $stmt->execute([
        ':request_code' => $requestCode,
        ':customer_id'  => $user['id'],
        ':category'     => mb_substr($category, 0, 80),
        ':city'         => mb_substr($city, 0, 80),
        ':district'     => mb_substr($district, 0, 80),
        ':title'        => mb_substr($title, 0, 180),
        ':description'  => mb_substr($description, 0, 2500),
        ':amount'       => $amountCents,
        ':status'       => 'PENDING_PAYMENT',
    ]);

    $newId = (int)db()->lastInsertId();
    log_security_audit('SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST', (string)$newId, ['request_code' => $requestCode]);

    json_response([
        'success'      => true,
        'id'           => $newId,
        'request_code' => e($requestCode),
    ], 201);
}

if ($action === 'transition_escrow') {
    $user      = require_authenticated_user(['CUSTOMER', 'MASTER', 'ADMIN']);
    $requestId = (int)($payload['request_id'] ?? 0);
    $nextState = trim((string)($payload['next_status'] ?? ''));

    if ($requestId <= 0 || $nextState === '') {
        json_response(['success' => false, 'message' => 'Geçersiz iş kimliği veya hedef durum.'], 400);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare(
            'SELECT id, customer_id, master_id, escrow_status
             FROM service_requests
             WHERE id = :id
             LIMIT 1
             FOR UPDATE'
        );
        $stmt->execute([':id' => $requestId]);
        $req = $stmt->fetch();

        if (!$req) {
            throw new RuntimeException('İş kaydı bulunamadı.');
        }

        $currentStatus = (string)$req['escrow_status'];
        if (!can_transition_escrow($currentStatus, $nextState)) {
            throw new RuntimeException('Geçersiz Güvenli Havuz durum geçişi.');
        }

        // Anti-IDOR & RBAC Ownership checks per transition
        if ($nextState === 'WORK_IN_PROGRESS') {
            $isOwnerMaster = $user['role'] === 'MASTER' && (int)($req['master_id'] ?? 0) === $user['id'];
            if (!$isOwnerMaster && $user['role'] !== 'ADMIN') {
                log_security_audit('IDOR_ESCROW_TRANSITION_BLOCKED', 'SERVICE_REQUEST', (string)$requestId, ['attempted_state' => $nextState]);
                throw new RuntimeException('Yalnızca işe atanmış doğrulanmış usta işi başlatabilir.');
            }
        }

        if (in_array($nextState, ['CUSTOMER_APPROVED_RELEASED', 'DISPUTED'], true)) {
            $isOwnerCustomer = $user['role'] === 'CUSTOMER' && (int)$req['customer_id'] === $user['id'];
            if (!$isOwnerCustomer && $user['role'] !== 'ADMIN') {
                log_security_audit('IDOR_ESCROW_RELEASE_BLOCKED', 'SERVICE_REQUEST', (string)$requestId, ['attempted_state' => $nextState]);
                throw new RuntimeException('Güvenli Havuz ödemesini yalnızca iş sahibi müşteri onaylayabilir.');
            }
        }

        $upd = $pdo->prepare(
            'UPDATE service_requests SET escrow_status = :next_status, updated_at = NOW() WHERE id = :id'
        );
        $upd->execute([':next_status' => $nextState, ':id' => $requestId]);

        $pdo->commit();
        log_security_audit('ESCROW_STATE_CHANGED', 'SERVICE_REQUEST', (string)$requestId, [
            'from' => $currentStatus,
            'to'   => $nextState,
        ]);

        json_response([
            'success'       => true,
            'request_id'    => $requestId,
            'escrow_status' => e($nextState),
        ]);
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_response(['success' => false, 'message' => e($ex->getMessage())], 403);
    }
}

json_response(['success' => false, 'message' => 'Bilinmeyen işlem komutu.'], 400);
