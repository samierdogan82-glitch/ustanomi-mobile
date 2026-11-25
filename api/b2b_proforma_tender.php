<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$user   = require_authenticated_user(['CUSTOMER', 'MASTER', 'ADMIN']);

// ----------------------------------------------------------------------------
// GET: List B2B / Auto Repair / Parts Tenders & Enforce Sealed-Bid Privacy (Anti-IDOR)
// ----------------------------------------------------------------------------
if ($method === 'GET') {
    $tenderId = isset($_GET['tenderId']) ? (int)$_GET['tenderId'] : 0;

    if ($tenderId > 0) {
        $tStmt = db()->prepare('SELECT id, tender_code, buyer_user_id, tender_category, title, vehicle_or_machine_spec, parts_bom_list, city, status FROM b2b_tenders WHERE id = :id LIMIT 1');
        $tStmt->execute([':id' => $tenderId]);
        $tender = $tStmt->fetch();

        if (!$tender) {
            json_response(['status' => 'error', 'message' => 'İhale kaydı bulunamadı.'], 404);
        }

        $bStmt = db()->prepare(
            'SELECT id, proforma_ref_code, contract_ref_code, supplier_user_id, supplier_company_title,
                    part_origin_type, parts_description, parts_amount_kurus, labor_amount_kurus,
                    kdv_rate_percent, kdv_amount_kurus, grand_total_kurus, supplier_net_share_kurus,
                    escrow_pool_fee_kurus, warranty_months, delivery_days, valid_until_date,
                    escrow_provider, status
             FROM b2b_sealed_proforma_bids
             WHERE tender_id = :tid
             ORDER BY grand_total_kurus ASC'
        );
        $bStmt->execute([':tid' => $tenderId]);

        $proformas = [];
        foreach ($bStmt->fetchAll() as $row) {
            // Anti-IDOR Sealed Bid Privacy: Only the tender buyer, the bidding supplier, or ADMIN can view the private price breakdown
            $canSeePrice = ($user['role'] === 'ADMIN')
                || ((int)$tender['buyer_user_id'] === (int)$user['id'])
                || ((int)$row['supplier_user_id'] === (int)$user['id']);

            $item = [
                'id'                   => (int)$row['id'],
                'proformaRefCode'      => e((string)$row['proforma_ref_code']),
                'contractRefCode'      => e((string)$row['contract_ref_code']),
                'supplierCompanyTitle' => e((string)$row['supplier_company_title']),
                'partOriginType'       => e((string)$row['part_origin_type']),
                'warrantyMonths'       => (int)$row['warranty_months'],
                'deliveryDays'         => (int)$row['delivery_days'],
                'validUntilDate'       => e((string)$row['valid_until_date']),
                'escrowProvider'       => e((string)$row['escrow_provider']),
                'status'               => e((string)$row['status']),
                'isPrivateSealedBid'   => true,
            ];

            if ($canSeePrice) {
                $item['partsDescription']   = e((string)$row['parts_description']);
                $item['partsAmountTl']      = round(((int)$row['parts_amount_kurus']) / 100, 2);
                $item['laborAmountTl']      = round(((int)$row['labor_amount_kurus']) / 100, 2);
                $item['kdvRatePercent']     = (int)$row['kdv_rate_percent'];
                $item['kdvAmountTl']        = round(((int)$row['kdv_amount_kurus']) / 100, 2);
                $item['grandTotalTl']       = round(((int)$row['grand_total_kurus']) / 100, 2);
                $item['supplierNetShareTl'] = round(((int)$row['supplier_net_share_kurus']) / 100, 2);
                $item['escrowPoolFeeTl']    = round(((int)$row['escrow_pool_fee_kurus']) / 100, 2);
            } else {
                $item['maskedNotice'] = '🔒 Özel Kapalı Zarf Proforma Fiyatı (Yalnızca İhale Sahibine Görünür)';
            }

            $proformas[] = $item;
        }

        json_response([
            'status'          => 'ok',
            'tenderCode'      => e((string)$tender['tender_code']),
            'title'           => e((string)$tender['title']),
            'sealedBidsCount' => count($proformas),
            'proformas'       => $proformas,
        ]);
    }

    $stmt = db()->prepare(
        'SELECT id, tender_code, buyer_user_id, tender_category, title, vehicle_or_machine_spec, parts_bom_list, city, status, created_at
         FROM b2b_tenders
         ORDER BY created_at DESC
         LIMIT 50'
    );
    $stmt->execute();

    $list = [];
    foreach ($stmt->fetchAll() as $row) {
        $list[] = [
            'id'                   => (int)$row['id'],
            'tenderCode'           => e((string)$row['tender_code']),
            'tenderCategory'       => e((string)$row['tender_category']),
            'title'                => e((string)$row['title']),
            'vehicleOrMachineSpec' => e((string)$row['vehicle_or_machine_spec']),
            'partsBomList'         => e((string)$row['parts_bom_list']),
            'city'                 => e((string)$row['city']),
            'status'               => e((string)$row['status']),
            'createdAt'            => e((string)$row['created_at']),
        ];
    }

    json_response(['status' => 'ok', 'tenders' => $list]);
}

