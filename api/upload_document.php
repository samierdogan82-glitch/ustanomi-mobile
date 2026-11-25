<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    json_response(['success' => false, 'message' => 'Yalnızca POST metodu kabul edilir.'], 405);
}

require_valid_csrf();
$user = require_authenticated_user(['CUSTOMER', 'MASTER', 'ADMIN']);

$docCategory = strtoupper(trim((string)($_POST['doc_category'] ?? 'SITE_PHOTO')));
$requestId   = filter_input(INPUT_POST, 'service_request_id', FILTER_VALIDATE_INT) ?: null;

$validCategories = ['SITE_PHOTO', 'DAMAGE_REPORT', 'MEB_MYK_CERTIFICATE'];
if (!in_array($docCategory, $validCategories, true)) {
    json_response(['success' => false, 'message' => 'Geçersiz belge kategorisi.'], 400);
}

$pdo = db();

// Anti-IDOR check if linked to a specific service_request_id
if ($requestId !== null && $requestId > 0) {
    $stmt = $pdo->prepare('SELECT id, customer_id, master_id FROM service_requests WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $requestId]);
    $req = $stmt->fetch();

    $isAuthorized = $req && (
        $user['role'] === 'ADMIN'
        || (int)$req['customer_id'] === $user['id']
        || ((int)($req['master_id'] ?? 0) === $user['id'])
    );

    if (!$isAuthorized) {
        log_security_audit('IDOR_DOCUMENT_UPLOAD_BLOCKED', 'SERVICE_REQUEST', (string)$requestId);
        json_response(['success' => false, 'message' => 'Bu iş kaydına fotoğraf veya belge yükleme yetkiniz yok.'], 403);
    }
}

if (empty($_FILES['document']) || !is_array($_FILES['document'])) {
    json_response(['success' => false, 'message' => 'Lütfen yüklenecek dosyayı seçiniz.'], 400);
}

try {
    // Allow PDF only for MEB_MYK_CERTIFICATE; site photos and damage reports strictly allow JPEG/PNG/WebP
    $allowPdf = ($docCategory === 'MEB_MYK_CERTIFICATE');
    $verified = validate_uploaded_file_magic($_FILES['document'], $allowPdf, 5_242_880);

    $uploadDir = dirname(__DIR__) . '/uploads/documents';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0750, true) && !is_dir($uploadDir)) {
        throw new RuntimeException('Yükleme dizini oluşturulamadı.');
    }

    $destPath = $uploadDir . '/' . $verified['stored_filename'];
    if (!move_uploaded_file((string)$_FILES['document']['tmp_name'], $destPath)) {
        throw new RuntimeException('Dosya güvenli depolama alanına taşınamadı.');
    }

    $ins = $pdo->prepare(
        'INSERT INTO uploaded_documents (uploader_user_id, service_request_id, doc_category, stored_filename, detected_mime, file_size_bytes, sha256_checksum, created_at)
         VALUES (:user_id, :req_id, :category, :filename, :mime, :size, :sha256, NOW())'
    );
    $ins->execute([
        ':user_id'  => $user['id'],
        ':req_id'   => $requestId,
        ':category' => $docCategory,
        ':filename' => $verified['stored_filename'],
        ':mime'     => $verified['mime'],
        ':size'     => $verified['size'],
        ':sha256'   => $verified['sha256'],
    ]);

    json_response([
        'success'         => true,
        'stored_filename' => e($verified['stored_filename']),
        'detected_mime'   => e($verified['mime']),
        'sha256_checksum' => e($verified['sha256']),
        'message'         => 'Dosya Magic-Byte ve MIME doğrulamasından geçerek güvenle kaydedildi.',
    ], 201);
} catch (Throwable $ex) {
    log_security_audit('FILE_UPLOAD_REJECTED', 'DOCUMENT', $docCategory, ['reason' => $ex->getMessage()]);
    json_response(['success' => false, 'message' => e($ex->getMessage())], 400);
}
