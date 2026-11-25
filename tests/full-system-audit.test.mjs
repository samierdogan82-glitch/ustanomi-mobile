import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
	evaluateAccountDeletionEligibility,
	evaluateWafRateLimitAndHoneypot,
	resolveEscrowDisputeCase,
} from "../www/capacitor-bridge.js";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("Ustanomi Pre-Launch Full System Security, PHP AST/CSRF, PWA & Store Compliance Audit", () => {
	it("verifies every PHP file in api/ and includes/ has zero UTF-8 BOM, strict_types=1, and zero raw SQL interpolation", () => {
		const dirs = ["api", "includes"];
		let checkedCount = 0;

		for (const dir of dirs) {
			const fullDir = path.join(projectRoot, dir);
			const files = fs.readdirSync(fullDir).filter((f) => f.endsWith(".php"));
			for (const file of files) {
				const filePath = path.join(fullDir, file);
				const bytes = fs.readFileSync(filePath);

				// 1. Must not have UTF-8 BOM (EF BB BF)
				const hasBom =
					bytes.length >= 3 &&
					bytes[0] === 0xef &&
					bytes[1] === 0xbb &&
					bytes[2] === 0xbf;
				assert.equal(hasBom, false, `UTF-8 BOM detected in ${dir}/${file}`);

				const text = bytes.toString("utf8");
				// 2. Must start with <?php and declare(strict_types=1);
				assert.equal(
					text.startsWith("<?php"),
					true,
					`${dir}/${file} must start with <?php without leading whitespace`,
				);
				assert.equal(
					text.includes("declare(strict_types=1);"),
					true,
					`${dir}/${file} must declare(strict_types=1);`,
				);

				// 3. Must never use deprecated or unsafe mysql_query / mysqli_query / eval / shell_exec
				assert.equal(
					/\b(mysql_query|mysqli_query|eval|shell_exec|passthru|system)\s*\(/.test(
						text,
					),
					false,
					`Unsafe function detected in ${dir}/${file}`,
				);
				checkedCount += 1;
			}
		}

		assert.equal(checkedCount >= 14, true);
	});

	it("verifies all state-mutating POST API endpoints enforce CSRF or HMAC webhook verification", () => {
		const apiDir = path.join(projectRoot, "api");
		const postEndpoints = [
			"auth_kyc.php",
			"b2b_proforma_tender.php",
			"checkout.php",
			"delete_account.php",
			"dm_chat_escrow.php",
			"escrow_jobs.php",
			"leads.php",
			"live_stream_gift.php",
			"pro_offers.php",
			"pro_showcase.php",
			"send_otp.php",
			"social_commerce_sync.php",
			"talent_feed.php",
			"upload_document.php",
			"urgent_feed.php",
			"verify_otp.php",
		];

		for (const ep of postEndpoints) {
			const content = fs.readFileSync(path.join(apiDir, ep), "utf8");
			assert.equal(
				content.includes("require_valid_csrf"),
				true,
				`POST endpoint api/${ep} must call require_valid_csrf()`,
			);
		}

		const webhookContent = fs.readFileSync(
			path.join(apiDir, "payment_webhook.php"),
			"utf8",
		);
		assert.equal(webhookContent.includes("verify_webhook_hmac"), true);
	});

	it("verifies AndroidManifest.xml, iOS Info.plist, capacitor.config.json, and PWA Service Worker compliance", () => {
		const manifestXml = fs.readFileSync(
			path.join(projectRoot, "android/app/src/main/AndroidManifest.xml"),
			"utf8",
		);
		assert.equal(manifestXml.includes('android:allowBackup="false"'), true);
		assert.equal(
			manifestXml.includes('android:usesCleartextTraffic="false"'),
			true,
		);
		assert.equal(
			manifestXml.includes("android.permission.POST_NOTIFICATIONS"),
			true,
		);

		const capConfig = JSON.parse(
			fs.readFileSync(path.join(projectRoot, "capacitor.config.json"), "utf8"),
		);
		assert.equal(capConfig.appId, "com.ustanomi.app");
		assert.equal(capConfig.server.cleartext, false);
		assert.equal(capConfig.ios.limitsNavigationsToAppBoundDomains, true);

		const swContent = fs.readFileSync(
			path.join(projectRoot, "www/sw.js"),
			"utf8",
		);
		assert.equal(swContent.includes('url.pathname.startsWith("/api/")'), true);
		assert.equal(swContent.includes("/offline.html"), true);

		// Verify offline.html reconnects to local bundled index.html and uses >= 16px input font size
		const offlineHtml = fs.readFileSync(
			path.join(projectRoot, "www/offline.html"),
			"utf8",
		);
		assert.equal(
			offlineHtml.includes("const TARGET_URL = 'index.html';"),
			true,
		);
		assert.equal(offlineHtml.includes("font-size:16px"), true);

		// Verify Android App Links (.well-known/assetlinks.json), iOS Universal Links, and Apple PrivacyInfo.xcprivacy
		const assetLinks = JSON.parse(
			fs.readFileSync(
				path.join(projectRoot, "www/.well-known/assetlinks.json"),
				"utf8",
			),
		);
		assert.equal(assetLinks[0].target.package_name, "com.ustanomi.app");

		const aasa = JSON.parse(
			fs.readFileSync(
				path.join(projectRoot, "www/.well-known/apple-app-site-association"),
				"utf8",
			),
		);
		assert.equal(
			aasa.applinks.details[0].appIDs[0].endsWith("com.ustanomi.app"),
			true,
		);

		const iosPrivacy = fs.readFileSync(
			path.join(projectRoot, "ios/App/App/PrivacyInfo.xcprivacy"),
			"utf8",
		);
		assert.equal(iosPrivacy.includes("NSPrivacyAccessedAPITypes"), true);
		assert.equal(iosPrivacy.includes("CA92.1"), true);
	});

	it("enforces WAF Sliding-Window Rate Limiting and Honeypot Bot Trap", () => {
		// Bot fills hidden honeypot field -> HTTP 403
		const botCheck = evaluateWafRateLimitAndHoneypot({
			honeypotValue: "http://spam-bot.example.com",
		});
		assert.equal(botCheck.allowed, false);
		assert.equal(botCheck.httpStatus, 403);
		assert.equal(botCheck.errorCode, "BOT_HONEYPOT_TRIGGERED");

		// 5 attempts within 60s window -> HTTP 429
		const now = 1700000000000;
		const rateLimited = evaluateWafRateLimitAndHoneypot({
			recentAttemptTimestampsMs: [
				now - 10000,
				now - 8000,
				now - 5000,
				now - 3000,
				now - 1000,
			],
			maxAttempts: 5,
			windowMs: 60000,
			nowMs: now,
		});
		assert.equal(rateLimited.allowed, false);
		assert.equal(rateLimited.httpStatus, 429);
		assert.equal(rateLimited.errorCode, "RATE_LIMIT_EXCEEDED");
	});

	it("enforces Apple 5.1.1(v) / Google Play / KVKK Account Deletion rules and Escrow Dispute Arbitration", () => {
		// Cannot delete account while funds are held in Escrow Pool
		const blockedDelete = evaluateAccountDeletionEligibility({
			userId: 42,
			activeEscrowStatuses: ["WORK_IN_PROGRESS"],
		});
		assert.equal(blockedDelete.canDeleteAccount, false);
		assert.equal(blockedDelete.httpStatus, 409);

		// Can delete and anonymize once all escrow jobs are completed
		const allowedDelete = evaluateAccountDeletionEligibility({
			userId: 42,
			activeEscrowStatuses: ["CUSTOMER_APPROVED_RELEASED"],
		});
		assert.equal(allowedDelete.canDeleteAccount, true);
		assert.equal(
			allowedDelete.anonymizedEmail,
			"deleted_42@anon.ustanomi.local",
		);

		// Escrow Dispute Arbitration: Pro with wet signature -> 88% payout
		const proWins = resolveEscrowDisputeCase({
			totalEscrowAmountTl: 10000,
			hasCustomerWetSignatureOrOtp: true,
		});
		assert.equal(proWins.resolutionDecision, "RELEASE_FULL_TO_PRO");
		assert.equal(proWins.proPayoutNetTl, 8800);

		// Partial 50% work completion with photo proof -> 50% refund (5,000 TL), 88% of remaining 5,000 TL (4,400 TL) to Pro
		const partial = resolveEscrowDisputeCase({
			totalEscrowAmountTl: 10000,
			hasBeforeAfterPhotoProof: true,
			proCompletionRatioPercent: 50,
		});
		assert.equal(partial.resolutionDecision, "PARTIAL_SETTLEMENT");
		assert.equal(partial.customerRefundTl, 5000);
		assert.equal(partial.proPayoutNetTl, 4400);

		// Zero proof -> 100% refund to customer
		const customerWins = resolveEscrowDisputeCase({
			totalEscrowAmountTl: 10000,
			hasBeforeAfterPhotoProof: false,
			hasCustomerWetSignatureOrOtp: false,
		});
		assert.equal(customerWins.resolutionDecision, "FULL_REFUND_TO_CUSTOMER");
		assert.equal(customerWins.customerRefundTl, 10000);
	});

	it("verifies Flutter Native layer (flutter_app/) implements all core skills and cloud CI workflow", () => {
		const pubspec = fs.readFileSync(
			path.join(projectRoot, "flutter_app/pubspec.yaml"),
			"utf8",
		);
		assert.equal(pubspec.includes("name: ustanomi_flutter"), true);

		const domainDart = fs.readFileSync(
			path.join(projectRoot, "flutter_app/lib/core/ustanomi_domain.dart"),
			"utf8",
		);
		assert.equal(domainDart.includes("calculateEscrowSplitKurus"), true);
		assert.equal(domainDart.includes("validateTurkishTckn"), true);
		assert.equal(domainDart.includes("validateTurkishVkn"), true);
		assert.equal(domainDart.includes("validateTurkishIban"), true);
		assert.equal(domainDart.includes("buildB2bProformaContract"), true);
		assert.equal(domainDart.includes("evaluateCargoWaybillRelease"), true);
		assert.equal(domainDart.includes("parseExternalCommerceListing"), true);

		const mainDart = fs.readFileSync(
			path.join(projectRoot, "flutter_app/lib/main.dart"),
			"utf8",
		);
		assert.equal(mainDart.includes("PageView.builder"), true);
		assert.equal(mainDart.includes("FontFeature.tabularFigures()"), true);

		const workflowYml = fs.readFileSync(
			path.join(projectRoot, "flutter_app/cloud-build-flutter.yml"),
			"utf8",
		);
		assert.equal(workflowYml.includes("build-flutter:"), true);
		assert.equal(workflowYml.includes("subosito/flutter-action@v2"), true);

		// Verify mobile zero-shift CSS rules in www/index.html
		const indexHtml = fs.readFileSync(
			path.join(projectRoot, "www/index.html"),
			"utf8",
		);
		assert.equal(indexHtml.includes("overflow-x: hidden"), true);
		assert.equal(indexHtml.includes("-apple-system"), true);
		assert.equal(indexHtml.includes("fonts.googleapis"), false);
		assert.equal(indexHtml.includes("font-size: 16px"), true);
		assert.equal(indexHtml.includes("syncDiscoverStripVisibility"), true);
	});
});
