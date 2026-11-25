import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	calculateSplitPaymentEscrow,
	calculateTalentTrendingScore,
	canTransitionEscrow,
	canTransitionLeadState,
	canTransitionOfferState,
	createUrgentJobPostPayload,
	createWorkWithYouRequestPayload,
	enqueueOfflineAction,
	evaluatePasswordStrength,
	evaluateProAvailability,
	evaluateWorkflowRoleAccess,
	flushOfflineQueue,
	formatInstagramProShowcase,
	getOfflineQueue,
	isAllowedUstanomiUrl,
	OFFER_SERVICE_CATEGORIES,
	rankTalentShowcasePosts,
	redactKvkkSensitiveText,
	resolveOfferServiceCategory,
	resolveUniversalProfessionCluster,
	UNIVERSAL_PROFESSION_CLUSTERS,
	validateKycRegistrationPayload,
	validateTurkishIban,
	validateTurkishTckn,
	validateTurkishVkn,
} from "../www/capacitor-bridge.js";

// Simple in-memory localStorage shim for Node test runner
const memoryStore = new Map();
globalThis.localStorage = {
	getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
	setItem: (key, val) => memoryStore.set(key, String(val)),
	removeItem: (key) => memoryStore.delete(key),
	clear: () => memoryStore.clear(),
};

