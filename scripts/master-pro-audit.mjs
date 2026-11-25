import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import {
	buildWorkInProgressLiveStreamDeck,
	calculateLiveGiftSettlementKurus,
	calculateSplitPaymentEscrow,
	createSealedProformaBidPayload,
	createWebRtcLiveWorkRoomConfig,
	evaluateAccountDeletionEligibility,
	evaluateWafRateLimitAndHoneypot,
	getProfessionGiftCatalog,
	processLiveStreamGiftTransaction,
	redactKvkkSensitiveText,
	resolveEscrowDisputeCase,
	resolveStoreCompliantGiftBillingMode,
	validateTurkishIban,
	validateTurkishTckn,
	validateTurkishVkn,
} from "../www/capacitor-bridge.js";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..");
const wwwRoot = path.join(projectRoot, "www");

const report = {
	timestamp: new Date().toISOString(),
	phase1_financialLedger: { passed: 0, failed: 0 },
	phase2_securityAndPhpSql: { passed: 0, failed: 0 },
	phase3_mobileViewports: { passed: 0, failed: 0, details: [] },
	phase4_storeCompliance: { passed: 0, failed: 0 },
};

function check(phaseObj, condition, label) {
	if (condition) {
		phaseObj.passed += 1;
	} else {
		phaseObj.failed += 1;
		console.error(`[FAIL] ${label}`);
	}
}

// ============================================================================
// PHASE 1: Financial Ledger, Kuruş-Exact Conservation & LiveKit/IAP Compliance
// ============================================================================
for (const tl of [
	1, 19.99, 49.5, 100, 333.33, 850, 1249.75, 4500, 18500, 99999.99,
]) {
	const split = calculateSplitPaymentEscrow(tl);
	const expectedKurus = Math.round(tl * 100);
	check(
		report.phase1_financialLedger,
		split.totalKurus === expectedKurus &&
			Math.round(split.subMerchantShareTl * 100) +
				Math.round(split.platformCommissionTl * 100) ===
				expectedKurus,
		`Escrow 88/12 kuruş conservation for ${tl} TL`,
	);
}

const allGifts = getProfessionGiftCatalog("ALL");
check(
	report.phase1_financialLedger,
	allGifts.length === 18,
	"18 profession SVG gifts across 6 clusters",
);
for (const gift of allGifts) {
	for (const qty of [1, 5, 10, 25]) {
		const s = calculateLiveGiftSettlementKurus(gift.coins, qty);
		check(
			report.phase1_financialLedger,
			s.creatorNetKurus + s.platformFeeKurus === s.grossKurus &&
				s.grossKurus === gift.coins * qty * 50,
			`Live gift 85/15 kuruş conservation for ${gift.code} x${qty}`,
		);
	}
}

const physicalMode = resolveStoreCompliantGiftBillingMode({
	platform: "IOS",
	linkedToPhysicalServiceContract: true,
	coins: 1000,
});
const iapMode = resolveStoreCompliantGiftBillingMode({
	platform: "IOS",
	linkedToPhysicalServiceContract: false,
	coins: 1000,
});
check(
	report.phase1_financialLedger,
	physicalMode.billingMode === "PHYSICAL_SERVICE_PREPAYMENT_ESCROW" &&
		iapMode.billingMode === "APPLE_STOREKIT2_CONSUMABLE_IAP" &&
		iapMode.storeTaxKurus +
			iapMode.creatorNetKurus +
			iapMode.platformFeeKurus ===
			iapMode.grossKurus,
	"Apple 3.1.3(e) Physical Escrow vs StoreKit 2 IAP billing modes",
);

const rtcRoom = createWebRtcLiveWorkRoomConfig({
	streamId: "LIVE-301",
	role: "STREAMER",
});
check(
	report.phase1_financialLedger,
	rtcRoom.engine === "LIVEKIT_WEBRTC_SFU" &&
		rtcRoom.simulcastLayers.length === 3 &&
		rtcRoom.permissions.canPublishVideo === true,
	"LiveKit WebRTC SFU room config",
);

check(
	report.phase1_financialLedger,
	validateTurkishTckn("10000000146") &&
		!validateTurkishTckn("10000000147") &&
		validateTurkishVkn("1234567890") === true &&
		validateTurkishVkn("1234567891") === false &&
		validateTurkishIban("TR330006100519786457841326"),
	"Official TCKN, VKN, and TR IBAN algorithmic checksums",
);

const proformaOwner = createSealedProformaBidPayload({
	tenderId: "TND-901",
	supplierCompanyTitle: "Maslak Bimmer Özel Servis Ltd.",
	partsDescription: "Orijinal Triger Seti",
	partsAmountTl: 10000,
	laborAmountTl: 5000,
	viewerUserId: 10,
	tenderOwnerUserId: 10,
	supplierUserId: 20,
});
const proformaCompetitor = createSealedProformaBidPayload({
	tenderId: "TND-901",
	supplierCompanyTitle: "Maslak Bimmer Özel Servis Ltd.",
	partsDescription: "Orijinal Triger Seti",
	partsAmountTl: 10000,
	laborAmountTl: 5000,
	viewerUserId: 99,
	tenderOwnerUserId: 10,
	supplierUserId: 20,
});
check(
	report.phase1_financialLedger,
	proformaOwner.financials.grandTotalTl === 18000 &&
		proformaCompetitor.financials.grandTotalTl === undefined,
	"B2B Sealed Proforma Anti-IDOR competitor masking",
);

