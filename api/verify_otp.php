<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    json_response(['verified' => false, 'message' => 'Yalnızca POST desteklenir.'], 405);
}

$payload      = read_json_body();
$phone        = preg_replace('/[^0-9+]/', '', (string)($payload['phone'] ?? ''));
$otp          = trim((string)($payload['otp'] ?? ''));
$serviceTitle = trim((string)($payload['serviceTitle'] ?? ''));

$pending = $_SESSION['_pending_otp'] ?? null;
if (!is_array($pending) || time() > (int)($pending['expires_at'] ?? 0)) {
    json_response([
        'leadId'   => 0,
        'verified' => false,
        'message'  => 'Doğrulama kodunun süresi doldu. Lütfen yeni kod isteyin.',
    ], 400);
}

$phoneHash = hash('sha256', $phone);
$otpHash   = hash('sha256', $otp);

if (
    !hash_equals((string)($pending['phone_hash'] ?? ''), $phoneHash)
    || !hash_equals((string)($pending['code_hash'] ?? ''), $otpHash)
) {
    log_security_audit('OTP_VERIFY_FAILED', 'LEAD_PHONE', substr($phone, -4));
    json_response([
        'leadId'   => 0,
        'verified' => false,
        'message'  => 'Girilen SMS doğrulama kodu hatalı.',
    ], 401);
}

unset($_SESSION['_pending_otp']);
$_SESSION['_otp_verified_phone'] = $phone;

$user     = require_authenticated_user(['CUSTOMER', 'ADMIN']);
$category = (string)($pending['category'] ?? 'Genel Tadilat');
$title    = $serviceTitle !== '' ? $serviceTitle : (string)($pending['service_title'] ?? 'Tadilat Talebi');

$stmt = db()->prepare(
    'INSERT INTO leads (owner_customer_id, phone, service_title, category, city, details, urgency, verified, state, created_at)
     VALUES (:owner_id, :phone, :title, :category, :city, :details, :urgency, 1, :state, NOW())'
);
$stmt->execute([
    ':owner_id' => $user['id'],
    ':phone'    => mb_substr($phone, 0, 20),
    ':title'    => mb_substr($title, 0, 180),
    ':category' => mb_substr($category, 0, 80),
    ':city'     => 'İstanbul',
    ':details'  => mb_substr($title, 0, 500),
    ':urgency'  => 'Bu Hafta İçinde',
    ':state'    => 'OPEN_FOR_OFFERS',
]);

$leadId = (int)db()->lastInsertId();
log_security_audit('OTP_VERIFIED_LEAD_CREATED', 'LEAD', (string)$leadId);

json_response([
    'leadId'   => $leadId,
    'verified' => true,
    'lead'     => [
        'id'           => $leadId,
        'phone'        => '***' . e(substr($phone, -4)),
        'serviceTitle' => e($title),
        'category'     => e($category),
        'city'         => 'İstanbul',
        'verified'     => true,
        'status'       => 'OPEN_FOR_OFFERS',
    ],
    'message'  => 'Telefon doğrulandı ve hizmet talebiniz ustalara açıldı.',
]);
