<?php
declare(strict_types=1);
/**
 * Hardened PHP 8.3 Security Bootstrap (PDO Prepared Statements, CSRF, Magic-Byte/MIME Upload, Escrow & HMAC)
 * Project: ustanomi.com & com.ustanomi.app
 * License: MIT
 */

ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.use_strict_mode', '1');
ini_set('session.cookie_samesite', 'Strict');

function init_secure_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ((int)($_SERVER['SERVER_PORT'] ?? 80) === 443);

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();

    if (empty($_SESSION['_session_initialized_at'])) {
        session_regenerate_id(true);
        $_SESSION['_session_initialized_at'] = time();
    }
}

/** Singleton PDO Connection with ATTR_EMULATE_PREPARES => false */
function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $port = getenv('DB_PORT') ?: '3306';
    $name = getenv('DB_NAME') ?: 'ustanomi_db';
    $user = getenv('DB_USER') ?: 'ustanomi_app';
    $pass = getenv('DB_PASS') ?: '';

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

/** HTML XSS Output Escaper */
function e(string|int|float|null $value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Generate & Verify CSRF Token */
function csrf_token(): string {
    init_secure_session();
    if (empty($_SESSION['_csrf']) || !is_string($_SESSION['_csrf'])) {
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['_csrf'];
}

function csrf_field(): string {
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function verify_csrf(?string $token): bool {
    init_secure_session();
    return is_string($token)
        && $token !== ''
        && !empty($_SESSION['_csrf'])
        && hash_equals((string)$_SESSION['_csrf'], $token);
}

function require_valid_csrf(?array $jsonPayload = null): void {
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        return;
    }
    $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
    $postToken   = $_POST['_csrf'] ?? ($jsonPayload['_csrf'] ?? null);
    $candidate   = is_string($headerToken) && $headerToken !== '' ? $headerToken : (is_string($postToken) ? $postToken : null);

    if (!verify_csrf($candidate)) {
        json_response([
            'success' => false,
            'error'   => 'CSRF_VALIDATION_FAILED',
            'message' => 'Güvenlik doğrulaması (CSRF Token) başarısız. Lütfen sayfayı yenileyin.',
        ], 403);
    }
}

function read_json_body(int $maxBytes = 65536): array {
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || $raw === '') {
        return [];
    }
    if (strlen($raw) > $maxBytes) {
        json_response(['success' => false, 'error' => 'PAYLOAD_TOO_LARGE', 'message' => 'İstek boyutu sınırı aşıldı.'], 413);
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function json_response(array $payload, int $statusCode = 200): never {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Require Authenticated Session User & Role Check via PDO Prepared Statement
 * @param list<string> $allowedRoles e.g. ['CUSTOMER', 'MASTER', 'ADMIN']
 * @return array{id: int, email: string, full_name: string, role: string, is_verified_master: int}
 */
function require_authenticated_user(array $allowedRoles = ['CUSTOMER', 'MASTER', 'ADMIN']): array {
    init_secure_session();
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;

    if ($userId <= 0) {
        json_response([
            'success' => false,
            'error'   => 'UNAUTHORIZED',
            'message' => 'Bu işlem için oturum açmanız gerekiyor.',
        ], 401);
    }

    $stmt = db()->prepare(
        'SELECT id, email, full_name, role, is_verified_master, is_active
         FROM users
         WHERE id = :id AND is_active = 1
         LIMIT 1'
    );
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();

    if (!$user) {
        session_unset();
        json_response([
            'success' => false,
            'error'   => 'ACCOUNT_INACTIVE',
            'message' => 'Hesabınız bulunamadı veya pasif durumda.',
        ], 401);
    }

    $role = (string)$user['role'];
    if (!in_array($role, $allowedRoles, true)) {
        log_security_audit('RBAC_DENIED', 'ENDPOINT', (string)($_SERVER['REQUEST_URI'] ?? ''), [
            'required_roles' => $allowedRoles,
            'actual_role'    => $role,
        ]);
        json_response([
            'success' => false,
            'error'   => 'FORBIDDEN_ROLE',
            'message' => 'Bu işlem için rol yetkiniz bulunmuyor.',
        ], 403);
    }

    return [
        'id'                 => (int)$user['id'],
        'email'              => (string)$user['email'],
        'full_name'          => (string)$user['full_name'],
        'role'               => $role,
        'is_verified_master' => (int)$user['is_verified_master'],
    ];
}

/**
 * Dual Magic-Byte (Hex Signature) + Finfo MIME File Upload Validator
 * Supports:
 *  - Site / Damage Photos: image/jpeg (FF D8 FF), image/png (89 50 4E 47 0D 0A 1A 0A), image/webp (RIFF....WEBP)
 *  - Master MEB/MYK Certificates: above images + application/pdf (%PDF-)
 * @return array{stored_filename: string, mime: string, size: int, sha256: string}
 */
function validate_uploaded_file_magic(array $file, bool $allowPdf = false, int $maxBytes = 5_242_880): array {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Dosya yükleme sırasında hata oluştu.');
    }
    $tmpName = (string)($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        throw new RuntimeException('Geçersiz dosya yükleme kaynağı.');
    }
    $size = (int)($file['size'] ?? 0);
    if ($size <= 0 || $size > $maxBytes) {
        throw new RuntimeException('Dosya boyutu izin verilen sınırı (5 MB) aşıyor.');
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = (string)$finfo->file($tmpName);

    $allowedMimes = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];
    if ($allowPdf) {
        $allowedMimes['application/pdf'] = 'pdf';
    }

    if (!isset($allowedMimes[$mime])) {
        throw new RuntimeException('İzin verilmeyen dosya MIME tipi: ' . e($mime));
    }

    // Read first 12 bytes to verify raw Magic-Byte signature (prevents MIME spoofing / polyglots)
    $fh = fopen($tmpName, 'rb');
    if ($fh === false) {
        throw new RuntimeException('Yüklenen dosya başlığı okunamadı.');
    }
    $headerBytes = (string)fread($fh, 12);
    fclose($fh);

    $magicValid = match ($mime) {
        'image/jpeg'      => str_starts_with($headerBytes, "\xFF\xD8\xFF"),
        'image/png'       => str_starts_with($headerBytes, "\x89PNG\r\n\x1A\n"),
        'image/webp'      => str_starts_with($headerBytes, "RIFF") && substr($headerBytes, 8, 4) === "WEBP",
        'application/pdf' => str_starts_with($headerBytes, "%PDF-"),
        default           => false,
    };

    if (!$magicValid) {
        throw new RuntimeException('Dosya Magic-Byte (ikili imza) doğrulamasından geçemedi.');
    }

    if (str_starts_with($mime, 'image/')) {
        $dims = @getimagesize($tmpName);
        if ($dims === false || ($dims[0] ?? 0) < 10 || ($dims[1] ?? 0) < 10) {
            throw new RuntimeException('Geçersiz veya bozuk görsel boyutları.');
        }
    }

    $sha256         = hash_file('sha256', $tmpName) ?: '';
    $storedFilename = bin2hex(random_bytes(16)) . '.' . $allowedMimes[$mime];

    return [
        'stored_filename' => $storedFilename,
        'mime'            => $mime,
        'size'            => $size,
        'sha256'          => $sha256,
    ];
}

/** Ustanomi "Güvenli Havuz" (Escrow) State Machine Guard */
function can_transition_escrow(string $from, string $to): bool {
    $allowed = [
        'PENDING_PAYMENT'            => ['FUNDS_HELD_IN_POOL'],
        'FUNDS_HELD_IN_POOL'         => ['WORK_IN_PROGRESS', 'REFUNDED'],
        'WORK_IN_PROGRESS'           => ['CUSTOMER_APPROVED_RELEASED', 'DISPUTED'],
        'DISPUTED'                   => ['CUSTOMER_APPROVED_RELEASED', 'REFUNDED'],
        'CUSTOMER_APPROVED_RELEASED' => [],
        'REFUNDED'                   => [],
    ];
    return in_array($to, $allowed[$from] ?? [], true);
}

/** Constant-time HMAC-SHA256 signature verification for PayTR / iyzico Webhooks */
function verify_webhook_hmac(string $payload, string $secretKey, string $receivedBase64Signature): bool {
    if ($secretKey === '' || $receivedBase64Signature === '') {
        return false;
    }
    $expected = base64_encode(hash_hmac('sha256', $payload, $secretKey, true));
    return hash_equals($expected, $receivedBase64Signature);
}

/** Record security audit logs using PDO Prepared Statements */
function log_security_audit(string $action, string $targetType, ?string $targetId = null, array $meta = []): void {
    try {
        init_secure_session();
        $actorId   = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
        $actorRole = isset($_SESSION['user_role']) ? (string)$_SESSION['user_role'] : 'ANONYMOUS';
        $ip        = substr((string)($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'), 0, 45);

        $stmt = db()->prepare(
            'INSERT INTO security_audit_logs (actor_user_id, actor_role, action, target_type, target_id, ip_address, metadata_json, created_at)
             VALUES (:actor_id, :actor_role, :action, :target_type, :target_id, :ip, :meta, NOW())'
        );
        $stmt->execute([
            ':actor_id'    => $actorId,
            ':actor_role'  => $actorRole,
            ':action'      => $action,
            ':target_type' => $targetType,
            ':target_id'   => $targetId,
            ':ip'          => $ip,
            ':meta'        => !empty($meta) ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null,
        ]);
    } catch (Throwable) {
        // Fail silently without exposing internal DB state
    }
}

/** Quantum Ledger v15.0: Zero-Float-Bug Integer Kuruş & KDV (%0, %1, %10, %20) Arithmetic */
function calc_turkish_vat_kurus(int $netKurus, int $vatRatePct = 20, int $discountBps = 0): array {
    if ($netKurus < 0) throw new InvalidArgumentException('FINANCE_INVALID_INTEGER_KURUS');
    if (!in_array($vatRatePct, [0, 1, 10, 20], true)) throw new InvalidArgumentException('FINANCE_UNSUPPORTED_VAT_RATE');
    if ($discountBps < 0 || $discountBps > 10000) throw new InvalidArgumentException('FINANCE_INVALID_DISCOUNT_BPS');
    $discountKurus      = (int)round(($netKurus * $discountBps) / 10000);
    $discountedNetKurus = max(0, $netKurus - $discountKurus);
    $vatKurus           = (int)round(($discountedNetKurus * $vatRatePct) / 100);
    $grossKurus         = $discountedNetKurus + $vatKurus;
    return [
        'net_kurus'            => $netKurus,
        'discount_kurus'       => $discountKurus,
        'discounted_net_kurus' => $discountedNetKurus,
        'vat_rate_pct'         => $vatRatePct,
        'vat_kurus'            => $vatKurus,
        'gross_kurus'          => $grossKurus,
        'formatted_tl'         => number_format($grossKurus / 100, 2, ',', '.') . ' ₺',
    ];
}

/** Quantum Ledger v15.0: Official 11-Digit Turkish National ID (TCKN) Checksum Validator */
function validate_tckn_checksum(string $tckn): bool {
    $raw = trim($tckn);
    if (!preg_match('/^[1-9][0-9]{10}$/', $raw)) return false;
    $d = array_map('intval', str_split($raw));
    $d10 = (((($d[0] + $d[2] + $d[4] + $d[6] + $d[8]) * 7) - ($d[1] + $d[3] + $d[5] + $d[7])) % 10 + 10) % 10;
    return $d[9] === $d10 && $d[10] === (array_sum(array_slice($d, 0, 10)) % 10);
}