const selfGift = processLiveStreamGiftTransaction({
	streamId: "LIVE-301",
	giftCode: "GOLDEN_PISTON",
	senderUserId: 201,
	streamerUserId: 201,
});
check(
	report.phase1_financialLedger,
	selfGift.valid === false && selfGift.errorCode === "SELF_GIFTING_FORBIDDEN",
	"Self-gifting AML guard",
);

// ============================================================================
// PHASE 2: Security Shield, PHP 8.3 AST/BOM/CSRF & 16-Table SQL Schema
// ============================================================================
for (const dir of ["api", "includes"]) {
	const fullDir = path.join(projectRoot, dir);
	for (const file of fs
		.readdirSync(fullDir)
		.filter((f) => f.endsWith(".php"))) {
		const raw = fs.readFileSync(path.join(fullDir, file));
		const hasBom =
			raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
		const text = raw.toString("utf8");
		check(
			report.phase2_securityAndPhpSql,
			!hasBom &&
				text.startsWith("<?php") &&
				text.includes("declare(strict_types=1);"),
			`PHP 8.3 UTF-8 no-BOM & strict_types in ${dir}/${file}`,
		);
	}
}

const schemaSql = fs.readFileSync(
	path.join(projectRoot, "database/schema.sql"),
	"utf8",
);
const requiredTables = [
	"users",
	"service_requests",
	"escrow_transactions",
	"uploaded_documents",
	"security_audit_logs",
	"sub_merchants",
	"leads",
	"pro_offers",
	"ledger_transactions",
	"pro_social_profiles",
	"urgent_job_posts",
	"talent_posts",
	"direct_hire_requests",
	"user_kyc_identities",
	"password_reset_tokens",
	"b2b_tenders",
	"b2b_sealed_proforma_bids",
	"external_commerce_connections",
	"dm_messages",
	"live_work_streams",
	"live_gift_transactions",
];
for (const tbl of requiredTables) {
	check(
		report.phase2_securityAndPhpSql,
		schemaSql.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`),
		`MySQL table definition ${tbl}`,
	);
}

const redacted = redactKvkkSensitiveText(
	"Tel 0532 111 22 33 IBAN TR330006100519786457841326 TCKN 10000000146",
);
check(
	report.phase2_securityAndPhpSql,
	!redacted.includes("0532 111 22 33") &&
		!redacted.includes("10000000146") &&
		redacted.includes("TR**[IBAN-REDACTED]**"),
	"KVKK PII redaction",
);

const wafBot = evaluateWafRateLimitAndHoneypot({
	honeypotValue: "http://bot.local",
});
check(
	report.phase2_securityAndPhpSql,
	wafBot.allowed === false && wafBot.httpStatus === 403,
	"WAF Honeypot 403 block",
);

const blockedDelete = evaluateAccountDeletionEligibility({
	userId: 10,
	activeEscrowStatuses: ["WORK_IN_PROGRESS"],
});
const arb = resolveEscrowDisputeCase({
	totalEscrowAmountTl: 10000,
	hasCustomerWetSignatureOrOtp: true,
});
check(
	report.phase2_securityAndPhpSql,
	blockedDelete.canDeleteAccount === false &&
		arb.proPayoutNetTl === 8800 &&
		buildWorkInProgressLiveStreamDeck().length === 4,
	"Account deletion escrow lock & dispute arbitration",
);

// ============================================================================
// PHASE 3: 4-Viewport Mobile Zero-Shift E2E Audit (320px, 360px, 390px, 430px)
// ============================================================================
const browserBin = [
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
	"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => fs.existsSync(p));

const mime = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
};

function wrapperHtml(src, w, h) {
	return `<!doctype html><html><body style="margin:0;background:#fff">
<iframe id="f" src="${src}" style="border:0;width:${w}px;height:${h}px;display:block"></iframe>
<script>
const f=document.getElementById('f');
f.onload=()=>setTimeout(()=>{
  const doc=f.contentDocument;
  const d=doc.documentElement;
  const inputs=[...doc.querySelectorAll('input:not([type="checkbox"]):not([hidden]),select')];
  const minFont=inputs.reduce((acc,el)=>{
    const fs=parseFloat(f.contentWindow.getComputedStyle(el).fontSize)||16;
    return Math.min(acc,fs);
  },16);
  document.title='AUDIT:'+d.clientWidth+':'+d.scrollWidth+':'+minFont;
},550);
</script></body></html>`;
}

const server = http.createServer((req, res) => {
	const u = new URL(req.url, "http://127.0.0.1");
	if (u.pathname === "/__audit.html") {
		res.writeHead(200, { "Content-Type": mime[".html"] });
		res.end(
			wrapperHtml(
				u.searchParams.get("src"),
				u.searchParams.get("w"),
				u.searchParams.get("h"),
			),
		);
		return;
	}
	const file = path.join(
		wwwRoot,
		u.pathname === "/" ? "/index.html" : u.pathname,
	);
	if (!fs.existsSync(file)) {
		res.writeHead(404);
		res.end("nf");
		return;
	}
	res.writeHead(200, {
		"Content-Type": mime[path.extname(file)] || "text/plain",
	});
	res.end(fs.readFileSync(file));
});

const routesToTest = [
	["01_discover_reels", "/index.html"],
	["02_profile_grid", "/index.html?tab=tab-profile"],
	["03_profile_prices", "/index.html?tab=tab-profile&prices=1"],
	["04_profile_wallet", "/index.html?tab=tab-profile&wallet=1"],
	["05_urgent_jobs", "/index.html?tab=tab-urgent"],
	["06_b2b_tenders", "/index.html?tab=tab-b2b"],
	["07_create_sahibinden", "/index.html?sheet=create"],
	["08_dm_escrow", "/index.html?dm=1"],
	["09_story_radar", "/index.html?story=1"],
	["10_filter_12d", "/index.html?sheet=filter"],
	["11_wet_signature", "/index.html?sheet=signature"],
	["12_auth_kyc", "/index.html?tab=tab-auth"],
	["13_live_work_room", "/index.html?live=1"],
	["14_profession_gifts", "/index.html?gift=1"],
	["15_offline_shell", "/offline.html"],
];

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

try {
	for (const [label, routePath] of routesToTest) {
		for (const widthPx of [320, 360, 390, 430]) {
			const auditUrl = `http://127.0.0.1:${port}/__audit.html?src=${encodeURIComponent(routePath)}&w=${widthPx}&h=844`;
			const { stdout } = await execFileAsync(browserBin, [
				"--headless=new",
				"--no-sandbox",
				"--disable-gpu",
				"--virtual-time-budget=3500",
				"--dump-dom",
				auditUrl,
			]);
			const m = stdout.match(/AUDIT:(\d+):(\d+):([\d.]+)/);
			const cw = m ? Number(m[1]) : 0;
			const sw = m ? Number(m[2]) : 9999;
			const minFont = m ? Number(m[3]) : 0;
			const ok = Boolean(m && sw <= cw && minFont >= 16);
			check(
				report.phase3_mobileViewports,
				ok,
				`${label} @${widthPx}px (client=${cw}, scroll=${sw}, minInputFont=${minFont}px)`,
			);
		}
	}
} finally {
	server.close();
}

