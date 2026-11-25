<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$user   = require_authenticated_user(['CUSTOMER', 'MASTER', 'ADMIN']);

if ($method === 'GET') {
    $threadCode = trim((string)($_GET['threadCode'] ?? ''));
    if ($threadCode === '') {
        json_response(['status' => 'error', 'message' => 'Geçerli bir sohbet kodu (threadCode) gerekli.'], 400);
    }

    // Anti-IDOR: User must be sender or recipient in the DM thread
    $stmt = db()->prepare(
        'SELECT id, thread_code, sender_user_id, recipient_user_id, message_type,
                message_body, proforma_total_kurus, pro_net_share_kurus, is_escrow_locked, created_at
         FROM dm_messages
         WHERE thread_code = :tcode
           AND (sender_user_id = :uid OR recipient_user_id = :uid2)
         ORDER BY created_at ASC
         LIMIT 100'
    );
    $stmt->execute([
        ':tcode' => $threadCode,
        ':uid'   => $user['id'],
        ':uid2'  => $user['id'],
    ]);

    $messages = [];
    foreach ($stmt->fetchAll() as $row) {
        $messages[] = [
            'id'              => (int)$row['id'],
            'threadCode'      => e((string)$row['thread_code']),
            'senderUserId'    => (int)$row['sender_user_id'],
            'recipientUserId' => (int)$row['recipient_user_id'],
            'messageType'     => e((string)$row['message_type']),
            'messageBody'     => e((string)$row['message_body']),
            'proformaTotalTl' => round(((int)$row['proforma_total_kurus']) / 100, 2),
            'proNetShareTl'   => round(((int)$row['pro_net_share_kurus']) / 100, 2),
            'isEscrowLocked'  => (int)$row['is_escrow_locked'] === 1,
            'createdAt'       => e((string)$row['created_at']),
        ];
    }

    json_response(['status' => 'ok', 'messages' => $messages]);
}

if ($method !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Desteklenmeyen HTTP metodu.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);

$recipientId    = (int)($payload['recipientUserId'] ?? 0);
$messageType    = strtoupper(trim((string)($payload['messageType'] ?? 'TEXT')));
$rawBody        = trim((string)($payload['messageBody'] ?? ''));
$totalTl        = max(0.0, (float)($payload['proformaTotalTl'] ?? 0));
$isEscrowLocked = (bool)($payload['isEscrowLocked'] ?? false);

if ($recipientId <= 0 || $rawBody === '') {
    json_response(['status' => 'error', 'message' => 'Alıcı ve mesaj içeriği zorunludur.'], 400);
}
if (!in_array($messageType, ['TEXT', 'PROFORMA_ESCROW_CARD', 'LOCATION_PIN'], true)) {
    $messageType = 'TEXT';
}

// Anti-Leak Guard: mask phone numbers and IBANs if escrow is not locked yet
$safeBody = $rawBody;
if (!$isEscrowLocked) {
    $safeBody = preg_replace('/\bTR\d{2}\s?(\d{4}\s?){5}\d{2}\b/i', 'TR**[HAVUZ-ONAYINDA-AÇILIR]**', $safeBody) ?? $safeBody;
    $safeBody = preg_replace('/\b(?:\+?90|0)?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/', '+905**[HAVUZ-ONAYINDA-AÇILIR]**', $safeBody) ?? $safeBody;
}

$minId      = min((int)$user['id'], $recipientId);
$maxId      = max((int)$user['id'], $recipientId);
$threadCode = 'DM-' . $minId . '-' . $maxId;

$totalKurus = (int)round($totalTl * 100);
$feeKurus   = (int)round(($totalKurus * 1200) / 10000);
$netKurus   = $totalKurus - $feeKurus;

$stmt = db()->prepare(
    'INSERT INTO dm_messages (
        thread_code, sender_user_id, recipient_user_id, message_type,
        message_body, proforma_total_kurus, pro_net_share_kurus, is_escrow_locked, created_at
     ) VALUES (
        :tcode, :sid, :rid, :mtype,
        :body, :total, :net, :locked, NOW()
     )'
);
$stmt->execute([
    ':tcode'  => $threadCode,
    ':sid'    => $user['id'],
    ':rid'    => $recipientId,
    ':mtype'  => $messageType,
    ':body'   => mb_substr($safeBody, 0, 2000),
    ':total'  => $totalKurus,
    ':net'    => $netKurus,
    ':locked' => $isEscrowLocked ? 1 : 0,
]);

$msgId = (int)db()->lastInsertId();
log_security_audit('DM_MESSAGE_SENT', 'DM_THREAD', $threadCode, ['type' => $messageType]);

json_response([
    'status'          => 'ok',
    'messageId'       => $msgId,
    'threadCode'      => $threadCode,
    'sanitizedBody'   => e($safeBody),
    'proformaTotalTl' => round($totalKurus / 100, 2),
    'proNetShareTl'   => round($netKurus / 100, 2),
], 201);
