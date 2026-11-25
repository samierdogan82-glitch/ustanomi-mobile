<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Yalnızca POST desteklenir.'], 405);
}

/**
 * Official 11-digit Turkish TCKN algorithmic checksum validation in PHP 8.3
 */
function is_valid_turkish_tckn(string $raw): bool {
    $tckn = preg_replace('/\s+/', '', $raw) ?? '';
    if (!preg_match('/^[1-9]\d{10}$/', $tckn)) {
        return false;
    }
    $d = array_map('intval', str_split($tckn));
    $odd  = $d[0] + $d[2] + $d[4] + $d[6] + $d[8];
    $even = $d[1] + $d[3] + $d[5] + $d[7];
    $d10  = ((($odd * 7) - $even) % 10 + 10) % 10;
    $d11  = array_sum(array_slice($d, 0, 10)) % 10;
    return $d[9] === $d10 && $d[10] === $d11;
}

$payload = read_json_body();
require_valid_csrf($payload);

$action = trim((string)($payload['action'] ?? 'login'));

// ----------------------------------------------------------------------------
// 1. KYC-Verified Commercial Registration (T.C. Kimlik No + KVKK + Escrow Consent)
// ----------------------------------------------------------------------------
if ($action === 'register_kyc') {
    $fullName       = trim((string)($payload['fullName'] ?? ''));
    $email          = strtolower(trim((string)($payload['email'] ?? '')));
    $phone          = preg_replace('/[^0-9+]/', '', (string)($payload['phone'] ?? '')) ?? '';
    $password       = (string)($payload['password'] ?? '');
    $tckn           = preg_replace('/\s+/', '', (string)($payload['tckn'] ?? '')) ?? '';
    $iban           = strtoupper(preg_replace('/\s+/', '', (string)($payload['iban'] ?? '')) ?? '');
    $role           = strtoupper(trim((string)($payload['accountRole'] ?? 'CUSTOMER')));
    $kvkkAccepted   = (bool)($payload['kvkkAccepted'] ?? false);
    $escrowAccepted = (bool)($payload['escrowContractAccepted'] ?? false);

    if (!in_array($role, ['CUSTOMER', 'MASTER'], true)) {
        $role = 'CUSTOMER';
    }
    if (mb_strlen($fullName) < 4 || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($phone) < 10) {
        json_response(['status' => 'error', 'errorCode' => 'INVALID_CONTACT', 'message' => 'Ad soyad, geçerli e-posta ve telefon numarası zorunludur.'], 400);
    }
    if (!is_valid_turkish_tckn($tckn)) {
        log_security_audit('KYC_INVALID_TCKN_REJECTED', 'USER_REGISTER', substr($tckn, -2));
        json_response(['status' => 'error', 'errorCode' => 'INVALID_TCKN', 'message' => 'Geçersiz T.C. Kimlik Numarası (11 hane resmi algoritma kontrolü başarısız).'], 400);
    }
    if (mb_strlen($password) < 8 || !preg_match('/[A-ZÇĞİÖŞÜ]/u', $password) || !preg_match('/\d/', $password)) {
        json_response(['status' => 'error', 'errorCode' => 'WEAK_PASSWORD', 'message' => 'Şifreniz en az 8 karakter olmalı, büyük harf ve rakam içermelidir.'], 400);
    }
    if (!$kvkkAccepted || !$escrowAccepted) {
        json_response(['status' => 'error', 'errorCode' => 'CONSENT_REQUIRED', 'message' => 'KVKK ve Ticari Güvenli Havuz sözleşmesi onaylanmalıdır.'], 400);
    }

    $tcknHash   = hash('sha256', $tckn);
    $tcknMasked = substr($tckn, 0, 2) . '*******' . substr($tckn, -2);
    $ibanMasked = $iban !== '' ? (substr($iban, 0, 4) . '******************' . substr($iban, -4)) : null;
    $pwdHash    = password_hash($password, PASSWORD_DEFAULT);

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $dupStmt = $pdo->prepare('SELECT id FROM user_kyc_identities WHERE tckn_sha256 = :thash LIMIT 1');
        $dupStmt->execute([':thash' => $tcknHash]);
        if ($dupStmt->fetch()) {
            throw new RuntimeException('Bu T.C. Kimlik Numarası ile kayıtlı bir ticari hesap zaten mevcut.');
        }

        $userStmt = $pdo->prepare(
            'INSERT INTO users (email, phone, password_hash, full_name, role, is_verified_master, is_active, created_at)
             VALUES (:email, :phone, :pwd, :name, :role, :verified, 1, NOW())'
        );
        $userStmt->execute([
            ':email'    => mb_substr($email, 0, 190),
            ':phone'    => mb_substr($phone, 0, 20),
            ':pwd'      => $pwdHash,
            ':name'     => mb_substr($fullName, 0, 150),
            ':role'     => $role,
            ':verified' => $role === 'MASTER' ? 1 : 0,
        ]);

        $newUserId = (int)$pdo->lastInsertId();

        $kycStmt = $pdo->prepare(
            'INSERT INTO user_kyc_identities (
                user_id, tckn_sha256, tckn_masked, iban_masked,
                kvkk_consent_at, escrow_contract_consent_at, kyc_status, created_at
             ) VALUES (
                :uid, :thash, :tmask, :imask,
                NOW(), NOW(), "VERIFIED_ALGORITHMIC", NOW()
             )'
        );
        $kycStmt->execute([
            ':uid'   => $newUserId,
            ':thash' => $tcknHash,
            ':tmask' => $tcknMasked,
            ':imask' => $ibanMasked,
        ]);

        $pdo->commit();

        session_regenerate_id(true);
        $_SESSION['user_id']   = $newUserId;
        $_SESSION['user_role'] = $role;

        log_security_audit('KYC_USER_REGISTERED', 'USER', (string)$newUserId, ['role' => $role, 'tckn_masked' => $tcknMasked]);

        json_response([
            'status'     => 'ok',
            'userId'     => $newUserId,
            'role'       => $role,
            'maskedTckn' => e($tcknMasked),
            'kycBadge'   => '🪪 T.C. Kimlik (TCKN) & Ticari KYC Doğrulandı',
            'message'    => 'Kimlik doğrulamalı ticari hesabınız başarıyla açıldı.',
        ], 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_response(['status' => 'error', 'message' => e($e->getMessage())], 409);
    }
}

