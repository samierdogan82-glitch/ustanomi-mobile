<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
json_response([
    'success'    => true,
    'csrf_token' => csrf_token(),
]);
