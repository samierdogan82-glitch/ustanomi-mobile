<?php
declare(strict_types=1);
/**
 * One-time bootstrap for the first SUPER_ADMIN. CLI only.
 *
 *   ADMIN_TOTP_KEY=... DB_HOST=... php scripts/create-super-admin.php owner@example.com "Ad Soyad"
 *
 * Prints a generated password and the otpauth:// URI once. Refuses to run if any SUPER_ADMIN exists.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../includes/admin-security.php';

[$_, $email, $name] = $argv + [null, '', ''];
$email = mb_strtolower(trim((string)$email));
$name = trim((string)$name);
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($name) < 3) {
    fwrite(STDERR, "Kullanım: php scripts/create-super-admin.php <email> \"<Ad Soyad>\"\n");
    exit(1);
}

$pdo = db();
$exists = $pdo->prepare("SELECT COUNT(*) FROM admin_users WHERE role = 'SUPER_ADMIN'");
$exists->execute();
if ((int)$exists->fetchColumn() > 0) {
    fwrite(STDERR, "Zaten bir SUPER_ADMIN var. Yeni yöneticileri panelden oluşturun.\n");
    exit(1);
}

$password = rtrim(strtr(base64_encode(random_bytes(18)), '+/', 'Aa'), '=') . '9x';
$rawSecret = random_bytes(20);
$stmt = $pdo->prepare(
    "INSERT INTO admin_users (email, password_hash, full_name, role, totp_secret_enc, totp_enabled)
     VALUES (:e, :h, :n, 'SUPER_ADMIN', :t, 1)"
);
$stmt->execute([
    ':e' => $email,
    ':h' => password_hash($password, PASSWORD_DEFAULT),
    ':n' => $name,
    ':t' => admin_encrypt_totp_secret($rawSecret),
]);
$id = (int)$pdo->lastInsertId();
admin_audit(['id' => $id, 'role' => 'SUPER_ADMIN'], 'SUPER_ADMIN_BOOTSTRAPPED', 'ADMIN', (string)$id, null, ['email' => $email], 'CLI bootstrap');

$secret = admin_base32_encode($rawSecret);
fwrite(STDOUT, "SUPER_ADMIN oluşturuldu (id=$id)\n");
fwrite(STDOUT, "Geçici şifre: $password\n");
fwrite(STDOUT, 'TOTP URI: otpauth://totp/Ustanomi%20Admin:' . rawurlencode($email) . "?secret=$secret&issuer=Ustanomi&digits=6&period=30\n");
fwrite(STDOUT, "Bu bilgiler bir daha gösterilmez. Authenticator uygulamasına ekleyip bu çıktıyı silin.\n");