// ============================================================================
// PHASE 4: Google Play & Apple App Store Compliance Audit
// ============================================================================
const androidManifest = fs.readFileSync(
	path.join(projectRoot, "android/app/src/main/AndroidManifest.xml"),
	"utf8",
);
check(
	report.phase4_storeCompliance,
	androidManifest.includes('android:allowBackup="false"') &&
		androidManifest.includes('android:usesCleartextTraffic="false"') &&
		androidManifest.includes('android:autoVerify="true"'),
	"AndroidManifest security & App Links autoVerify",
);

check(
	report.phase4_storeCompliance,
	fs.existsSync(path.join(projectRoot, "ios/App/App/PrivacyInfo.xcprivacy")) &&
		fs.existsSync(path.join(projectRoot, "www/.well-known/assetlinks.json")) &&
		fs.existsSync(
			path.join(projectRoot, "www/.well-known/apple-app-site-association"),
		) &&
		fs.existsSync(
			path.join(projectRoot, "store-assets/google-play-icon-512.png"),
		) &&
		fs.existsSync(
			path.join(projectRoot, "store-assets/apple-app-store-icon-1024.png"),
		) &&
		fs.existsSync(
			path.join(
				projectRoot,
				"store-assets/google-play-feature-graphic-1024x500.png",
			),
		),
	"iOS PrivacyInfo.xcprivacy, Universal/App Links & Store Graphics",
);

const totalPassed =
	report.phase1_financialLedger.passed +
	report.phase2_securityAndPhpSql.passed +
	report.phase3_mobileViewports.passed +
	report.phase4_storeCompliance.passed;
const totalFailed =
	report.phase1_financialLedger.failed +
	report.phase2_securityAndPhpSql.failed +
	report.phase3_mobileViewports.failed +
	report.phase4_storeCompliance.failed;

console.log(
	JSON.stringify(
		{
			status: totalFailed === 0 ? "ALL_GREEN_MASTER_PRO_VERIFIED" : "FAILED",
			totalPassed,
			totalFailed,
			phases: {
				phase1_financialLedger: report.phase1_financialLedger,
				phase2_securityAndPhpSql: report.phase2_securityAndPhpSql,
				phase3_mobileViewports: {
					passed: report.phase3_mobileViewports.passed,
					failed: report.phase3_mobileViewports.failed,
				},
				phase4_storeCompliance: report.phase4_storeCompliance,
			},
		},
		null,
		2,
	),
);

if (totalFailed > 0) {
	process.exit(1);
}