if ($method !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Desteklenmeyen HTTP metodu.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);

$action = trim((string)($payload['action'] ?? 'submit_sealed_proforma'));

// ----------------------------------------------------------------------------
// POST 1: Open a New Auto Repair / Spare Parts / Industrial Procurement Tender
// ----------------------------------------------------------------------------
if ($action === 'create_tender') {
    $category = strtoupper(trim((string)($payload['tenderCategory'] ?? 'AUTO_REPAIR_PARTS')));
    if (!in_array($category, ['AUTO_REPAIR_PARTS', 'INDUSTRIAL_MANUFACTURING', 'WHOLESALE_PROCUREMENT'], true)) {
        $category = 'AUTO_REPAIR_PARTS';
    }
    $title   = trim((string)($payload['title'] ?? ''));
    $spec    = trim((string)($payload['vehicleOrMachineSpec'] ?? ''));
    $bomList = trim((string)($payload['partsBomList'] ?? ''));
    $city    = trim((string)($payload['city'] ?? 'İstanbul'));

    if (mb_strlen($title) < 4 || mb_strlen($bomList) < 5) {
        json_response(['status' => 'error', 'message' => 'Lütfen ihale başlığını ve parça/malzeme listesini giriniz.'], 400);
    }

    $tenderCode = 'TND-' . date('Ymd') . '-' . random_int(1000, 9999);
    $stmt = db()->prepare(
        'INSERT INTO b2b_tenders (tender_code, buyer_user_id, tender_category, title, vehicle_or_machine_spec, parts_bom_list, city, status, created_at)
         VALUES (:code, :uid, :cat, :title, :spec, :bom, :city, "OPEN_FOR_SEALED_BIDS", NOW())'
    );
    $stmt->execute([
        ':code'  => $tenderCode,
        ':uid'   => $user['id'],
        ':cat'   => $category,
        ':title' => mb_substr($title, 0, 180),
        ':spec'  => mb_substr($spec, 0, 180),
        ':bom'   => mb_substr($bomList, 0, 2500),
        ':city'  => mb_substr($city, 0, 80),
    ]);

    $newId = (int)db()->lastInsertId();
    log_security_audit('B2B_TENDER_CREATED', 'B2B_TENDER', (string)$newId, ['code' => $tenderCode]);

    json_response([
        'status'     => 'ok',
        'id'         => $newId,
        'tenderCode' => e($tenderCode),
        'message'    => 'İhaleniz kapalı zarf proforma tekliflerine açıldı.',
    ], 201);
}

