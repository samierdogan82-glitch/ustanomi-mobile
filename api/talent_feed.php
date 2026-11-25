<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/pdo-security-bootstrap.php';

init_secure_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    $cluster = trim((string)($_GET['cluster'] ?? ''));

    $sql    = 'SELECT id, pro_user_id, pro_handle, cluster_code, skill_title, description,
                      starting_price_kurus, likes_count, work_requests_count, trending_score, created_at
               FROM talent_posts
               WHERE 1=1';
    $params = [];

    if ($cluster !== '') {
        $sql .= ' AND cluster_code = :cluster';
        $params[':cluster'] = $cluster;
    }

    $sql .= ' ORDER BY trending_score DESC, likes_count DESC, created_at DESC LIMIT 50';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    $talents = [];
    $rank    = 1;
    foreach ($stmt->fetchAll() as $row) {
        $talents[] = [
            'id'                => (int)$row['id'],
            'proUserId'         => (int)$row['pro_user_id'],
            'proHandle'         => '@' . e(ltrim((string)$row['pro_handle'], '@')),
            'clusterCode'       => e((string)$row['cluster_code']),
            'skillTitle'        => e((string)$row['skill_title']),
            'description'       => e((string)$row['description']),
            'startingPriceTl'   => round(((int)$row['starting_price_kurus']) / 100, 2),
            'likesCount'        => (int)$row['likes_count'],
            'workRequestsCount' => (int)$row['work_requests_count'],
            'trendingScore'     => (int)$row['trending_score'],
            'trendingRank'      => $rank,
            'isFeaturedTop'     => $rank === 1,
        ];
        $rank++;
    }

    json_response(['status' => 'ok', 'talents' => $talents]);
}

if ($method !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Desteklenmeyen HTTP metodu.'], 405);
}

$payload = read_json_body();
require_valid_csrf($payload);

$action = trim((string)($payload['action'] ?? 'share_talent'));

if ($action === 'share_talent') {
    $user        = require_authenticated_user(['MASTER', 'CUSTOMER', 'ADMIN']);
    $skillTitle  = trim((string)($payload['skillTitle'] ?? ''));
    $description = trim((string)($payload['description'] ?? ''));
    $clusterCode = trim((string)($payload['clusterCode'] ?? 'HOME_TECH'));
    $priceTl     = max(0.0, (float)($payload['startingPriceTl'] ?? 750));
    $priceKurus  = (int)round($priceTl * 100);
    $handle      = preg_replace('/[^a-z0-9_]/', '', strtolower(trim((string)($payload['proHandle'] ?? ('uzman_' . $user['id'])))));

    if (mb_strlen($skillTitle) < 4) {
        json_response(['status' => 'error', 'message' => 'Yetenek başlığı en az 4 karakter olmalıdır.'], 400);
    }

    $stmt = db()->prepare(
        'INSERT INTO talent_posts (
            pro_user_id, pro_handle, cluster_code, skill_title, description,
            starting_price_kurus, likes_count, work_requests_count, trending_score, created_at
         ) VALUES (
            :uid, :handle, :cluster, :title, :desc,
            :price, 1, 0, 150, NOW()
         )'
    );
    $stmt->execute([
        ':uid'     => $user['id'],
        ':handle'  => mb_substr($handle !== '' ? $handle : ('uzman_' . $user['id']), 0, 64),
        ':cluster' => mb_substr($clusterCode, 0, 40),
        ':title'   => mb_substr($skillTitle, 0, 180),
        ':desc'    => mb_substr($description, 0, 1500),
        ':price'   => $priceKurus,
    ]);

    $newId = (int)db()->lastInsertId();
    log_security_audit('TALENT_SHARED', 'TALENT_POST', (string)$newId);

    json_response([
        'status'  => 'ok',
        'id'      => $newId,
        'message' => 'Yetenek paylaşımınız vitrine eklendi! Beğeni aldıkça üst sıralara yükselecek.',
    ], 201);
}

