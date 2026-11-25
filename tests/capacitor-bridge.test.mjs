import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	B2B_TENDER_CATEGORIES,
	buildFullScreenStoryDeck,
	buildOmnichannelEngagementLinks,
	calculateProWalletDashboard,
	calculateSplitPaymentEscrow,
	calculateTalentTrendingScore,
	canTransitionEscrow,
	canTransitionLeadState,
	canTransitionOfferState,
	convertAndFormatGlobalPrice,
	createDmProformaMessageCard,
	createSealedProformaBidPayload,
	createUrgentJobPostPayload,
	createWorkWithYouRequestPayload,
	detectExternalPlatformConnector,
	EXTERNAL_COMMERCE_CONNECTORS,
	enqueueOfflineAction,
	estimateArmutStyleSmartQuote,
	evaluatePasswordStrength,
	evaluateProAvailability,
	evaluateWorkflowRoleAccess,
	FULL_MARKETPLACE_FILTER_SCHEMA,
	filterAndSearchMarketplace,
	flushOfflineQueue,
	formatInstagramProShowcase,
	GLOBAL_LOCALES,
	generateGibEfaturaQrSummary,
	getOfflineQueue,
	isAllowedUstanomiUrl,
	OFFER_SERVICE_CATEGORIES,
	parseAndImportExternalCommerceProfile,
	rankTalentShowcasePosts,
	redactKvkkSensitiveText,
	resolveOfferServiceCategory,
	resolveUniversalProfessionCluster,
	sanitizeInAppChatMessage,
	UNIVERSAL_PROFESSION_CLUSTERS,
	validateKycRegistrationPayload,
	validateTurkishIban,
	validateTurkishTckn,
	validateTurkishVkn,
	verifyWaybillAndEscrowRelease,
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

		// Official 10-digit Turkish VKN Mod-10 checksum
		assert.equal(validateTurkishVkn("0000000001"), true);
		assert.equal(validateTurkishVkn("0000000002"), false);

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

	it("filters marketplace with Armut/Thumbtack multi-filters, smart quote wizard, and Global FX (TRY/USD/EUR)", () => {
		assert.equal(Object.keys(GLOBAL_LOCALES).length, 3);
		const usdPrice = convertAndFormatGlobalPrice(1000, "US");
		assert.equal(usdPrice.currency, "USD");
		assert.equal(usdPrice.amount, 29);
		assert.equal(usdPrice.formatted, "$29.00");

		const eurQuote = estimateArmutStyleSmartQuote({
			professionQuery: "tesisat",
			scopeSize: "MEDIUM",
			includeMaterials: true,
			urgencyCode: "EMERGENCY_30M",
			regionCode: "EU",
		});
		assert.equal(eurQuote.clusterCode, "HOME_TECH");
		assert.equal(eurQuote.recommendedPriceTl > 1500, true);
		assert.equal(eurQuote.formattedRecommended.startsWith("€"), true);

		const sampleListing = [
			{
				id: "p1",
				title: "Kadıköy Kombi Bakımı",
				clusterCode: "HOME_TECH",
				city: "İstanbul",
				priceTl: 900,
				etaMinutes: 25,
				isProOpen: true,
				isKycVerified: true,
				likesCount: 200,
			},
			{
				id: "p2",
				title: "Berlin Smart Home Electrical",
				clusterCode: "HOME_TECH",
				city: "Berlin",
				priceTl: 2400,
				etaMinutes: 15,
				isProOpen: false,
				isKycVerified: true,
				likesCount: 550,
			},
		];

		const openOnly = filterAndSearchMarketplace(sampleListing, {
			onlyOpenNow: true,
		});
		assert.equal(openOnly.length, 1);
		assert.equal(openOnly[0].id, "p1");

		const berlinSearch = filterAndSearchMarketplace(sampleListing, {
			city: "Berlin",
			onlyOpenNow: false,
		});
		assert.equal(berlinSearch.length, 1);
		assert.equal(berlinSearch[0].id, "p2");
	});

	it("creates Sealed Private B2B Proforma Invoices & Fixed-Price Escrow Contracts with Anti-IDOR privacy", () => {
		assert.equal(Object.keys(B2B_TENDER_CATEGORIES).length, 3);

		// Owner viewer (#10) sees full parts + labor + 20% KDV + 88/12 escrow breakdown
		const ownerView = createSealedProformaBidPayload({
			tenderId: "TND-901",
			tenderCategory: "AUTO_REPAIR_PARTS",
			supplierHandle: "maslak_bimmer_servis",
			supplierCompanyTitle: "Maslak Bimmer Özel Servis Ltd.",
			partsDescription: "Orijinal OEM Triger Seti + Devirdaim",
			partOriginType: "ORIGINAL_OEM",
			partsAmountTl: 6500,
			laborAmountTl: 3500,
			kdvRatePercent: 20,
			warrantyMonths: 12,
			deliveryDays: 2,
			viewerUserId: 10,
			tenderOwnerUserId: 10,
			supplierUserId: 99,
		});

		assert.equal(ownerView.isPrivateSealedBid, true);
		assert.equal(ownerView.proformaRefCode.startsWith("PRF-2026-"), true);
		assert.equal(ownerView.contractRefCode.startsWith("SZL-2026-"), true);
		assert.equal(ownerView.financials.subtotalNetTl, 10000);
		assert.equal(ownerView.financials.kdvAmountTl, 2000);
		assert.equal(ownerView.financials.grandTotalTl, 12000);
		assert.equal(ownerView.financials.supplierNetShareTl, 10560); // 88% of 12,000 TL
		assert.equal(ownerView.financials.escrowPoolFeeTl, 1440); // 12% of 12,000 TL

		// Competing mechanic (#55) cannot see sealed price breakdown
		const competitorView = createSealedProformaBidPayload({
			tenderId: "TND-901",
			tenderCategory: "AUTO_REPAIR_PARTS",
			supplierHandle: "maslak_bimmer_servis",
			supplierCompanyTitle: "Maslak Bimmer Özel Servis Ltd.",
			partsDescription: "Orijinal OEM Triger Seti + Devirdaim",
			partsAmountTl: 6500,
			laborAmountTl: 3500,
			viewerUserId: 55,
			tenderOwnerUserId: 10,
			supplierUserId: 99,
		});
		assert.equal(competitorView.financials.grandTotalTl, undefined);
		assert.equal(
			competitorView.financials.maskedNoticeTr.includes(
				"Gizli Proforma Fiyatı",
			),
			true,
		);
	});

	it("auto-imports commercial profiles, ads, prices, and hours from Sahibinden, Instagram, TikTok, and Google Maps", () => {
		assert.equal(Object.keys(EXTERNAL_COMMERCE_CONNECTORS).length, 10);

		// Detect Sahibinden & Arabam.com store URLs and reject untrusted SSRF URLs
		const sahibindenConn = detectExternalPlatformConnector(
			"https://www.sahibinden.com/maslak-bimmer-oto-servis",
		);
		assert.equal(sahibindenConn?.connector.code, "SAHIBINDEN_STORE");
		const arabamConn = detectExternalPlatformConnector(
			"https://www.arabam.com/galeri/maslak-ekspertiz",
		);
		assert.equal(arabamConn?.connector.code, "ARABAM_OTO_SANAYI");
		assert.equal(
			detectExternalPlatformConnector(
				"http://169.254.169.254/latest/meta-data",
			),
			null,
		);

		// Parse and import full Sahibinden store into Ustanomi Showcase & Price Menu
		const imported = parseAndImportExternalCommerceProfile({
			sourceUrl: "https://www.sahibinden.com/maslak-bimmer-oto-servis",
			rawTitle: "Maslak Bimmer Oto Tamir & Yedek Parça",
			rawItems: [
				{ title: "BMW F30 Orijinal Triger Seti + Montaj", priceTl: 18500 },
				{ title: "ZF 8HP Şanzıman Yağ & Filtre Bakımı", priceTl: 9200 },
			],
		});
		assert.equal(imported.connectorCode, "SAHIBINDEN_STORE");
		assert.equal(imported.clusterCode, "AUTO_LOGISTICS");
		assert.equal(imported.importedItemsCount, 2);
		assert.equal(imported.showcaseProfile.priceMenu.length, 2);
		assert.equal(imported.showcaseProfile.priceMenu[0].effectivePriceTl, 18500);

		// Generate bi-directional Escrow deep-link for Sahibinden ads & Instagram bio
		const links = buildOmnichannelEngagementLinks({
			proHandle: "maslak_bimmer_oto",
			title: "BMW F30 Triger Seti + İşçilik",
			priceTl: 18500,
		});
		assert.equal(links.escrowDirectCheckoutUrl.includes("escrow=1"), true);
		assert.equal(
			links.sahibindenAdEmbedSnippetTr.includes("USTANOMI GÜVENLİ HAVUZ"),
			true,
		);
	});

	it("enforces 12-dimension advanced filters, Cargo Waybill Escrow guard, GİB e-Fatura QR, and Chat Anti-Leak shield", () => {
		assert.equal(FULL_MARKETPLACE_FILTER_SCHEMA.sortOptions.length, 6);

		const listings = [
			{
				id: "item_oem",
				title: "Orijinal OEM DSG Kavrama",
				priceTl: 14000,
				distanceKm: 4,
				warrantyMonths: 24,
				partOriginType: "ORIGINAL_OEM",
				efaturaSupported: true,
				installmentSupported: true,
				availabilityMode: "ON_DUTY_24_7",
				isProOpen: true,
				isKycVerified: true,
				rating: 4.9,
			},
			{
				id: "item_equiv",
				title: "Muadil Fren Balatası",
				priceTl: 2200,
				distanceKm: 35,
				warrantyMonths: 6,
				partOriginType: "CERTIFIED_EQUIVALENT",
				efaturaSupported: false,
				installmentSupported: false,
				availabilityMode: "OPEN",
				isProOpen: true,
				isKycVerified: true,
				rating: 4.6,
			},
		];

		const filtered12D = filterAndSearchMarketplace(listings, {
			maxDistanceKm: 10,
			minWarrantyMonths: 12,
			partOriginFilter: "ORIGINAL_OEM",
			onlyEfatura: true,
			onlyInstallment: true,
			onlyOnDuty247: true,
			minPriceTl: 5000,
			maxPriceTl: 20000,
		});
		assert.equal(filtered12D.length, 1);
		assert.equal(filtered12D[0].id, "item_oem");

		// Cargo Waybill & Delivery Escrow Guard
		const unshipped = verifyWaybillAndEscrowRelease({
			carrierCode: "YURTICI",
			trackingNumber: "",
			buyerDeliveryConfirmed: false,
			hasSignatureOrOtp: false,
		});
		assert.equal(unshipped.canReleaseEscrow, false);

		const delivered = verifyWaybillAndEscrowRelease({
			carrierCode: "YURTICI",
			trackingNumber: "YK-99887766",
			desiWeight: 12,
			buyerDeliveryConfirmed: true,
			hasSignatureOrOtp: true,
		});
		assert.equal(delivered.canReleaseEscrow, true);

		// GİB UBL-TR 1.2 e-Fatura QR summary
		const efatura = generateGibEfaturaQrSummary({
			proformaRefCode: "PRF-2026-101",
			supplierVknOrTckn: "10000000146",
			buyerVknOrTckn: "10000000146",
			subtotalTl: 10000,
			kdvRatePercent: 20,
		});
		assert.equal(efatura.payableTotalTl, 12000);
		assert.equal(efatura.qrJsonPayload.includes("EARSIVFATURA"), true);

		// In-App Chat Anti-Leak Guard before Escrow lock
		const leakAttempt = sanitizeInAppChatMessage(
			"Havuz dışından bana 0532 111 22 33 numarasından ulaş, IBAN TR33 0006 1005 1978 6457 8413 26",
			false,
		);
		assert.equal(leakAttempt.blockedLeakAttempt, true);
		assert.equal(leakAttempt.cleanMessage.includes("0532 111 22 33"), false);
	});

	it("builds Instagram DM Proforma Escrow cards, Fullscreen Story Radar decks, and Pro Wallet payout summaries", () => {
		const dmCard = createDmProformaMessageCard({
			senderHandle: "maslak_bimmer_servis",
			recipientHandle: "musteri_1",
			serviceOrPartTitle: "Orijinal OEM Triger Seti + İşçilik",
			partsAmountTl: 6500,
			laborAmountTl: 3500,
			warrantyMonths: 12,
			isAcceptedInEscrow: true,
		});
		assert.equal(dmCard.totalAmountTl, 10000);
		assert.equal(dmCard.proNetShareTl, 8800);
		assert.equal(dmCard.isEscrowLocked, true);
		assert.equal(dmCard.contactUnlocked, true);

		const deck = buildFullScreenStoryDeck([
			{
				name: "Selim Usta",
				emoji: "🔧",
				open: true,
				priceTl: 850,
				distanceKm: 1.4,
				etaMinutes: 15,
			},
		]);
		assert.equal(deck.length, 1);
		assert.equal(deck[0].radarDistanceLabelTr.includes("1.4 km"), true);

		const wallet = calculateProWalletDashboard([
			{
				id: "j1",
				title: "Triger Seti",
				amountTl: 10000,
				state: "IN_ESCROW_POOL",
				waybillCode: "YK-112233",
			},
			{
				id: "j2",
				title: "Kombi Bakımı",
				amountTl: 5000,
				state: "RELEASED_TO_IBAN",
			},
		]);
		assert.equal(wallet.heldInPoolNetTl, 8800); // 88% of 10,000
		assert.equal(wallet.releasedToIbanNetTl, 4400); // 88% of 5,000
		assert.equal(wallet.activeWaybillsCount, 1);
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
