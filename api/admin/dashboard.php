<?php
declare(strict_types=1);
require_once __DIR__ . '/../../includes/admin-security.php';

admin_endpoint_headers();
if (admin_method() !== 'GET') {
    json_response(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
}
require_admin_permission('dashboard.view');

$pdo = db();
$scalar = static function (string $sql) use ($pdo): int {
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    return (int)($stmt->fetchColumn() ?: 0);
};

$kpis = [
    'revenue_today_kurus'     => $scalar('SELECT COALESCE(SUM(amount_cents),0) FROM escrow_transactions WHERE created_at >= CURDATE()'),
    'revenue_week_kurus'      => $scalar('SELECT COALESCE(SUM(amount_cents),0) FROM escrow_transactions WHERE created_at >= (CURDATE() - INTERVAL 6 DAY)'),
    'held_in_pool_kurus'      => $scalar("SELECT COALESCE(SUM(amount_cents),0) FROM escrow_transactions WHERE status = 'HELD'"),
    'released_to_pro_kurus'   => $scalar("SELECT COALESCE(SUM(sub_merchant_share_kurus),0) FROM ledger_transactions WHERE escrow_status = 'USTAYA_AKTARILDI'"),
    'platform_revenue_kurus'  => $scalar("SELECT COALESCE(SUM(platform_commission_kurus),0) FROM ledger_transactions WHERE escrow_status = 'USTAYA_AKTARILDI'")
                                + $scalar('SELECT COALESCE(SUM(platform_fee_kurus),0) FROM live_gift_transactions'),
    'active_live_streams'     => $scalar("SELECT COUNT(*) FROM live_work_streams WHERE stream_status = 'LIVE'"),
    'open_urgent_jobs'        => $scalar("SELECT COUNT(*) FROM urgent_job_posts WHERE status = 'OPEN'"),
    'pending_kyc'             => $scalar("SELECT COUNT(*) FROM user_kyc_identities WHERE kyc_status = 'PENDING_REVIEW'"),
    'open_disputes'           => $scalar("SELECT COUNT(*) FROM service_requests WHERE escrow_status = 'DISPUTED'"),
    'pending_dual_approvals'  => $scalar("SELECT COUNT(*) FROM admin_dual_approvals WHERE status = 'PENDING'"),
];

$series = $pdo->prepare(
    'SELECT DATE(created_at) AS day, COALESCE(SUM(amount_cents),0) AS gross_kurus
     FROM escrow_transactions
     WHERE created_at >= (CURDATE() - INTERVAL 6 DAY)
     GROUP BY DATE(created_at)
     ORDER BY day ASC'
);
$series->execute();

json_response([
    'success' => true,
    'kpis'    => $kpis,
    'series'  => array_map(static fn(array $r): array => ['day' => (string)$r['day'], 'gross_kurus' => (int)$r['gross_kurus']], $series->fetchAll()),
]);