if ($action === 'like_talent') {
    $user         = require_authenticated_user(['CUSTOMER', 'MASTER', 'ADMIN']);
    $talentPostId = (int)($payload['talentPostId'] ?? 0);

    if ($talentPostId <= 0) {
        json_response(['status' => 'error', 'message' => 'Geçersiz yetenek paylaşımı.'], 400);
    }

    $stmt = db()->prepare(
        'UPDATE talent_posts
         SET likes_count = likes_count + 1,
             trending_score = trending_score + 2
         WHERE id = :id'
    );
    $stmt->execute([':id' => $talentPostId]);

    json_response([
        'status'       => 'ok',
        'talentPostId' => $talentPostId,
        'message'      => 'Beğeniniz kaydedildi ve yetenek öne çıkarıldı.',
    ]);
}

if ($action === 'work_with_you') {
    $user              = require_authenticated_user(['CUSTOMER', 'ADMIN']);
    $talentPostId      = (int)($payload['talentPostId'] ?? 0);
    $offeredBudgetTl   = max(0.0, (float)($payload['offeredBudgetTl'] ?? 0));
    $customerNote      = trim((string)($payload['customerNote'] ?? ''));
    $preferredSchedule = trim((string)($payload['preferredSchedule'] ?? 'En Kısa Sürede'));

    $budgetKurus = (int)round($offeredBudgetTl * 100);
    if ($talentPostId <= 0 || $budgetKurus <= 0) {
        json_response(['status' => 'error', 'message' => 'Lütfen geçerli bir yetenek ilanı ve bütçe giriniz.'], 400);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $postStmt = $pdo->prepare('SELECT id, pro_user_id FROM talent_posts WHERE id = :id LIMIT 1 FOR UPDATE');
        $postStmt->execute([':id' => $talentPostId]);
        $post = $postStmt->fetch();

        if (!$post) {
            throw new RuntimeException('Yetenek ilanı bulunamadı.');
        }

        $feeKurus   = (int)round(($budgetKurus * 1200) / 10000);
        $shareKurus = $budgetKurus - $feeKurus;
        $reqCode    = 'HIRE-' . date('Ymd') . '-' . random_int(10000, 99999);

        $insStmt = $pdo->prepare(
            'INSERT INTO direct_hire_requests (
                request_code, talent_post_id, customer_user_id, pro_user_id,
                offered_budget_kurus, pro_net_share_kurus, platform_fee_kurus,
                customer_note, preferred_schedule, status, created_at
             ) VALUES (
                :code, :tid, :cid, :pid,
                :budget, :share, :fee,
                :note, :sched, "SENT", NOW()
             )'
        );
        $insStmt->execute([
            ':code'   => $reqCode,
            ':tid'    => $talentPostId,
            ':cid'    => $user['id'],
            ':pid'    => (int)$post['pro_user_id'],
            ':budget' => $budgetKurus,
            ':share'  => $shareKurus,
            ':fee'    => $feeKurus,
            ':note'   => mb_substr($customerNote, 0, 1500),
            ':sched'  => mb_substr($preferredSchedule, 0, 120),
        ]);

        // Boost trending score by +18 on every direct work request
        $boostStmt = $pdo->prepare(
            'UPDATE talent_posts
             SET work_requests_count = work_requests_count + 1,
                 trending_score = trending_score + 18
             WHERE id = :id'
        );
        $boostStmt->execute([':id' => $talentPostId]);

        $pdo->commit();

        log_security_audit('DIRECT_WORK_WITH_YOU_SENT', 'DIRECT_HIRE', $reqCode, [
            'talent_post_id' => $talentPostId,
            'budget_kurus'   => $budgetKurus,
        ]);

        json_response([
            'status'          => 'ok',
            'requestCode'     => e($reqCode),
            'offeredBudgetTl' => round($budgetKurus / 100, 2),
            'proNetShareTl'   => round($shareKurus / 100, 2),
            'platformFeeTl'   => round($feeKurus / 100, 2),
            'message'         => '🤝 "Seninle Çalışmak İstiyorum" talebiniz uzmana anında iletildi!',
        ], 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_response(['status' => 'error', 'message' => e($e->getMessage())], 409);
    }
}

json_response(['status' => 'error', 'message' => 'Bilinmeyen işlem.'], 400);