// ----------------------------------------------------------------------------
// POST 2: Submit a Sealed Private Proforma Invoice & Fixed-Price Escrow Contract
// ----------------------------------------------------------------------------
if ($action === 'submit_sealed_proforma') {
    if ($user['role'] !== 'MASTER' && $user['role'] !== 'ADMIN') {
        json_response(['status' => 'error', 'message' => 'Yalnızca doğrulanmış sanayici, servis ve tedarikçi hesapları proforma teklif verebilir.'], 403);
    }

    $tenderId       = (int)($payload['tenderId'] ?? 0);
    $companyTitle   = trim((string)($payload['supplierCompanyTitle'] ?? $user['full_name']));
    $partsDesc      = trim((string)($payload['partsDescription'] ?? ''));
    $partOrigin     = strtoupper(trim((string)($payload['partOriginType'] ?? 'ORIGINAL_OEM')));
    $partsTl        = max(0.0, (float)($payload['partsAmountTl'] ?? 0));
    $laborTl        = max(0.0, (float)($payload['laborAmountTl'] ?? 0));
    $warrantyMonths = max(1, min(120, (int)($payload['warrantyMonths'] ?? 12)));
    $deliveryDays   = max(1, min(180, (int)($payload['deliveryDays'] ?? 2)));
    $escrowProvider = strtoupper(trim((string)($payload['escrowProvider'] ?? 'IYZICO_ESCROW')));

    if (!in_array($partOrigin, ['ORIGINAL_OEM', 'CERTIFIED_EQUIVALENT', 'CUSTOM_MANUFACTURED'], true)) {
        $partOrigin = 'ORIGINAL_OEM';
    }
    if (!in_array($escrowProvider, ['IYZICO_ESCROW', 'PAYTR_ESCROW'], true)) {
        $escrowProvider = 'IYZICO_ESCROW';
    }

    $partsKurus    = (int)round($partsTl * 100);
    $laborKurus    = (int)round($laborTl * 100);
    $subtotalKurus = $partsKurus + $laborKurus;

    if ($tenderId <= 0 || $subtotalKurus <= 0 || mb_strlen($partsDesc) < 4) {
        json_response(['status' => 'error', 'message' => 'Geçerli bir parça/işçilik tutarı ve proforma kalem açıklaması giriniz.'], 400);
    }

    $kdvRate         = 20;
    $kdvKurus        = (int)round(($subtotalKurus * $kdvRate) / 100);
    $grandTotalKurus = $subtotalKurus + $kdvKurus;
    $feeKurus        = (int)round(($grandTotalKurus * 1200) / 10000);
    $netShareKurus   = $grandTotalKurus - $feeKurus;

    $proformaRef = 'PRF-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
    $contractRef = 'SZL-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));

    $stmt = db()->prepare(
        'INSERT INTO b2b_sealed_proforma_bids (
            proforma_ref_code, contract_ref_code, tender_id, supplier_user_id, supplier_company_title,
            part_origin_type, parts_description, parts_amount_kurus, labor_amount_kurus,
            kdv_rate_percent, kdv_amount_kurus, grand_total_kurus, supplier_net_share_kurus,
            escrow_pool_fee_kurus, warranty_months, delivery_days,
            valid_until_date, escrow_provider, status, created_at
         ) VALUES (
            :pref, :cref, :tid, :uid, :company,
            :origin, :pdesc, :pkurus, :lkurus,
            :krate, :kkurus, :gtotal, :netshare,
            :feekurus, :warranty, :delivery,
            DATE_ADD(CURDATE(), INTERVAL 7 DAY), :provider, "SEALED_SUBMITTED", NOW()
         )'
    );
    $stmt->execute([
        ':pref'     => $proformaRef,
        ':cref'     => $contractRef,
        ':tid'      => $tenderId,
        ':uid'      => $user['id'],
        ':company'  => mb_substr($companyTitle, 0, 160),
        ':origin'   => $partOrigin,
        ':pdesc'    => mb_substr($partsDesc, 0, 2000),
        ':pkurus'   => $partsKurus,
        ':lkurus'   => $laborKurus,
        ':krate'    => $kdvRate,
        ':kkurus'   => $kdvKurus,
        ':gtotal'   => $grandTotalKurus,
        ':netshare' => $netShareKurus,
        ':feekurus' => $feeKurus,
        ':warranty' => $warrantyMonths,
        ':delivery' => $deliveryDays,
        ':provider' => $escrowProvider,
    ]);

    log_security_audit('SEALED_PROFORMA_BID_SUBMITTED', 'B2B_PROFORMA', $proformaRef, [
        'tender_id'         => $tenderId,
        'grand_total_kurus' => $grandTotalKurus,
    ]);

    json_response([
        'status'            => 'ok',
        'proformaRefCode'   => e($proformaRef),
        'contractRefCode'   => e($contractRef),
        'grandTotalTl'      => round($grandTotalKurus / 100, 2),
        'supplierNetShareTl'=> round($netShareKurus / 100, 2),
        'escrowPoolFeeTl'   => round($feeKurus / 100, 2),
        'message'           => '🔒 Kapalı zarf proforma faturanız ve sabit fiyat sözleşmeniz yalnızca iş sahibine iletildi.',
    ], 201);
}

json_response(['status' => 'error', 'message' => 'Bilinmeyen B2B ihale işlemi.'], 400);