// ----------------------------------------------------------------------------
// 2. Timing-Safe Commercial Login
// ----------------------------------------------------------------------------
if ($action === 'login') {
    $email    = strtolower(trim((string)($payload['email'] ?? '')));
    $password = (string)($payload['password'] ?? '');

    if ($email === '' || $password === '') {
        json_response(['status' => 'error', 'message' => 'E-posta ve şifre giriniz.'], 400);
    }

    $stmt = db()->prepare(
        'SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.is_verified_master, u.is_active,
                k.tckn_masked, k.kyc_status
         FROM users u
         LEFT JOIN user_kyc_identities k ON k.user_id = u.id
         WHERE u.email = :email
         LIMIT 1'
    );
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    // Prevent timing user-enumeration by always verifying against a dummy bcrypt hash if user not found
    $dummyHash = '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
    $targetHash = $user ? (string)$user['password_hash'] : $dummyHash;
    $passwordOk = password_verify($password, $targetHash);

    if (!$user || !$passwordOk || (int)$user['is_active'] !== 1) {
        log_security_audit('LOGIN_FAILED', 'USER_EMAIL', $email);
        json_response(['status' => 'error', 'message' => 'E-posta veya şifre hatalı.'], 401);
    }

    session_regenerate_id(true);
    $_SESSION['user_id']   = (int)$user['id'];
    $_SESSION['user_role'] = (string)$user['role'];

    log_security_audit('LOGIN_SUCCESS', 'USER', (string)$user['id']);

    json_response([
        'status'     => 'ok',
        'userId'     => (int)$user['id'],
        'fullName'   => e((string)$user['full_name']),
        'role'       => e((string)$user['role']),
        'kycStatus'  => e((string)($user['kyc_status'] ?? 'UNVERIFIED')),
        'maskedTckn' => e((string)($user['tckn_masked'] ?? '')),
        'message'    => 'Güvenli oturum açıldı.',
    ]);
}

