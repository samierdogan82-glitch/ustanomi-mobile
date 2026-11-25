<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
if (admin_method() !== 'GET') {
    json_response(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
}
$action = admin_action();
$pdo = db();

if ($action === 'list') {
    require_admin_permission('tenders.view');
    $stmt = $pdo->prepare(
        'SELECT t.id, t.tender_code, t.tender_category, t.title, t.vehicle_or_machine_spec, t.city, t.status, t.created_at,
                (SELECT COUNT(*) FROM b2b_sealed_proforma_bids b WHERE b.tender_id = t.id) AS bids_count
         FROM b2b_tenders t ORDER BY t.id DESC LIMIT 200'
    );
    $stmt->execute();
    json_response(['success' => true, 'rows' => $stmt->fetchAll()]);
}

if ($action === 'bids') {
    // Sealed amounts are visible only to roles holding tenders.view_sealed.
    $admin = require_admin_permission('tenders.view_sealed');
    $tenderId = (int)($_GET['tender_id'] ?? 0);
    $stmt = $pdo->prepare(
        'SELECT proforma_ref_code, supplier_company_title, part_origin_type, parts_amount_kurus, labor_amount_kurus,
                kdv_amount_kurus, grand_total_kurus, supplier_net_share_kurus, escrow_pool_fee_kurus,
                warranty_months, delivery_days, status, created_at
         FROM b2b_sealed_proforma_bids WHERE tender_id = :t ORDER BY grand_total_kurus ASC'
    );
    $stmt->execute([':t' => $tenderId]);
    admin_audit($admin, 'SEALED_BIDS_VIEWED', 'B2B_TENDER', (string)$tenderId, null, null, '');
    json_response(['success' => true, 'rows' => $stmt->fetchAll()]);
}

json_response(['success' => false, 'error' => 'UNKNOWN_ACTION'], 400);