describe("Ustanomi Native Capacitor Bridge, Universal Professions & Instagram/TikTok Social Suite", () => {
	beforeEach(() => {
		memoryStore.clear();
	});

	it("allows only HTTPS Ustanomi and vetted 3D Secure payment hosts (PayTR & iyzico)", () => {
		assert.equal(
			isAllowedUstanomiUrl(
				"https://ustanomi-web-production.up.railway.app/app/ihale",
			),
			true,
		);
		assert.equal(
			isAllowedUstanomiUrl("https://www.paytr.com/odeme/guvenli"),
			true,
		);
		assert.equal(
			isAllowedUstanomiUrl("https://api.iyzipay.com/payment/3dsecure"),
			true,
		);
		assert.equal(isAllowedUstanomiUrl("https://sub.ustanomi.com/panel"), true);

		assert.equal(
			isAllowedUstanomiUrl(
				"http://ustanomi-web-production.up.railway.app/app/",
			),
			false,
		);
		assert.equal(
			isAllowedUstanomiUrl("https://evil-phishing.example.com/paytr"),
			false,
		);
		assert.equal(isAllowedUstanomiUrl("javascript:alert(1)"), false);
	});

	it("enforces Güvenli Havuz (Escrow) and AI Studio Lead/Offer state machine transitions", () => {
		assert.equal(
			canTransitionEscrow("PENDING_PAYMENT", "FUNDS_HELD_IN_POOL"),
			true,
		);
		assert.equal(
			canTransitionEscrow("FUNDS_HELD_IN_POOL", "WORK_IN_PROGRESS"),
			true,
		);
		assert.equal(
			canTransitionEscrow("WORK_IN_PROGRESS", "CUSTOMER_APPROVED_RELEASED"),
			true,
		);
		assert.equal(
			canTransitionEscrow("PENDING_PAYMENT", "CUSTOMER_APPROVED_RELEASED"),
			false,
		);

		assert.equal(canTransitionLeadState("DRAFT", "OPEN_FOR_OFFERS"), true);
		assert.equal(
			canTransitionLeadState("OPEN_FOR_OFFERS", "OFFER_ACCEPTED"),
			true,
		);
		assert.equal(canTransitionLeadState("OFFER_ACCEPTED", "IN_PROGRESS"), true);
		assert.equal(canTransitionLeadState("IN_PROGRESS", "COMPLETED"), true);
		assert.equal(canTransitionLeadState("COMPLETED", "OPEN_FOR_OFFERS"), false);

		assert.equal(canTransitionOfferState("PENDING", "ACCEPTED"), true);
		assert.equal(canTransitionOfferState("PENDING", "WITHDRAWN"), true);
		assert.equal(canTransitionOfferState("ACCEPTED", "COMPLETED"), true);
		assert.equal(canTransitionOfferState("REJECTED", "ACCEPTED"), false);
	});

	it("resolves all 6 AI Studio categories and 8 Universal Profession Clusters across every trade", () => {
		assert.equal(OFFER_SERVICE_CATEGORIES.length, 6);
		assert.equal(
			resolveOfferServiceCategory("Su Tesisatı")?.apiParam,
			"Plumbing",
		);

		assert.equal(UNIVERSAL_PROFESSION_CLUSTERS.length, 8);
		assert.equal(
			resolveUniversalProfessionCluster("çilingir").code,
			"HOME_TECH",
		);
		assert.equal(
			resolveUniversalProfessionCluster("oto çekici").code,
			"AUTO_LOGISTICS",
		);
		assert.equal(
			resolveUniversalProfessionCluster("güvenlik kamerası").code,
			"DIGITAL_TECH",
		);
		assert.equal(
			resolveUniversalProfessionCluster("düğün fotoğrafçısı").code,
			"EVENTS_MEDIA",
		);
		assert.equal(
			resolveUniversalProfessionCluster("kuaför").code,
			"BEAUTY_CARE",
		);
		assert.equal(
			resolveUniversalProfessionCluster("direksiyon").code,
			"EDUCATION_PRO",
		);
		assert.equal(
			resolveUniversalProfessionCluster("koltuk yıkama").code,
			"CLEANING_GARDEN",
		);
		assert.equal(
			resolveUniversalProfessionCluster("argon kaynak").code,
			"B2B_INDUSTRIAL",
		);
	});

	it("evaluates working hours Open / Closed / 24-7 On-Duty modes and formats Instagram Pro Showcase", () => {
		const openState = evaluateProAvailability({
			manualMode: "AUTO",
			openHour: 8,
			closeHour: 20,
			currentHour: 15,
		});
		assert.equal(openState.status, "OPEN");
		assert.equal(openState.isAcceptingUrgentJobs, true);

		const closedState = evaluateProAvailability({
			manualMode: "AUTO",
			openHour: 8,
			closeHour: 20,
			currentHour: 23,
		});
		assert.equal(closedState.status, "CLOSED");
		assert.equal(closedState.isAcceptingUrgentJobs, false);

		const onDutyState = evaluateProAvailability({
			manualMode: "ON_DUTY_24_7",
			openHour: 8,
			closeHour: 20,
			currentHour: 3,
		});
		assert.equal(onDutyState.status, "ON_DUTY_24_7");
		assert.equal(onDutyState.rateMultiplier, 1.25);

		const showcase = formatInstagramProShowcase({
			handle: "selim_usta",
			displayName: "Selim Usta",
			professionTitle: "7/24 Nöbetçi Çilingir",
			availabilityConfig: { manualMode: "ON_DUTY_24_7" },
			priceMenu: [{ title: "Kapı Açma", priceTl: 800, pricingType: "FIXED" }],
		});
		assert.equal(showcase.handle, "@selim_usta");
		assert.equal(showcase.priceMenu[0].effectivePriceTl, 1000); // 800 * 1.25 on-duty rate
	});

	it("builds Urgent Job Feed posts with KVKK masking and open-pro notification routing", () => {
		const urgentPost = createUrgentJobPostPayload({
			title: "Kadıköy acil oto çekici tel 0532 111 22 33",
			description: "Aracım yolda kaldı",
			professionQuery: "oto çekici",
			urgencyCode: "EMERGENCY_30M",
			customerBudgetTl: 1400,
		});
		assert.equal(urgentPost.clusterCode, "AUTO_LOGISTICS");
		assert.equal(urgentPost.onlyNotifyOpenPros, true);
		assert.equal(urgentPost.title.includes("0532 111 22 33"), false);
	});

	it("ranks talent posts by likes and direct 'Seninle Çalışmak İstiyorum' requests", () => {
		const rawTalents = [
			{
				id: "t1",
				title: "Standart Boya",
				likesCount: 40,
				workRequestsCount: 2,
				isProOpen: true,
			},
			{
				id: "t2",
				title: "4K Drone & Reels",
				likesCount: 850,
				workRequestsCount: 35,
				isProOpen: true,
			},
			{
				id: "t3",
				title: "Mobil Oto Elektrik",
				likesCount: 310,
				workRequestsCount: 14,
				isProOpen: true,
			},
		];
		const ranked = rankTalentShowcasePosts(rawTalents);
		assert.equal(ranked[0].id, "t2");
		assert.equal(ranked[0].trendingRank, 1);
		assert.equal(ranked[0].isFeaturedTopTalent, true);
		assert.equal(
			calculateTalentTrendingScore(rawTalents[1]) >
				calculateTalentTrendingScore(rawTalents[0]),
			true,
		);

		const hireReq = createWorkWithYouRequestPayload({
			talentPostId: "t2",
			proHandle: "elif_visual_studio",
			skillTitle: "4K Drone & Reels Çekimi",
			offeredBudgetTl: 5000,
			customerNote:
				"Cumartesi çekim için seninle çalışmak istiyorum, tel 0532 999 88 77",
		});
		assert.equal(hireReq.proHandle, "@elif_visual_studio");
		assert.equal(hireReq.proNetShareTl, 4400); // 88% of 5000
		assert.equal(hireReq.platformEscrowFeeTl, 600); // 12% of 5000
		assert.equal(hireReq.status, "DIRECT_WORK_REQUEST_SENT");
		assert.equal(hireReq.customerNote.includes("0532 999 88 77"), false);
	});

	it("validates official Turkish TCKN, VKN, TR IBAN checksums, password strength, and KYC registration", () => {
		// Official algorithmic TCKN (10000000146 passes NVI Mod-10/11 rules)
		assert.equal(validateTurkishTckn("10000000146"), true);
		assert.equal(validateTurkishTckn("10000000147"), false);
		assert.equal(validateTurkishTckn("01234567890"), false);

		// Valid 26-char TR IBAN Mod-97 check
		assert.equal(validateTurkishIban("TR33 0006 1005 1978 6457 8413 26"), true);
		assert.equal(
			validateTurkishIban("TR00 0006 1005 1978 6457 8413 00"),
			false,
		);

		// Password strength evaluation
		assert.equal(evaluatePasswordStrength("12345").isStrong, false);
		assert.equal(evaluatePasswordStrength("Ustanomi2026!").isStrong, true);

		// Full KYC registration validation
		const validKyc = validateKycRegistrationPayload({
			fullName: "Selim Karaca",
			phone: "+905321112233",
			tckn: "10000000146",
			iban: "TR33 0006 1005 1978 6457 8413 26",
			password: "Ustanomi2026!",
			accountRole: "MASTER",
			kvkkAccepted: true,
			escrowContractAccepted: true,
		});
		assert.equal(validKyc.valid, true);
		assert.equal(validKyc.maskedTckn, "10*******46");

		// Reject fake TCKN
		const invalidKyc = validateKycRegistrationPayload({
			fullName: "Sahte Hesap",
			phone: "+905321112233",
			tckn: "11111111111",
			password: "Ustanomi2026!",
			accountRole: "MASTER",
			kvkkAccepted: true,
			escrowContractAccepted: true,
		});
		assert.equal(invalidKyc.valid, false);
		assert.equal(invalidKyc.errorCode, "INVALID_TCKN_CHECKSUM");
	});

	it("enforces AI Studio RBAC, Anti-IDOR ownership, and Role-Spoofing protection", () => {
		const spoofed = evaluateWorkflowRoleAccess({
			action: "SUBMIT_PRO_OFFER",
			actorUserId: 10,
			authenticatedRole: "CUSTOMER",
			claimedClientRole: "MASTER",
		});
		assert.equal(spoofed.allowed, false);
		assert.equal(spoofed.errorCode, "ROLE_SPOOFING_REJECTED");

		const selfBid = evaluateWorkflowRoleAccess({
			action: "SUBMIT_PRO_OFFER",
			actorUserId: 42,
			authenticatedRole: "MASTER",
			isVerifiedPro: true,
			leadOwnerUserId: 42,
		});
		assert.equal(selfBid.allowed, false);
		assert.equal(selfBid.errorCode, "SELF_BIDDING_FORBIDDEN");
	});

	it("calculates kuruş-exact 88% Sub-Merchant / 12% Platform Split-Payment and 30/40/30 milestones", () => {
		const split = calculateSplitPaymentEscrow(10000);
		assert.equal(split.totalKurus, 1000000);
		assert.equal(split.subMerchantShareTl, 8800);
		assert.equal(split.platformCommissionTl, 1200);
		assert.deepEqual(split.milestonesTl, [3000, 4000, 3000]);
	});

	it("redacts Turkish phone numbers, IBANs, and TCKN from field notes (KVKK compliance)", () => {
		const raw =
			"Müşteri tel 0532 123 45 67, IBAN TR33 0006 1005 1978 6457 8413 26, TCKN 12345678901";
		const safe = redactKvkkSensitiveText(raw);
		assert.equal(safe.includes("0532 123 45 67"), false);
		assert.equal(safe.includes("12345678901"), false);
		assert.equal(safe.includes("TR**[IBAN-REDACTED]**"), true);
	});

	it("enqueues and flushes offline field milestone proofs reliably", async () => {
		await enqueueOfflineAction("FIELD_MILESTONE_PROOF", {
			note: "#1042 2. Etap Seramik Döşeme",
			hasSignature: true,
		});
		const queued = await getOfflineQueue();
		assert.equal(queued.length, 1);

		const flushed = await flushOfflineQueue(async () => true);
		assert.equal(flushed.synced, 1);
		assert.equal(flushed.remaining, 0);
	});
});