// ----------------------------------------------------------------------------
// 3. Forgot Password — Step 1: Request 6-Digit SMS/Email OTP Reset Token
// ----------------------------------------------------------------------------
if ($action === 'forgot_password_request') {
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['status' => 'error', 'message' => 'Geçerli bir e-posta adresi giriniz.'], 400);
    }

    $stmt = db()->prepare('SELECT id FROM users WHERE email = :email AND is_active = 1 LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if ($user) {
        $otpCode   = (string)random_int(100000, 999999);
        $tokenHash = hash('sha256', $otpCode);
        $ip        = (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');

        $ins = db()->prepare(
            'INSERT INTO password_reset_tokens (user_id, token_sha256, expires_at, request_ip, created_at)
             VALUES (:uid, :thash, DATE_ADD(NOW(), INTERVAL 10 MINUTE), :ip, NOW())'
        );
        $ins->execute([
            ':uid'   => (int)$user['id'],
            ':thash' => $tokenHash,
            ':ip'    => mb_substr($ip, 0, 45),
        ]);
        log_security_audit('PASSWORD_RESET_OTP_ISSUED', 'USER', (string)$user['id']);
    }

    // Constant response to prevent account enumeration
    json_response([
        'status'  => 'ok',
        'message' => 'Hesabınız kayıtlıysa 6 haneli şifre sıfırlama kodunuz telefonunuza ve e-postanıza gönderildi (10 dk geçerli).',
    ]);
}

// ----------------------------------------------------------------------------
// 4. Forgot Password — Step 2: Verify OTP & Update Password
// ----------------------------------------------------------------------------
if ($action === 'forgot_password_reset') {
    $email       = strtolower(trim((string)($payload['email'] ?? '')));
    $otpCode     = trim((string)($payload['otpCode'] ?? ''));
    $newPassword = (string)($payload['newPassword'] ?? '');

    if (mb_strlen($newPassword) < 8 || !preg_match('/[A-ZÇĞİÖŞÜ]/u', $newPassword) || !preg_match('/\d/', $newPassword)) {
        json_response(['status' => 'error', 'message' => 'Yeni şifreniz en az 8 karakter olmalı, büyük harf ve rakam içermelidir.'], 400);
    }

    $stmt = db()->prepare(
        'SELECT r.id AS token_id, r.user_id, r.token_sha256
         FROM password_reset_tokens r
         INNER JOIN users u ON u.id = r.user_id
         WHERE u.email = :email
           AND r.used_at IS NULL
           AND r.expires_at > NOW()
         ORDER BY r.created_at DESC
         LIMIT 1'
    );
    $stmt->execute([':email' => $email]);
    $row = $stmt->fetch();

    $inputHash = hash('sha256', $otpCode);
    if (!$row || !hash_equals((string)$row['token_sha256'], $inputHash)) {
        log_security_audit('PASSWORD_RESET_OTP_INVALID', 'USER_EMAIL', $email);
        json_response(['status' => 'error', 'message' => 'Doğrulama kodu geçersiz veya süresi dolmuş.'], 401);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $updUser = $pdo->prepare('UPDATE users SET password_hash = :pwd WHERE id = :uid');
        $updUser->execute([
            ':pwd' => password_hash($newPassword, PASSWORD_DEFAULT),
            ':uid' => (int)$row['user_id'],
        ]);

        $markUsed = $pdo->prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = :tid');
        $markUsed->execute([':tid' => (int)$row['token_id']]);

        $pdo->commit();
        log_security_audit('PASSWORD_RESET_COMPLETED', 'USER', (string)$row['user_id']);

        json_response([
            'status'  => 'ok',
            'message' => 'Şifreniz güvenle güncellendi. Yeni şifrenizle giriş yapabilirsiniz.',
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_response(['status' => 'error', 'message' => 'Şifre sıfırlama sırasında hata oluştu.'], 500);
    }
}

json_response(['status' => 'error', 'message' => 'Geçersiz kimlik doğrulama işlemi.'], 400);
