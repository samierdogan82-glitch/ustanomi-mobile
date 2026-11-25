<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Yalnızca POST desteklenir.'], 405);
}

$payload      = read_json_body();
$phone        = preg_replace('/[^0-9+]/', '', (string)($payload['phone'] ?? ''));
$serviceTitle = trim((string)($payload['serviceTitle'] ?? ''));
$category     = trim((string)($payload['category'] ?? 'Genel Tadilat'));

if (mb_strlen($phone) < 10 || mb_strlen($serviceTitle) < 3) {
    json_response([
        'status'  => 'error',
        'message' => 'Geçerli bir telefon numarası (+90 5XX...) ve iş başlığı giriniz.',
    ], 400);
}

$otpCode = (string)random_int(100000, 999999);
$_SESSION['_pending_otp'] = [
    'phone_hash'    => hash('sha256', $phone),
    'code_hash'     => hash('sha256', $otpCode),
    'service_title' => mb_substr($serviceTitle, 0, 180),
    'category'      => mb_substr($category, 0, 80),
    'expires_at'    => time() + 300,
];

log_security_audit('OTP_DISPATCHED', 'LEAD_PHONE', substr($phone, -4), ['category' => e($category)]);

json_response([
    'status'  => 'ok',
    'message' => '6 haneli SMS doğrulama kodu telefonunuza gönderildi.',
]);
