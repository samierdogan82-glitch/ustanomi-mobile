/**
 * Ustanomi Native Capacitor 6 Bridge, AI Studio Lead/Offer Workflow, Universal Professions,
 * Instagram/TikTok Pro Showcase, Urgent Job Feed, Open/Closed Availability & 88/12 Split-Payment Engine
 * License: MIT (_mit-kit aligned)
 */

const ALLOWED_NAVIGATION_HOSTS = new Set([
	"ustanomi-web-production.up.railway.app",
	"ustanomi.com",
	"www.ustanomi.com",
	"www.paytr.com",
	"paytr.com",
	"sandbox-api.iyzipay.com",
	"api.iyzipay.com",
]);

const ESCROW_TRANSITIONS = Object.freeze({
	PENDING_PAYMENT: Object.freeze(["FUNDS_HELD_IN_POOL"]),
	FUNDS_HELD_IN_POOL: Object.freeze(["WORK_IN_PROGRESS", "REFUNDED"]),
	WORK_IN_PROGRESS: Object.freeze(["CUSTOMER_APPROVED_RELEASED", "DISPUTED"]),
	DISPUTED: Object.freeze(["CUSTOMER_APPROVED_RELEASED", "REFUNDED"]),
	CUSTOMER_APPROVED_RELEASED: Object.freeze([]),
	REFUNDED: Object.freeze([]),
});

/**
 * AI Studio LeadLifecycleState deterministic state machine:
 * Customer Request -> Pro Offer -> Single Offer Acceptance -> In Progress -> Completed
 */
export const LEAD_LIFECYCLE_TRANSITIONS = Object.freeze({
	DRAFT: Object.freeze(["OPEN_FOR_OFFERS", "CANCELLED"]),
	OPEN_FOR_OFFERS: Object.freeze(["OFFER_ACCEPTED", "CANCELLED", "EXPIRED"]),
	OFFER_ACCEPTED: Object.freeze(["IN_PROGRESS", "COMPLETED"]),
	IN_PROGRESS: Object.freeze(["COMPLETED"]),
	COMPLETED: Object.freeze([]),
	CANCELLED: Object.freeze([]),
	EXPIRED: Object.freeze([]),
});

/**
 * AI Studio OfferLifecycleState deterministic state machine
 */
export const OFFER_LIFECYCLE_TRANSITIONS = Object.freeze({
	PENDING: Object.freeze(["ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"]),
	ACCEPTED: Object.freeze(["COMPLETED"]),
	COMPLETED: Object.freeze([]),
	REJECTED: Object.freeze([]),
	WITHDRAWN: Object.freeze([]),
	EXPIRED: Object.freeze([]),
});

/**
 * Canonical 6 Ustanomi Service Categories from AI Studio (preserved for backward compatibility)
 */
export const OFFER_SERVICE_CATEGORIES = Object.freeze([
	Object.freeze({
		id: "plumbing",
		apiParam: "Plumbing",
		turkishTitle: "Su & Doğalgaz Tesisatı",
		chipLabel: "Su Tesisatı (Plumbing)",
		startingPriceLabel: "750 ₺'den başlayan",
		aliases: Object.freeze([
			"plumbing",
			"su & doğalgaz tesisatı",
			"su tesisatı",
			"tesisat",
			"sıhhi tesisat",
		]),
	}),
	Object.freeze({
		id: "electrical",
		apiParam: "Electrical",
		turkishTitle: "Elektrik & Akıllı Ev",
		chipLabel: "Elektrik (Electrical)",
		startingPriceLabel: "650 ₺'den başlayan",
		aliases: Object.freeze([
			"electrical",
			"elektrik & akıllı ev",
			"elektrik",
			"aydınlatma",
			"akıllı ev",
		]),
	}),
	Object.freeze({
		id: "cleaning",
		apiParam: "Cleaning",
		turkishTitle: "Ev & Ofis Temizliği",
		chipLabel: "Temizlik (Cleaning)",
		startingPriceLabel: "1.200 ₺'den başlayan",
		aliases: Object.freeze([
			"cleaning",
			"ev & ofis temizliği",
			"temizlik",
			"hijyen",
			"detaylı temizlik",
		]),
	}),
	Object.freeze({
		id: "renovation",
		apiParam: "Renovation",
		turkishTitle: "Tadilat & Boya",
		chipLabel: "Tadilat & Boya",
		startingPriceLabel: "2.500 ₺'den başlayan",
		aliases: Object.freeze([
			"renovation",
			"tadilat & boya",
			"tadilat",
			"boya",
			"alçıpan",
		]),
	}),
	Object.freeze({
		id: "woodwork",
		apiParam: "Woodwork",
		turkishTitle: "Ahşap & Özel Mobilya",
		chipLabel: "Ahşap & Özel Mobilya",
		startingPriceLabel: "1.800 ₺'den başlayan",
		aliases: Object.freeze([
			"woodwork",
			"ahşap & özel mobilya",
			"ahşap",
			"mobilya",
			"marangoz",
		]),
	}),
	Object.freeze({
		id: "hvac",
		apiParam: "HVAC",
		turkishTitle: "İklimlendirme & Kombi",
		chipLabel: "İklimlendirme & Kombi",
		startingPriceLabel: "900 ₺'den başlayan",
		aliases: Object.freeze([
			"hvac",
			"iklimlendirme & kombi",
			"klima",
			"kombi",
			"ısıtma",
		]),
	}),
]);

/**
 * 8 Universal Profession Clusters ("Her İşin Bir Ustası Vardır" — Usta + Ekonomi = Ustanomi)
 */
export const UNIVERSAL_PROFESSION_CLUSTERS = Object.freeze([
	Object.freeze({
		id: "home_technical",
		code: "HOME_TECH",
		titleTr: "Ev, Tadilat & Teknik Servis",
		iconEmoji: "🏠",
		startingPriceTl: 650,
		professions: Object.freeze([
			"Su & Doğalgaz Tesisatçısı",
			"Elektrik & Akıllı Ev Ustası",
			"Kombi & Klima Servisi",
			"Boya, Alçıpan & Dekorasyon",
			"Marangoz & Mobilya Montaj",
			"7/24 Nöbetçi Çilingir",
		]),
	}),
	Object.freeze({
		id: "auto_transport",
		code: "AUTO_LOGISTICS",
		titleTr: "Oto, Yol Yardım & Nakliye",
		iconEmoji: "🚗",
		startingPriceTl: 900,
		professions: Object.freeze([
			"7/24 Oto Çekici & Kurtarma",
			"Mobil Lastik & Akü Takviye",
			"Oto Elektrik & Mekanik Ustası",
			"Evden Eve & Parça Eşya Nakliyat",
			"Yerinde Oto Yıkama & Detailing",
		]),
	}),
	Object.freeze({
		id: "digital_tech",
		code: "DIGITAL_TECH",
		titleTr: "Dijital, Teknoloji & Kamera",
		iconEmoji: "💻",
		startingPriceTl: 750,
		professions: Object.freeze([
			"Telefon & Bilgisayar Tamiri",
			"Güvenlik Kamerası & Alarm Kurulumu",
			"Web, Yazılım & Sosyal Medya Uzmanı",
			"Grafik Tasarım & Video Kurgu",
		]),
	}),
	Object.freeze({
		id: "events_media",
		code: "EVENTS_MEDIA",
		titleTr: "Etkinlik, Fotoğraf & Organizasyon",
		iconEmoji: "📸",
		startingPriceTl: 1500,
		professions: Object.freeze([
			"Düğün, Nişan & Ürün Fotoğrafçısı",
			"Drone & Reels Video Çekimi",
			"Organizasyon, Süsleme & Catering",
			"DJ & Canlı Müzik Ekibi",
		]),
	}),
	Object.freeze({
		id: "beauty_wellness",
		code: "BEAUTY_CARE",
		titleTr: "Kişisel Bakım & Güzellik",
		iconEmoji: "✂️",
		startingPriceTl: 600,
		professions: Object.freeze([
			"VIP Evde Kuaför & Berber",
			"Gelin Başı & Profesyonel Makyaj",
			"Fizyoterapi & Medikal Masaj Uzmanı",
			"Diyetisyen & Yaşam Koçu",
		]),
	}),
	Object.freeze({
		id: "education_coaching",
		code: "EDUCATION_PRO",
		titleTr: "Eğitim, Özel Ders & Koçluk",
		iconEmoji: "📚",
		startingPriceTl: 550,
		professions: Object.freeze([
			"Özel Direksiyon Ustası",
			"Matematik, YKS/LGS & İngilizce Özel Ders",
			"Birebir Fitness & Yüzme Eğitmeni",
			"Piyano, Gitar & Müzik Eğitmeni",
		]),
	}),
	Object.freeze({
		id: "cleaning_garden",
		code: "CLEANING_GARDEN",
		titleTr: "Temizlik, Koltuk Yıkama & Bahçe",
		iconEmoji: "🧹",
		startingPriceTl: 1100,
		professions: Object.freeze([
			"Ev, Ofis & İnşaat Sonrası Temizlik",
			"Yerinde Buharlı Koltuk & Yatak Yıkama",
			"Haşere İlaçlama & Dezenfeksiyon",
			"Bahçıvan & Peyzaj Bakımı",
		]),
	}),
	Object.freeze({
		id: "b2b_industrial",
		code: "B2B_INDUSTRIAL",
		titleTr: "B2B Sanayi, Kaynak & Yapı Malzemesi",
		iconEmoji: "🏭",
		startingPriceTl: 2200,
		professions: Object.freeze([
			"Argon / Demir Kaynak & Ferforje Ustası",
			"Endüstriyel Mutfak & Kazan Servisi",
			"Toptan Yapı Malzemesi & Proforma",
			"İş Güvenliği & Elektrik Pano Bakımı",
		]),
	}),
]);

/**
 * Urgency Tiers for "Acil İşler" Live Feed
 */
export const URGENCY_TIERS = Object.freeze({
	EMERGENCY_30M: Object.freeze({
		code: "EMERGENCY_30M",
		badgeTr: "🔴 ACİL • 30-60 DK",
		slaMinutes: 45,
		surgeMultiplier: 1.25,
	}),
	TODAY: Object.freeze({
		code: "TODAY",
		badgeTr: "🟡 BUGÜN İÇİNDE",
		slaMinutes: 240,
		surgeMultiplier: 1.0,
	}),
	SCHEDULED: Object.freeze({
		code: "SCHEDULED",
		badgeTr: "🟢 PLANLI / RANDEVULU",
		slaMinutes: 1440,
		surgeMultiplier: 1.0,
	}),
});

/**
 * Pro Availability & Working Hours Modes (Open / Closed / 24-7 On-Duty)
 */
export const PRO_AVAILABILITY_MODES = Object.freeze({
	OPEN: "OPEN",
	CLOSED: "CLOSED",
	ON_DUTY_24_7: "ON_DUTY_24_7",
});

/**
 * Supported BDDK-licensed sub-merchant escrow payment providers from AI Studio (88% Master / 12% Commission)
 */
export const ESCROW_PAYMENT_PROVIDERS = Object.freeze({
	IYZICO_SUB_MERCHANT: Object.freeze({
		id: "iyzico_escrow",
		displayName: "iyzico Sub-Merchant Escrow",
		badgeLabelTr:
			"iyzico Sub-Merchant Emanet Ödeme Güvencesi (%88 Usta / %12 Komisyon)",
		subMerchantFormat: "IYZ-SM",
		masterShareRatioBps: 8800,
		commissionRatioBps: 1200,
	}),
	PAYTR_SUB_MERCHANT: Object.freeze({
		id: "paytr_escrow",
		displayName: "PayTR Pazaryeri Emanet Ödeme",
		badgeLabelTr:
			"PayTR Sub-Merchant Emanet Ödeme Güvencesi (%88 Usta / %12 Komisyon)",
		subMerchantFormat: "PTR-SM",
		masterShareRatioBps: 8800,
		commissionRatioBps: 1200,
	}),
});

const OFFLINE_QUEUE_KEY = "ustanomi_offline_field_queue_v1";
const MAX_QUEUE_ITEMS = 50;

/**
 * Resolves a raw Turkish or English category filter into a canonical Ustanomi service category.
 * @param {string} rawFilter
 */
export function resolveOfferServiceCategory(rawFilter) {
	if (typeof rawFilter !== "string" || !rawFilter.trim()) {
		return null;
	}
	const normalized = rawFilter.trim().toLocaleLowerCase("tr-TR");
	for (const cat of OFFER_SERVICE_CATEGORIES) {
		if (
			cat.id.toLocaleLowerCase("tr-TR") === normalized ||
			cat.apiParam.toLocaleLowerCase("tr-TR") === normalized ||
			cat.turkishTitle.toLocaleLowerCase("tr-TR") === normalized ||
			cat.chipLabel.toLocaleLowerCase("tr-TR") === normalized ||
			cat.aliases.some(
				(alias) =>
					normalized === alias ||
					normalized.includes(alias) ||
					alias.includes(normalized),
			)
		) {
			return cat;
		}
	}
	return null;
}

/**
 * Resolves any profession query (e.g. "çilingir", "oto çekici", "fotoğrafçı", "kuaför", "özel ders")
 * into one of the 8 Universal Profession Clusters.
 * @param {string} query
 */
export function resolveUniversalProfessionCluster(query) {
	if (typeof query !== "string" || !query.trim()) {
		return UNIVERSAL_PROFESSION_CLUSTERS[0];
	}
	const q = query.trim().toLocaleLowerCase("tr-TR");
	const tokens = q.split(/[\s,&/•-]+/).filter((t) => t.length >= 3);
	let bestCluster = UNIVERSAL_PROFESSION_CLUSTERS[0];
	let bestScore = 0;

	for (const cluster of UNIVERSAL_PROFESSION_CLUSTERS) {
		const haystack =
			`${cluster.titleTr} ${cluster.professions.join(" ")}`.toLocaleLowerCase(
				"tr-TR",
			);
		if (
			cluster.id.toLocaleLowerCase("tr-TR") === q ||
			cluster.code.toLocaleLowerCase("tr-TR") === q ||
			haystack.includes(q)
		) {
			return cluster;
		}
		let score = 0;
		for (const tok of tokens) {
			if (haystack.includes(tok)) {
				score += 1;
			}
		}
		if (score > bestScore) {
			bestScore = score;
			bestCluster = cluster;
		}
	}
	return bestCluster;
}

/**
 * Evaluates a professional's real-time Open / Closed / 24-7 On-Duty status, story ring color,
 * and pricing multiplier based on working hours (`openHour`..`closeHour`) and manual switch.
 * @param {{
 *   manualMode?: "OPEN" | "CLOSED" | "ON_DUTY_24_7" | "AUTO",
 *   openHour?: number,
 *   closeHour?: number,
 *   currentHour?: number
 * }} config
 */
export function evaluateProAvailability(config = {}) {
	const {
		manualMode = "AUTO",
		openHour = 8,
		closeHour = 20,
		currentHour = 14,
	} = config;

	if (manualMode === "ON_DUTY_24_7") {
		return {
			status: PRO_AVAILABILITY_MODES.ON_DUTY_24_7,
			isAcceptingUrgentJobs: true,
			badgeTextTr: "⚡ 7/24 Nöbetçi Açık",
			storyRingColor: "#F59E0B",
			rateMultiplier: 1.25,
			scheduleSummaryTr: `7/24 Acil Nöbetçi (${String(openHour).padStart(2, "0")}:00-${String(closeHour).padStart(2, "0")}:00 Normal Mesai)`,
		};
	}

	if (manualMode === "CLOSED") {
		return {
			status: PRO_AVAILABILITY_MODES.CLOSED,
			isAcceptingUrgentJobs: false,
			badgeTextTr: `🔴 Kapalı • ${String(openHour).padStart(2, "0")}:00'da Açılır`,
			storyRingColor: "#94A3B8",
			rateMultiplier: 1.0,
			scheduleSummaryTr: `Mesai Dışı (${String(openHour).padStart(2, "0")}:00 - ${String(closeHour).padStart(2, "0")}:00)`,
		};
	}

	const withinHours =
		manualMode === "OPEN" ||
		(currentHour >= openHour && currentHour < closeHour);

	if (withinHours) {
		return {
			status: PRO_AVAILABILITY_MODES.OPEN,
			isAcceptingUrgentJobs: true,
			badgeTextTr: `🟢 Şu An Açık (${String(closeHour).padStart(2, "0")}:00'a kadar)`,
			storyRingColor: "#10B981",
			rateMultiplier: 1.0,
			scheduleSummaryTr: `Bugün Açık: ${String(openHour).padStart(2, "0")}:00 - ${String(closeHour).padStart(2, "0")}:00`,
		};
	}

	return {
		status: PRO_AVAILABILITY_MODES.CLOSED,
		isAcceptingUrgentJobs: false,
		badgeTextTr: `🔴 Kapalı • Yarın ${String(openHour).padStart(2, "0")}:00'da Açılır`,
		storyRingColor: "#94A3B8",
		rateMultiplier: 1.0,
		scheduleSummaryTr: `Çalışma Saatleri: ${String(openHour).padStart(2, "0")}:00 - ${String(closeHour).padStart(2, "0")}:00`,
	};
}

/**
 * Formats and validates an Instagram & TikTok style Pro Profile Showcase:
 * - Bio, Verified Badges, Live Availability Story Ring
 * - Transparent Price Menu (`FIXED` / `STARTING_FROM` / `HOURLY`)
 * - 3-Column Portfolio Grid & Vertical Reels/TikTok Short Video items
 * @param {{
 *   handle: string,
 *   displayName: string,
 *   professionTitle: string,
 *   clusterId?: string,
 *   city?: string,
 *   district?: string,
 *   rating?: number,
 *   completedJobsCount?: number,
 *   followersCount?: number,
 *   responseTimeMinutes?: number,
 *   availabilityConfig?: Record<string, unknown>,
 *   priceMenu?: Array<{title: string, priceTl: number, pricingType?: "FIXED" | "STARTING_FROM" | "HOURLY", durationLabel?: string}>,
 *   storyHighlights?: Array<{id: string, title: string, coverEmoji: string}>,
 *   mediaGrid?: Array<{id: string, mediaType: "REEL_VIDEO" | "BEFORE_AFTER_PHOTO", caption: string, likesCount?: number, priceTagTl?: number}>
 * }} profileInput
 */
export function formatInstagramProShowcase(profileInput) {
	if (
		!profileInput ||
		typeof profileInput.displayName !== "string" ||
		!profileInput.displayName.trim()
	) {
		throw new Error("PRO_DISPLAY_NAME_REQUIRED");
	}
	const availability = evaluateProAvailability(
		profileInput.availabilityConfig || {},
	);
	const cluster = resolveUniversalProfessionCluster(
		profileInput.clusterId || profileInput.professionTitle || "",
	);
	const rawHandle = (profileInput.handle || profileInput.displayName)
		.toLocaleLowerCase("tr-TR")
		.replace(/[^a-z0-9_]/g, "");

	const formattedPrices = (
		Array.isArray(profileInput.priceMenu) ? profileInput.priceMenu : []
	).map((item) => {
		const basePrice = Math.max(0, Number(item.priceTl) || 0);
		const effectivePrice = Math.round(basePrice * availability.rateMultiplier);
		const typeLabel =
			item.pricingType === "FIXED"
				? "Sabit Net Fiyat"
				: item.pricingType === "HOURLY"
					? "Saatlik Ücret"
					: "Başlangıç Fiyatı";
		return {
			title: String(item.title || "Standart Hizmet").trim(),
			basePriceTl: basePrice,
			effectivePriceTl: effectivePrice,
			pricingType: item.pricingType || "STARTING_FROM",
			pricingBadgeTr: `${effectivePrice} ₺ (${typeLabel})`,
			durationLabel: item.durationLabel || "Ortalama 60 dk",
		};
	});

	return {
		handle: `@${rawHandle || "ustanomi_pro"}`,
		displayName: profileInput.displayName.trim(),
		professionTitle: profileInput.professionTitle || cluster.titleTr,
		clusterCode: cluster.code,
		clusterEmoji: cluster.iconEmoji,
		locationLabel: `${profileInput.city || "İstanbul"} / ${profileInput.district || "Kadıköy"}`,
		metrics: {
			rating: Number(profileInput.rating || 4.9),
			completedJobsCount: Number(profileInput.completedJobsCount || 120),
			followersCount: Number(profileInput.followersCount || 1450),
			responseTimeLabel: `${Number(profileInput.responseTimeMinutes || 4)} dk yanıt`,
		},
		availability,
		priceMenu: formattedPrices,
		storyHighlights: Array.isArray(profileInput.storyHighlights)
			? profileInput.storyHighlights
			: [
					{ id: "hl_1", title: "Öncesi/Sonrası", coverEmoji: "✨" },
					{ id: "hl_2", title: "Fiyat Listem", coverEmoji: "🏷️" },
					{ id: "hl_3", title: "Belgelerim", coverEmoji: "🏅" },
					{ id: "hl_4", title: "Müşteri Yorumu", coverEmoji: "⭐" },
				],
		mediaGrid: Array.isArray(profileInput.mediaGrid)
			? profileInput.mediaGrid
			: [],
	};
}

/**
 * Validates and builds an "Acil İşler" (Urgent Job Feed) post where customers share an urgent need
 * and nearby open pros submit instant price + ETA offers.
 * @param {{
 *   title: string,
 *   description: string,
 *   professionQuery: string,
 *   urgencyCode?: "EMERGENCY_30M" | "TODAY" | "SCHEDULED",
 *   city?: string,
 *   district?: string,
 *   customerBudgetTl?: number
 * }} postInput
 */
export function createUrgentJobPostPayload(postInput) {
	if (
		!postInput ||
		typeof postInput.title !== "string" ||
		postInput.title.trim().length < 4
	) {
		throw new Error("URGENT_POST_TITLE_TOO_SHORT");
	}
	const tier =
		URGENCY_TIERS[postInput.urgencyCode] || URGENCY_TIERS.EMERGENCY_30M;
	const cluster = resolveUniversalProfessionCluster(
		postInput.professionQuery || postInput.title,
	);
	const budgetTl = Math.max(
		0,
		Number(postInput.customerBudgetTl) || cluster.startingPriceTl,
	);

	return {
		urgentPostCode: `ACIL-${Date.now().toString(36).toUpperCase()}`,
		title: redactKvkkSensitiveText(postInput.title.trim()),
		description: redactKvkkSensitiveText(
			String(postInput.description || "").trim(),
		),
		clusterCode: cluster.code,
		clusterTitleTr: cluster.titleTr,
		clusterEmoji: cluster.iconEmoji,
		urgencyCode: tier.code,
		urgencyBadgeTr: tier.badgeTr,
		slaMinutes: tier.slaMinutes,
		city: (postInput.city || "İstanbul").trim(),
		district: (postInput.district || "Kadıköy").trim(),
		estimatedBudgetTl: budgetTl,
		onlyNotifyOpenPros: tier.code === "EMERGENCY_30M",
		createdAt: new Date().toISOString(),
	};
}

/**
 * Calculates a deterministic Talent Trending Score so the most liked and most requested
 * skill posts automatically rise to the top of the discovery feed.
 * @param {{
 *   likesCount?: number,
 *   workRequestsCount?: number,
 *   isProOpen?: boolean,
 *   rating?: number
 * }} post
 */
export function calculateTalentTrendingScore(post = {}) {
	const likes = Math.max(0, Number(post.likesCount) || 0);
	const hires = Math.max(0, Number(post.workRequestsCount) || 0);
	const ratingBonus = Math.max(0, Number(post.rating) || 4.8) * 20;
	const openBonus = post.isProOpen !== false ? 50 : 0;
	return Math.round(likes * 2 + hires * 18 + ratingBonus + openBonus);
}

/**
 * Ranks an array of talent showcase posts by their trending score (descending)
 * and attaches `trendingRank` and `isFeaturedTopTalent` badges.
 * @param {Array<Record<string, unknown>>} posts
 */
export function rankTalentShowcasePosts(posts) {
	if (!Array.isArray(posts)) {
		return [];
	}
	const scored = posts.map((post) => {
		const trendingScore = calculateTalentTrendingScore(post);
		return {
			...post,
			trendingScore,
		};
	});
	scored.sort((a, b) => b.trendingScore - a.trendingScore);
	return scored.map((item, idx) => ({
		...item,
		trendingRank: idx + 1,
		isFeaturedTopTalent: idx === 0 || item.trendingScore >= 1000,
		trendingBadgeTr:
			idx === 0
				? "🔥 TREND #1 • EN ÇOK BEĞENİLEN YETENEK"
				: idx < 3
					? `⚡ ÖNE ÇIKAN YETENEK #${idx + 1}`
					: "✨ Doğrulanmış Yetenek",
	}));
}

/**
 * Builds a validated "Seninle Çalışmak İstiyorum" (Direct Work-With-You Hire Request) payload
 * from a talent showcase post, calculating the 88% Pro / 12% Escrow split automatically.
 * @param {{
 *   talentPostId: string,
 *   proHandle: string,
 *   proDisplayName?: string,
 *   skillTitle: string,
 *   offeredBudgetTl: number,
 *   customerNote: string,
 *   preferredSchedule?: string
 * }} input
 */
export function createWorkWithYouRequestPayload(input) {
	if (
		!input ||
		typeof input.proHandle !== "string" ||
		!input.proHandle.trim()
	) {
		throw new Error("TARGET_PRO_HANDLE_REQUIRED");
	}
	if (
		typeof input.skillTitle !== "string" ||
		input.skillTitle.trim().length < 3
	) {
		throw new Error("SKILL_TITLE_REQUIRED");
	}
	const budgetNum = Number(input.offeredBudgetTl);
	if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
		throw new Error("VALID_WORK_BUDGET_REQUIRED");
	}
	const split = calculateSplitPaymentEscrow(budgetNum);
	const cleanHandle = input.proHandle.trim().startsWith("@")
		? input.proHandle.trim()
		: `@${input.proHandle.trim()}`;

	return {
		requestCode: `HIRE-${Date.now().toString(36).toUpperCase()}`,
		talentPostId: String(input.talentPostId || "TALENT-1"),
		proHandle: cleanHandle,
		proDisplayName: String(input.proDisplayName || cleanHandle).trim(),
		skillTitle: redactKvkkSensitiveText(input.skillTitle.trim()),
		customerNote: redactKvkkSensitiveText(
			String(input.customerNote || "").trim(),
		),
		preferredSchedule: String(
			input.preferredSchedule || "En Kısa Sürede (Müsaitlik Durumuna Göre)",
		),
		offeredBudgetTl: split.totalAmountTl,
		proNetShareTl: split.subMerchantShareTl,
		platformEscrowFeeTl: split.platformCommissionTl,
		status: "DIRECT_WORK_REQUEST_SENT",
		ctaLabelTr: "🤝 Seninle Çalışmak İstiyorum Talebi İletildi",
		createdAt: new Date().toISOString(),
	};
}

/**
 * Official 11-digit Turkish T.C. Kimlik No (TCKN) algorithmic checksum validator
 * ported from _mit-kit/finance/tr-money-math.ts.
 * @param {string} rawTckn
 * @returns {boolean}
 */
export function validateTurkishTckn(rawTckn) {
	if (typeof rawTckn !== "string") {
		return false;
	}
	const tckn = rawTckn.replace(/\s+/g, "");
	if (!/^[1-9]\d{10}$/.test(tckn)) {
		return false;
	}
	const d = tckn.split("").map(Number);
	const odd = d[0] + d[2] + d[4] + d[6] + d[8];
	const even = d[1] + d[3] + d[5] + d[7];
	const d10 = (((odd * 7 - even) % 10) + 10) % 10;
	const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
	return d[9] === d10 && d[10] === d11;
}

/**
 * Official 10-digit Turkish Tax ID (VKN) algorithmic modulo-10 checksum validator.
 * @param {string} rawVkn
 * @returns {boolean}
 */
export function validateTurkishVkn(rawVkn) {
	if (typeof rawVkn !== "string") {
		return false;
	}
	const vkn = rawVkn.replace(/\s+/g, "");
	if (!/^\d{10}$/.test(vkn)) {
		return false;
	}
	const digits = vkn.split("").map(Number);
	let sum = 0;
	for (let i = 0; i < 9; i++) {
		const tmp = (digits[i] + (9 - i)) % 10;
		if (tmp === 9) {
			sum += 9;
		} else {
			sum += (tmp * 2 ** (9 - i)) % 9;
		}
	}
	const checkDigit = (10 - (sum % 10)) % 10;
	return digits[9] === checkDigit;
}

/**
 * Validates a 26-character Turkish IBAN (TR + 24 digits) using ISO 7064 Mod 97-10.
 * @param {string} rawIban
 * @returns {boolean}
 */
export function validateTurkishIban(rawIban) {
	if (typeof rawIban !== "string") {
		return false;
	}
	const iban = rawIban.replace(/\s+/g, "").toUpperCase();
	if (!/^TR\d{24}$/.test(iban)) {
		return false;
	}
	const rearranged = `${iban.slice(4)}2927${iban.slice(2, 4)}`;
	let remainder = 0n;
	for (const ch of rearranged) {
		remainder = (remainder * 10n + BigInt(ch)) % 97n;
	}
	return remainder === 1n;
}

/**
 * Evaluates password strength for commercial accounts (0..4 score + Turkish feedback label).
 * @param {string} password
 */
export function evaluatePasswordStrength(password) {
	if (typeof password !== "string" || password.length === 0) {
		return { score: 0, isStrong: false, labelTr: "Şifre Girilmedi" };
	}
	let score = 0;
	if (password.length >= 8) score += 1;
	if (/[A-ZÇĞİÖŞÜ]/.test(password) && /[a-zçğıöşü]/.test(password)) score += 1;
	if (/\d/.test(password)) score += 1;
	if (/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]/.test(password) || password.length >= 12)
		score += 1;

	const labels = [
		"Çok Zayıf (En az 8 karakter)",
		"Zayıf (Harf ve rakam ekleyin)",
		"Orta (Büyük harf veya sembol ekleyin)",
		"Güçlü Ticari Şifre ✓",
		"Çok Güçlü (Kriptografik Koruma) ✓",
	];
	return {
		score,
		isStrong: score >= 3 && password.length >= 8,
		labelTr: labels[score] || labels[0],
	};
}

/**
 * Validates commercial KYC registration payload requiring verified TCKN (or VKN),
 * strong password, KVKK consent, and Sub-Merchant Escrow agreement.
 * @param {{
 *   fullName: string,
 *   phone: string,
 *   email?: string,
 *   password: string,
 *   accountRole?: "CUSTOMER" | "MASTER",
 *   tckn: string,
 *   iban?: string,
 *   kvkkAccepted?: boolean,
 *   escrowContractAccepted?: boolean
 * }} payload
 */
export function validateKycRegistrationPayload(payload) {
	if (
		!payload ||
		typeof payload.fullName !== "string" ||
		payload.fullName.trim().length < 4
	) {
		return {
			valid: false,
			errorCode: "FULL_NAME_REQUIRED",
			messageTr: "Kimlikteki tam ad ve soyadınızı giriniz.",
		};
	}
	if (!validateTurkishTckn(payload.tckn)) {
		return {
			valid: false,
			errorCode: "INVALID_TCKN_CHECKSUM",
			messageTr:
				"Geçersiz T.C. Kimlik Numarası (11 hane resmi algoritma doğrulaması başarısız).",
		};
	}
	const pwdCheck = evaluatePasswordStrength(payload.password);
	if (!pwdCheck.isStrong) {
		return {
			valid: false,
			errorCode: "WEAK_PASSWORD",
			messageTr:
				"Ticari hesap güvenliği için en az 8 karakterli, büyük/küçük harf ve rakam içeren şifre belirleyiniz.",
		};
	}
	const role = payload.accountRole === "MASTER" ? "MASTER" : "CUSTOMER";
	if (role === "MASTER" && payload.iban && !validateTurkishIban(payload.iban)) {
		return {
			valid: false,
			errorCode: "INVALID_TR_IBAN",
			messageTr:
				"Hak ediş ödemeleri için geçerli bir 26 haneli TR IBAN giriniz.",
		};
	}
	if (!payload.kvkkAccepted || !payload.escrowContractAccepted) {
		return {
			valid: false,
			errorCode: "LEGAL_CONSENT_REQUIRED",
			messageTr:
				"Ticari işlem ve Güvenli Havuz koruması için KVKK ve Mesafeli Hizmet Sözleşmesini onaylayınız.",
		};
	}

	const cleanTckn = payload.tckn.replace(/\s+/g, "");
	return {
		valid: true,
		errorCode: null,
		normalizedRole: role,
		maskedTckn: `${cleanTckn.slice(0, 2)}*******${cleanTckn.slice(-2)}`,
		kycBadgeTr: "🪪 T.C. Kimlik (TCKN) & Ticari KYC Doğrulandı",
		messageTr: "Kimlik doğrulamalı ticari hesabınız başarıyla oluşturuldu.",
	};
}

/**
 * Global Multi-Locale & Multi-Currency Catalog (TR / EN / DE / Global hubs)
 */
export const GLOBAL_LOCALES = Object.freeze({
	TR: Object.freeze({
		code: "TR",
		locale: "tr-TR",
		currency: "TRY",
		symbol: "₺",
		fxRateFromTry: 1,
		flag: "🇹🇷",
		label: "TR • ₺ TRY",
		cities: Object.freeze([
			"İstanbul",
			"Ankara",
			"İzmir",
			"Bursa",
			"Antalya",
			"Konya",
		]),
	}),
	US: Object.freeze({
		code: "US",
		locale: "en-US",
		currency: "USD",
		symbol: "$",
		fxRateFromTry: 0.029,
		flag: "🌍",
		label: "EN • $ USD",
		cities: Object.freeze(["New York", "London", "Dubai", "Austin", "Toronto"]),
	}),
	EU: Object.freeze({
		code: "EU",
		locale: "de-DE",
		currency: "EUR",
		symbol: "€",
		fxRateFromTry: 0.027,
		flag: "🇪🇺",
		label: "EU • € EUR",
		cities: Object.freeze(["Berlin", "Amsterdam", "Munich", "Vienna", "Paris"]),
	}),
});

/**
 * Converts a TRY amount into the active global currency (TRY, USD, EUR) with exact 2-decimal precision.
 * @param {number} amountTl
 * @param {"TR" | "US" | "EU"} regionCode
 */
export function convertAndFormatGlobalPrice(amountTl, regionCode = "TR") {
	const region = GLOBAL_LOCALES[regionCode] || GLOBAL_LOCALES.TR;
	const base = Math.max(0, Number(amountTl) || 0);
	const converted = Math.round(base * region.fxRateFromTry * 100) / 100;
	return {
		regionCode: region.code,
		currency: region.currency,
		symbol: region.symbol,
		amount: converted,
		formatted:
			region.code === "TR"
				? `${Math.round(converted)} ₺`
				: `${region.symbol}${converted.toFixed(2)}`,
	};
}

/**
 * Armut / Thumbtack style Dynamic Scope & Smart Quote Estimator Wizard.
 * Calculates min/recommended/max price range and 88% Pro / 12% Escrow split based on:
 * - Profession cluster base rate
 * - Scope size multiplier (Small/1 Room = 1.0x, Medium/2-3 Rooms = 1.75x, Large/Commercial = 2.8x)
 * - Material inclusion (`includeMaterials`: +45%)
 * - Urgency (`EMERGENCY_30M`: +25%)
 * @param {{
 *   professionQuery?: string,
 *   scopeSize?: "SMALL" | "MEDIUM" | "LARGE",
 *   includeMaterials?: boolean,
 *   urgencyCode?: "EMERGENCY_30M" | "TODAY" | "SCHEDULED",
 *   regionCode?: "TR" | "US" | "EU"
 * }} params
 */
export function estimateArmutStyleSmartQuote(params = {}) {
	const cluster = resolveUniversalProfessionCluster(
		params.professionQuery || "",
	);
	const scopeMultipliers = { SMALL: 1.0, MEDIUM: 1.75, LARGE: 2.8 };
	const scopeMult = scopeMultipliers[params.scopeSize] || 1.0;
	const materialMult = params.includeMaterials ? 1.45 : 1.0;
	const urgencyMult = params.urgencyCode === "EMERGENCY_30M" ? 1.25 : 1.0;

	const recommendedTl = Math.round(
		cluster.startingPriceTl * scopeMult * materialMult * urgencyMult,
	);
	const minTl = Math.round(recommendedTl * 0.85);
	const maxTl = Math.round(recommendedTl * 1.2);
	const split = calculateSplitPaymentEscrow(recommendedTl);
	const regionCode = params.regionCode || "TR";

	return {
		clusterCode: cluster.code,
		clusterTitleTr: cluster.titleTr,
		minPriceTl: minTl,
		recommendedPriceTl: recommendedTl,
		maxPriceTl: maxTl,
		proNetShareTl: split.subMerchantShareTl,
		platformEscrowFeeTl: split.platformCommissionTl,
		formattedRange: `${convertAndFormatGlobalPrice(minTl, regionCode).formatted} – ${convertAndFormatGlobalPrice(maxTl, regionCode).formatted}`,
		formattedRecommended: convertAndFormatGlobalPrice(recommendedTl, regionCode)
			.formatted,
	};
}

/**
 * Multi-dimensional Search & Filter Engine inspired by Armut, Thumbtack, and TaskRabbit.
 * Supports keyword search (Turkish + English), profession cluster, city, max budget,
 * minimum rating, "Open Now / 24-7 On-Duty Only", "KYC Verified Only", and 4 sort modes.
 * @param {Array<Record<string, unknown>>} items
 * @param {{
 *   query?: string,
 *   clusterCode?: string,
 *   city?: string,
 *   onlyOpenNow?: boolean,
 *   onlyKycVerified?: boolean,
 *   maxPriceTl?: number,
 *   minRating?: number,
 *   sortBy?: "TRENDING" | "PRICE_ASC" | "RATING_DESC" | "FASTEST_ETA"
 * }} filters
 */
export function filterAndSearchMarketplace(items, filters = {}) {
	if (!Array.isArray(items)) {
		return [];
	}
	const q =
		typeof filters.query === "string"
			? filters.query.trim().toLocaleLowerCase("tr-TR")
			: "";
	const clusterCode =
		typeof filters.clusterCode === "string" && filters.clusterCode !== "ALL"
			? filters.clusterCode.trim()
			: "";
	const city =
		typeof filters.city === "string" && filters.city !== "ALL"
			? filters.city.trim().toLocaleLowerCase("tr-TR")
			: "";
	const maxPrice = Number(filters.maxPriceTl);
	const minPrice = Number(filters.minPriceTl);
	const minRating = Number(filters.minRating);
	const maxDistanceKm = Number(filters.maxDistanceKm);
	const minWarrantyMonths = Number(filters.minWarrantyMonths);
	const partOriginFilter =
		typeof filters.partOriginFilter === "string" &&
		filters.partOriginFilter !== "ALL"
			? filters.partOriginFilter.trim()
			: "";

	const matched = items.filter((item) => {
		if (clusterCode && item.clusterCode && item.clusterCode !== clusterCode) {
			return false;
		}
		if (
			city &&
			typeof item.city === "string" &&
			!item.city.toLocaleLowerCase("tr-TR").includes(city)
		) {
			return false;
		}
		if (filters.onlyOpenNow && item.isProOpen === false) {
			return false;
		}
		if (filters.onlyOnDuty247 && item.availabilityMode !== "ON_DUTY_24_7") {
			return false;
		}
		if (filters.onlyKycVerified && item.isKycVerified === false) {
			return false;
		}
		if (filters.onlyEfatura && item.efaturaSupported === false) {
			return false;
		}
		if (filters.onlyInstallment && item.installmentSupported === false) {
			return false;
		}
		if (
			partOriginFilter &&
			item.partOriginType &&
			item.partOriginType !== partOriginFilter
		) {
			return false;
		}
		const itemPrice = Number(item.priceTl ?? item.estimatedBudgetTl ?? 0);
		if (Number.isFinite(minPrice) && minPrice > 0 && itemPrice < minPrice) {
			return false;
		}
		if (Number.isFinite(maxPrice) && maxPrice > 0 && itemPrice > maxPrice) {
			return false;
		}
		const itemRating = Number(item.rating ?? 4.9);
		if (Number.isFinite(minRating) && minRating > 0 && itemRating < minRating) {
			return false;
		}
		const itemDistance = Number(item.distanceKm ?? 5);
		if (
			Number.isFinite(maxDistanceKm) &&
			maxDistanceKm > 0 &&
			itemDistance > maxDistanceKm
		) {
			return false;
		}
		const itemWarranty = Number(item.warrantyMonths ?? 12);
		if (
			Number.isFinite(minWarrantyMonths) &&
			minWarrantyMonths > 0 &&
			itemWarranty < minWarrantyMonths
		) {
			return false;
		}
		if (q) {
			const searchable = [
				item.title,
				item.description,
				item.handle,
				item.cluster,
				item.city,
				item.district,
				item.spec,
			]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase("tr-TR");
			const resolvedCluster = resolveUniversalProfessionCluster(q);
			const clusterMatch =
				item.clusterCode &&
				item.clusterCode === resolvedCluster.code &&
				q.length >= 3;
			if (!searchable.includes(q) && !clusterMatch) {
				return false;
			}
		}
		return true;
	});

	const sortBy = filters.sortBy || "TRENDING";
	matched.sort((a, b) => {
		if (sortBy === "PRICE_ASC") {
			return (
				Number(a.priceTl ?? a.estimatedBudgetTl ?? 0) -
				Number(b.priceTl ?? b.estimatedBudgetTl ?? 0)
			);
		}
		if (sortBy === "PRICE_DESC") {
			return (
				Number(b.priceTl ?? b.estimatedBudgetTl ?? 0) -
				Number(a.priceTl ?? a.estimatedBudgetTl ?? 0)
			);
		}
		if (sortBy === "RATING_DESC") {
			return Number(b.rating ?? 4.9) - Number(a.rating ?? 4.9);
		}
		if (sortBy === "FASTEST_ETA") {
			return Number(a.etaMinutes ?? 20) - Number(b.etaMinutes ?? 20);
		}
		if (sortBy === "DISTANCE_ASC") {
			return Number(a.distanceKm ?? 5) - Number(b.distanceKm ?? 5);
		}
		return calculateTalentTrendingScore(b) - calculateTalentTrendingScore(a);
	});

	return matched;
}

/**
 * B2B Industrial, Auto Repair, Spare Parts & Wholesale Procurement Tender Categories
 */
export const B2B_TENDER_CATEGORIES = Object.freeze({
	AUTO_REPAIR_PARTS: Object.freeze({
		code: "AUTO_REPAIR_PARTS",
		titleTr: "🚗 Oto Sanayi: Araç Tamiri & Yedek Parça İhalesi",
		partSpecLabelTr: "Şasi (VIN) / OEM Parça No & Marka",
		defaultWarrantyMonths: 12,
	}),
	INDUSTRIAL_MANUFACTURING: Object.freeze({
		code: "INDUSTRIAL_MANUFACTURING",
		titleTr: "🏭 Sanayi & İmalat: CNC, Kaynak, Kalıp & Makine Revizyon",
		partSpecLabelTr: "Teknik Resim / Malzeme & Tolerans Özelliği",
		defaultWarrantyMonths: 24,
	}),
	WHOLESALE_PROCUREMENT: Object.freeze({
		code: "WHOLESALE_PROCUREMENT",
		titleTr: "📦 Toptan Mal & Yapı/Elektrik Malzemesi Alım İhalesi",
		partSpecLabelTr: "Stok / SKU Kodu, Miktar & Teslim Süresi",
		defaultWarrantyMonths: 24,
	}),
});

/**
 * Creates a Sealed Private Proforma Invoice & Fixed-Price Escrow Contract Bid
 * (`quotation-proforma-pdf` + `iyzico-paytr-escrow` compliant).
 * - Prices are private (`isPrivateSealedBid: true`) — visible ONLY to the tender owner and the bidding supplier.
 * - Separates Parts/Material cost (`partsAmountTl`) and Labor/Service cost (`laborAmountTl`), computes kuruş-exact
 *   20% KDV, and locks the 88% Supplier / 12% Escrow Pool split under a legally binding proforma reference.
 * @param {{
 *   tenderId: string,
 *   tenderCategory?: "AUTO_REPAIR_PARTS" | "INDUSTRIAL_MANUFACTURING" | "WHOLESALE_PROCUREMENT",
 *   supplierHandle: string,
 *   supplierCompanyTitle: string,
 *   partsDescription: string,
 *   partOriginType?: "ORIGINAL_OEM" | "CERTIFIED_EQUIVALENT" | "CUSTOM_MANUFACTURED",
 *   partsAmountTl: number,
 *   laborAmountTl?: number,
 *   kdvRatePercent?: 1 | 10 | 20,
 *   warrantyMonths?: number,
 *   deliveryDays?: number,
 *   escrowProvider?: "IYZICO_ESCROW" | "PAYTR_ESCROW",
 *   viewerUserId?: number | null,
 *   tenderOwnerUserId?: number | null,
 *   supplierUserId?: number | null
 * }} input
 */
export function createSealedProformaBidPayload(input) {
	if (
		!input ||
		typeof input.supplierCompanyTitle !== "string" ||
		input.supplierCompanyTitle.trim().length < 3
	) {
		throw new Error("SUPPLIER_COMPANY_TITLE_REQUIRED");
	}
	if (
		typeof input.partsDescription !== "string" ||
		input.partsDescription.trim().length < 3
	) {
		throw new Error("PROFORMA_PARTS_DESCRIPTION_REQUIRED");
	}

	const partsKurus = Math.max(
		0,
		Math.round((Number(input.partsAmountTl) || 0) * 100),
	);
	const laborKurus = Math.max(
		0,
		Math.round((Number(input.laborAmountTl) || 0) * 100),
	);
	const subtotalKurus = partsKurus + laborKurus;
	if (subtotalKurus <= 0) {
		throw new Error("PROFORMA_TOTAL_MUST_BE_POSITIVE");
	}

	const kdvRate =
		input.kdvRatePercent === 1 || input.kdvRatePercent === 10
			? input.kdvRatePercent
			: 20;
	const kdvKurus = Math.round((subtotalKurus * kdvRate) / 100);
	const grandTotalKurus = subtotalKurus + kdvKurus;
	const grandTotalTl = grandTotalKurus / 100;

	const split = calculateSplitPaymentEscrow(grandTotalTl);
	const cat =
		B2B_TENDER_CATEGORIES[input.tenderCategory] ||
		B2B_TENDER_CATEGORIES.AUTO_REPAIR_PARTS;
	const warrantyMonths = Math.max(
		1,
		Number(input.warrantyMonths) || cat.defaultWarrantyMonths,
	);
	const deliveryDays = Math.max(1, Number(input.deliveryDays) || 2);
	const proformaRef = `PRF-2026-${Date.now().toString(36).toUpperCase()}`;
	const contractRef = `SZL-2026-${Date.now().toString(36).toUpperCase()}`;
	const validUntilIso = new Date(Date.now() + 7 * 24 * 3600 * 1000)
		.toISOString()
		.slice(0, 10);

	const originLabels = {
		ORIGINAL_OEM: "Orijinal Logolu OEM Parça / Malzeme",
		CERTIFIED_EQUIVALENT: "TSE / ISO Belgeli Garantili Muadil",
		CUSTOM_MANUFACTURED: "Sıfır Özel İmalat / Revizyon",
	};
	const partOriginLabelTr =
		originLabels[input.partOriginType] || originLabels.ORIGINAL_OEM;

	// Anti-IDOR Sealed Bid Privacy check: only tender owner or bidding supplier can see exact price breakdown
	const canViewerSeePrice =
		input.viewerUserId == null ||
		input.viewerUserId === input.tenderOwnerUserId ||
		input.viewerUserId === input.supplierUserId;

	return {
		proformaRefCode: proformaRef,
		contractRefCode: contractRef,
		tenderId: String(input.tenderId || "TND-1001"),
		tenderCategoryCode: cat.code,
		tenderCategoryTitleTr: cat.titleTr,
		isPrivateSealedBid: true,
		privacyBadgeTr:
			"🔒 Özel Kapalı Zarf Proforma (Yalnızca İş Sahibine Görünür)",
		supplierHandle: input.supplierHandle.startsWith("@")
			? input.supplierHandle
			: `@${input.supplierHandle}`,
		supplierCompanyTitle: redactKvkkSensitiveText(
			input.supplierCompanyTitle.trim(),
		),
		partsDescription: redactKvkkSensitiveText(input.partsDescription.trim()),
		partOriginType: input.partOriginType || "ORIGINAL_OEM",
		partOriginLabelTr,
		warrantyMonths,
		deliveryDays,
		validUntilDate: validUntilIso,
		escrowProvider: input.escrowProvider || "IYZICO_ESCROW",
		escrowTrustGuaranteeTr:
			"🛡️ BDDK Lisanslı Ödeme Kuruluşu (iyzico / PayTR Emanet Havuzu) Güvencesi: Ödemeniz iş/parça eksiksiz teslim edilip onaylanana kadar havuzda bloke edilir.",
		contractClauseTr: `Sabit Fiyat & Parça Garantisi Sözleşmesi (${contractRef}): ${input.supplierCompanyTitle.trim()}, belirtilen ${partOriginLabelTr} ve işçiliği toplam ${grandTotalTl.toFixed(2)} ₺ (KDV Dahil) sabit bedelle, ${deliveryDays} iş günü içinde teslim etmeyi ve ${warrantyMonths} ay garanti vermeyi taahhüt eder. Proforma harici sürpriz/ek ücret talep edilemez.`,
		financials: canViewerSeePrice
			? {
					partsAmountTl: partsKurus / 100,
					laborAmountTl: laborKurus / 100,
					subtotalNetTl: subtotalKurus / 100,
					kdvRatePercent: kdvRate,
					kdvAmountTl: kdvKurus / 100,
					grandTotalTl,
					supplierNetShareTl: split.subMerchantShareTl,
					escrowPoolFeeTl: split.platformCommissionTl,
				}
			: {
					maskedNoticeTr:
						"🔒 Gizli Proforma Fiyatı (Sadece İhale Sahibi Görebilir)",
				},
	};
}

/**
 * Supported Social Media & Commercial Marketplace Connectors for 1-Click Auto-Import & Sync
 */
export const EXTERNAL_COMMERCE_CONNECTORS = Object.freeze({
	SAHIBINDEN_STORE: Object.freeze({
		code: "SAHIBINDEN_STORE",
		nameTr: "Sahibinden.com Kurumsal Mağaza & İlanlar",
		badgeEmoji: "🟡",
		allowedHosts: Object.freeze(["sahibinden.com", "www.sahibinden.com"]),
		autoSyncFields: Object.freeze([
			"İlan Başlıkları & Yedek Parça/Hizmet Fiyatları",
			"Mağaza Konumu & Telefon Doğrulaması",
			"İlan Fotoğrafları & Teknik Özellikler (Şasi/OEM)",
		]),
	}),
	INSTAGRAM_BUSINESS: Object.freeze({
		code: "INSTAGRAM_BUSINESS",
		nameTr: "Instagram Business Profil, Reels & Hikâyeler",
		badgeEmoji: "📸",
		allowedHosts: Object.freeze(["instagram.com", "www.instagram.com"]),
		autoSyncFields: Object.freeze([
			"Biyografi & Uzmanlık Etiketleri",
			"Reels İş Videoları & 3'lü Vitrin Fotoğrafları",
			"Takipçi & Etkileşim Skoru",
		]),
	}),
	TIKTOK_CREATOR: Object.freeze({
		code: "TIKTOK_CREATOR",
		nameTr: "TikTok Yetenek & İş Videoları",
		badgeEmoji: "🎬",
		allowedHosts: Object.freeze([
			"tiktok.com",
			"www.tiktok.com",
			"vm.tiktok.com",
		]),
		autoSyncFields: Object.freeze([
			"60 Sn Dikey Yetenek Videoları",
			"Beğeni & İzlenme Trend Puanı",
		]),
	}),
	GOOGLE_BUSINESS_MAPS: Object.freeze({
		code: "GOOGLE_BUSINESS_MAPS",
		nameTr: "Google Haritalar İşletme, Saatler & Yorumlar",
		badgeEmoji: "📍",
		allowedHosts: Object.freeze([
			"google.com",
			"www.google.com",
			"maps.app.goo.gl",
			"g.page",
		]),
		autoSyncFields: Object.freeze([
			"Açık/Kapalı Çalışma Saatleri (08:00-20:00)",
			"Doğrulanmış Google Müşteri Puanı (4.9★) & Yorumlar",
			"Harita GPS Koordinatı & Açık Adres",
		]),
	}),
	WHATSAPP_CATALOG: Object.freeze({
		code: "WHATSAPP_CATALOG",
		nameTr: "WhatsApp Business Ürün & Hizmet Kataloğu",
		badgeEmoji: "💬",
		allowedHosts: Object.freeze([
			"wa.me",
			"api.whatsapp.com",
			"web.whatsapp.com",
		]),
		autoSyncFields: Object.freeze([
			"Hızlı Fiyat Kataloğu & Mesai Otomatik Yanıtı",
			"Tek Tıkla Güvenli Havuz Teklif Bağlantısı",
		]),
	}),
	TRENDYOL_HEPSIBURADA: Object.freeze({
		code: "TRENDYOL_HEPSIBURADA",
		nameTr: "Trendyol / Hepsiburada Yedek Parça & Yapı Mağazası",
		badgeEmoji: "🟠",
		allowedHosts: Object.freeze([
			"trendyol.com",
			"www.trendyol.com",
			"hepsiburada.com",
			"www.hepsiburada.com",
			"n11.com",
			"www.n11.com",
		]),
		autoSyncFields: Object.freeze([
			"Toptan/Perakende Parça Stok & Fiyat Listesi",
			"Satıcı Puanı & Kargo Süresi",
		]),
	}),
	ARABAM_OTO_SANAYI: Object.freeze({
		code: "ARABAM_OTO_SANAYI",
		nameTr: "Arabam.com & Oto Ekspertiz / Servis İlanları",
		badgeEmoji: "🚘",
		allowedHosts: Object.freeze(["arabam.com", "www.arabam.com"]),
		autoSyncFields: Object.freeze([
			"Oto Ekspertiz, Motor/Şanzıman Revizyon & Yedek Parça Paketleri",
			"Garantili Servis Noktası Doğrulaması",
		]),
	}),
	ARMUT_THUMBTACK: Object.freeze({
		code: "ARMUT_THUMBTACK",
		nameTr: "Armut.com / Thumbtack / TaskRabbit Hizmet Profili",
		badgeEmoji: "🟢",
		allowedHosts: Object.freeze([
			"armut.com",
			"www.armut.com",
			"thumbtack.com",
			"www.thumbtack.com",
			"taskrabbit.com",
			"www.taskrabbit.com",
		]),
		autoSyncFields: Object.freeze([
			"Tamamlanan İş Sayısı & Geçmiş Müşteri Yorumları",
			"Uzmanlık Kategorileri & Hizmet Bölgeleri",
		]),
	}),
	YOUTUBE_LINKEDIN: Object.freeze({
		code: "YOUTUBE_LINKEDIN",
		nameTr: "YouTube Shorts & LinkedIn Kurumsal Portföy",
		badgeEmoji: "▶️",
		allowedHosts: Object.freeze([
			"youtube.com",
			"www.youtube.com",
			"youtu.be",
			"linkedin.com",
			"www.linkedin.com",
		]),
		autoSyncFields: Object.freeze([
			"Uygulama/Tamir Shorts Videoları & Kurumsal Referanslar",
			"Mühendislik & Mesleki Sertifika Doğrulaması",
		]),
	}),
	FACEBOOK_TELEGRAM: Object.freeze({
		code: "FACEBOOK_TELEGRAM",
		nameTr: "Facebook Marketplace & Telegram Ticaret Kanalı",
		badgeEmoji: "📘",
		allowedHosts: Object.freeze([
			"facebook.com",
			"www.facebook.com",
			"t.me",
			"telegram.me",
		]),
		autoSyncFields: Object.freeze([
			"Bölgesel Esnaf/Sanayi Grubu İlanları & Hızlı Mesaj Kanalı",
		]),
	}),
});

/**
 * Full 12-Dimension Marketplace Filter Schema (Armut + Sahibinden + Global B2B Standard)
 */
export const FULL_MARKETPLACE_FILTER_SCHEMA = Object.freeze({
	distanceRadiusOptionsKm: Object.freeze([5, 15, 30, 50, 100, 500]),
	minRatingOptions: Object.freeze([4.0, 4.5, 4.8, 4.9]),
	warrantyMonthOptions: Object.freeze([3, 6, 12, 24, 36]),
	partOriginOptions: Object.freeze([
		{ code: "ALL", labelTr: "Tüm Parça / Malzeme Türleri" },
		{ code: "ORIGINAL_OEM", labelTr: "Orijinal Logolu OEM Parça" },
		{ code: "CERTIFIED_EQUIVALENT", labelTr: "TSE / ISO Garantili Muadil" },
		{ code: "CUSTOM_MANUFACTURED", labelTr: "Sıfır Özel İmalat / Revizyon" },
	]),
	sortOptions: Object.freeze([
		{ code: "TRENDING", labelTr: "🔥 En Trend & Çok Beğenilen" },
		{ code: "PRICE_ASC", labelTr: "💰 En Düşük Fiyat" },
		{ code: "PRICE_DESC", labelTr: "💎 En Yüksek / Kapsamlı Paket" },
		{ code: "RATING_DESC", labelTr: "⭐ En Yüksek Müşteri Puanı" },
		{ code: "FASTEST_ETA", labelTr: "⚡ En Hızlı Varış / Teslim" },
		{ code: "DISTANCE_ASC", labelTr: "📍 En Yakın Mesafe (km)" },
	]),
});

/**
 * Cargo / Freight Waybill & Delivery Verification Guard (`cargo-desi-waybill-tr` skill).
 * For spare parts and wholesale shipments, funds held in the Escrow Pool CANNOT be released
 * unless a valid carrier tracking code + delivery confirmation (or wet signature) is verified.
 * @param {{
 *   carrierCode: "YURTICI" | "SURAT" | "ARAS" | "MNG" | "SANAYI_AMBAR",
 *   trackingNumber: string,
 *   desiWeight?: number,
 *   buyerDeliveryConfirmed: boolean,
 *   hasSignatureOrOtp: boolean
 * }} shipment
 */
export function verifyWaybillAndEscrowRelease(shipment) {
	if (
		!shipment ||
		typeof shipment.trackingNumber !== "string" ||
		shipment.trackingNumber.trim().length < 6
	) {
		return {
			canReleaseEscrow: false,
			errorCode: "WAYBILL_TRACKING_REQUIRED",
			statusBadgeTr:
				"🚚 Kargo / Ambar İrsaliye Kodu Bekleniyor (Havuz Blokesi Aktif)",
		};
	}
	const desi = Math.max(1, Number(shipment.desiWeight) || 5);
	if (!shipment.buyerDeliveryConfirmed || !shipment.hasSignatureOrOtp) {
		return {
			canReleaseEscrow: false,
			errorCode: "BUYER_DELIVERY_APPROVAL_REQUIRED",
			carrierCode: shipment.carrierCode || "YURTICI",
			trackingNumber: shipment.trackingNumber.trim().toUpperCase(),
			desiWeight: desi,
			statusBadgeTr:
				"📦 Kargoda / Teslim Onayı Bekleniyor (Para Havuzda Güvende)",
		};
	}
	return {
		canReleaseEscrow: true,
		errorCode: null,
		carrierCode: shipment.carrierCode || "YURTICI",
		trackingNumber: shipment.trackingNumber.trim().toUpperCase(),
		desiWeight: desi,
		statusBadgeTr:
			"✓ Parça/Mal Teslim Alındı & Onaylandı • %88 Hak Ediş Aktarıldı",
	};
}

/**
 * GİB UBL-TR 1.2 e-Fatura / e-Arşiv Kuruş-Exact Summary & QR Payload Generator (`gib-efatura-earsiv-ubl` skill).
 * @param {{
 *   proformaRefCode: string,
 *   supplierVknOrTckn: string,
 *   buyerVknOrTckn: string,
 *   subtotalTl: number,
 *   kdvRatePercent?: 1 | 10 | 20
 * }} invoiceInput
 */
export function generateGibEfaturaQrSummary(invoiceInput) {
	const subtotalKurus = Math.max(
		0,
		Math.round((Number(invoiceInput?.subtotalTl) || 0) * 100),
	);
	const kdvRate =
		invoiceInput?.kdvRatePercent === 1 || invoiceInput?.kdvRatePercent === 10
			? invoiceInput.kdvRatePercent
			: 20;
	const kdvKurus = Math.round((subtotalKurus * kdvRate) / 100);
	const payableKurus = subtotalKurus + kdvKurus;
	const ettnUuid = `GIB-2026-${Date.now().toString(16).toUpperCase()}`;

	return {
		ublVersionId: "2.1",
		customizationId: "TR1.2",
		ettn: ettnUuid,
		proformaRefCode: String(invoiceInput?.proformaRefCode || "PRF-2026"),
		subtotalTl: subtotalKurus / 100,
		kdvRatePercent: kdvRate,
		kdvAmountTl: kdvKurus / 100,
		payableTotalTl: payableKurus / 100,
		qrJsonPayload: JSON.stringify({
			vkntckn: String(invoiceInput?.supplierVknOrTckn || "10000000146"),
			avkntckn: String(invoiceInput?.buyerVknOrTckn || "11111111110"),
			senaryo: "EARSIVFATURA",
			tip: "SATIS",
			ettn: ettnUuid,
			malhizmettoplam: (subtotalKurus / 100).toFixed(2),
			hesaplanankdv: (kdvKurus / 100).toFixed(2),
			odenecek: (payableKurus / 100).toFixed(2),
			parabirimi: "TRY",
		}),
	};
}

/**
 * In-App Chat Anti-Leak Guard: Blocks off-platform phone/IBAN sharing before Escrow is locked,
 * protecting both customer warranty and platform commission.
 * @param {string} rawMessage
 * @param {boolean} isEscrowLocked
 */
export function sanitizeInAppChatMessage(rawMessage, isEscrowLocked = false) {
	if (typeof rawMessage !== "string") {
		return { cleanMessage: "", blockedLeakAttempt: false };
	}
	if (isEscrowLocked) {
		return { cleanMessage: rawMessage.trim(), blockedLeakAttempt: false };
	}
	const sanitized = redactKvkkSensitiveText(rawMessage.trim());
	const blockedLeakAttempt = sanitized !== rawMessage.trim();
	return {
		cleanMessage: sanitized,
		blockedLeakAttempt,
		warningTr: blockedLeakAttempt
			? "🛡️ Güvenliğiniz için telefon ve IBAN bilgileri yalnızca Güvenli Havuz sözleşmesi onaylandıktan sonra paylaşılabilir."
			: null,
	};
}

/**
 * Creates an interactive Instagram Direct (DM) Proforma Offer Card inside the chat thread.
 * When the customer taps "Havuzda Onayla", the 88/12 split-payment is locked and direct phone/location
 * sharing is unlocked (`isEscrowLocked: true`).
 * @param {{
 *   senderHandle: string,
 *   recipientHandle: string,
 *   serviceOrPartTitle: string,
 *   partsAmountTl?: number,
 *   laborAmountTl: number,
 *   etaOrDeliveryLabel?: string,
 *   warrantyMonths?: number,
 *   isAcceptedInEscrow?: boolean
 * }} input
 */
export function createDmProformaMessageCard(input) {
	if (
		!input ||
		typeof input.serviceOrPartTitle !== "string" ||
		input.serviceOrPartTitle.trim().length < 3
	) {
		throw new Error("DM_PROFORMA_TITLE_REQUIRED");
	}
	const partsKurus = Math.max(
		0,
		Math.round((Number(input.partsAmountTl) || 0) * 100),
	);
	const laborKurus = Math.max(
		0,
		Math.round((Number(input.laborAmountTl) || 0) * 100),
	);
	const totalKurus = partsKurus + laborKurus;
	if (totalKurus <= 0) {
		throw new Error("DM_PROFORMA_AMOUNT_REQUIRED");
	}
	const totalTl = totalKurus / 100;
	const split = calculateSplitPaymentEscrow(totalTl);
	const isLocked = Boolean(input.isAcceptedInEscrow);

	return {
		messageId: `DM-PRF-${Date.now().toString(36).toUpperCase()}`,
		messageType: "PROFORMA_ESCROW_CARD",
		senderHandle: input.senderHandle.startsWith("@")
			? input.senderHandle
			: `@${input.senderHandle}`,
		recipientHandle: input.recipientHandle.startsWith("@")
			? input.recipientHandle
			: `@${input.recipientHandle}`,
		serviceOrPartTitle: redactKvkkSensitiveText(
			input.serviceOrPartTitle.trim(),
		),
		partsAmountTl: partsKurus / 100,
		laborAmountTl: laborKurus / 100,
		totalAmountTl: split.totalAmountTl,
		proNetShareTl: split.subMerchantShareTl,
		escrowFeeTl: split.platformCommissionTl,
		etaOrDeliveryLabel: String(
			input.etaOrDeliveryLabel || "Bugün • 30 dk içinde",
		),
		warrantyMonths: Math.max(1, Number(input.warrantyMonths) || 12),
		isEscrowLocked: isLocked,
		contactUnlocked: isLocked,
		statusBadgeTr: isLocked
			? "✓ Güvenli Havuzda Onaylandı • Konum & Telefon Kilidi Açıldı"
			: "🔒 Havuz Onayı Bekleniyor (%88 Uzman / %12 Güvence)",
	};
}

/**
 * Builds the Full-Screen Instagram Story Deck with Nearby On-Duty Radar distance (`km`) and ETA.
 * @param {Array<{name: string, handle?: string, emoji: string, open?: boolean, storyTitle?: string, priceTl?: number, distanceKm?: number, etaMinutes?: number}>} stories
 */
export function buildFullScreenStoryDeck(stories = []) {
	if (!Array.isArray(stories)) {
		return [];
	}
	return stories.map((s, idx) => {
		const dist = Number(s.distanceKm ?? (idx + 1) * 1.4).toFixed(1);
		const eta = Number(s.etaMinutes ?? (idx + 1) * 8 + 7);
		const price = Math.max(250, Number(s.priceTl) || 850);
		return {
			storyId: `STORY-${idx + 1}`,
			name: String(s.name || "Uzman Usta"),
			handle:
				s.handle ||
				`@${String(s.name || "usta")
					.toLowerCase()
					.replace(/[^a-z0-9]/g, "_")}`,
			emoji: s.emoji || "🛠️",
			isOpen: s.open !== false,
			availabilityBadgeTr:
				s.open !== false
					? "🟢 Şu An Açık • Nöbetçi Radar"
					: "🔴 Mesai Dışı • Randevu Al",
			radarDistanceLabelTr: `📍 ${dist} km yakında • ⚡ ${eta} dk varış`,
			headlineTr:
				s.storyTitle || `${s.name} • Garantili Öncesi / Sonrası İş Vitrini`,
			startingPriceTl: price,
			durationSeconds: 5,
		};
	});
}

/**
 * Calculates a Pro/Sanayici Wallet & Escrow Payout Dashboard summary with kuruş-exact integer math.
 * @param {Array<{id: string, title: string, amountTl: number, state: "IN_ESCROW_POOL" | "SHIPPED_WAYBILL" | "RELEASED_TO_IBAN", waybillCode?: string}>} jobs
 */
export function calculateProWalletDashboard(jobs = []) {
	let heldInPoolKurus = 0;
	let releasedNetKurus = 0;
	let platformFeeTotalKurus = 0;
	let activeWaybillsCount = 0;

	const normalizedJobs = (Array.isArray(jobs) ? jobs : []).map((j) => {
		const amountTl = Math.max(0, Number(j.amountTl) || 0);
		const split = calculateSplitPaymentEscrow(amountTl || 100);
		if (j.state === "RELEASED_TO_IBAN") {
			releasedNetKurus += split.subMerchantShareKurus;
		} else {
			heldInPoolKurus += split.subMerchantShareKurus;
		}
		if (j.waybillCode) {
			activeWaybillsCount += 1;
		}
		platformFeeTotalKurus += split.platformCommissionKurus;
		return {
			id: j.id,
			title: j.title,
			totalAmountTl: split.totalAmountTl,
			proNetShareTl: split.subMerchantShareTl,
			state: j.state,
			waybillCode: j.waybillCode || null,
		};
	});

	return {
		heldInPoolNetTl: heldInPoolKurus / 100,
		releasedToIbanNetTl: releasedNetKurus / 100,
		platformEscrowFeeTotalTl: platformFeeTotalKurus / 100,
		activeWaybillsCount,
		efaturaReadyCount: normalizedJobs.length,
		jobs: normalizedJobs,
	};
}

/**
 * WAF Rate-Limit & Honeypot Bot Shield (`waf-rate-limit-shield` skill).
 * Protects OTP, Login, KYC, and Proforma submission forms against automated bot flooding.
 * @param {{
 *   honeypotValue?: string,
 *   recentAttemptTimestampsMs?: number[],
 *   maxAttempts?: number,
 *   windowMs?: number,
 *   nowMs?: number
 * }} params
 */
export function evaluateWafRateLimitAndHoneypot(params = {}) {
	const trap =
		typeof params.honeypotValue === "string" ? params.honeypotValue.trim() : "";
	if (trap !== "") {
		return {
			allowed: false,
			httpStatus: 403,
			errorCode: "BOT_HONEYPOT_TRIGGERED",
			retryAfterSeconds: 0,
		};
	}

	const nowMs = typeof params.nowMs === "number" ? params.nowMs : Date.now();
	const windowMs =
		typeof params.windowMs === "number" ? params.windowMs : 60000;
	const maxAttempts =
		typeof params.maxAttempts === "number" ? params.maxAttempts : 5;
	const recent = (
		Array.isArray(params.recentAttemptTimestampsMs)
			? params.recentAttemptTimestampsMs
			: []
	).filter((ts) => typeof ts === "number" && nowMs - ts < windowMs);

	if (recent.length >= maxAttempts) {
		return {
			allowed: false,
			httpStatus: 429,
			errorCode: "RATE_LIMIT_EXCEEDED",
			retryAfterSeconds: Math.ceil(windowMs / 1000),
		};
	}

	return {
		allowed: true,
		httpStatus: 200,
		errorCode: null,
		remainingAttempts: maxAttempts - (recent.length + 1),
	};
}

/**
 * Apple App Store Guideline 5.1.1(v), Google Play Data Safety & KVKK Article 7
 * Account Deletion & PII Anonymization Eligibility Evaluator.
 * Blocks account deletion if the user has active unresolved Escrow Pool funds (`FUNDS_HELD_IN_POOL`, `WORK_IN_PROGRESS`, `DISPUTED`).
 * @param {{userId: number, activeEscrowStatuses?: string[]}} params
 */
export function evaluateAccountDeletionEligibility(params = {}) {
	const blockingStatuses = new Set([
		"FUNDS_HELD_IN_POOL",
		"WORK_IN_PROGRESS",
		"DISPUTED",
	]);
	const activeList = Array.isArray(params.activeEscrowStatuses)
		? params.activeEscrowStatuses
		: [];
	const blocking = activeList.filter((st) =>
		blockingStatuses.has(String(st).toUpperCase()),
	);

	if (blocking.length > 0) {
		return {
			canDeleteAccount: false,
			httpStatus: 409,
			errorCode: "ACTIVE_ESCROW_BLOCKS_DELETION",
			blockingCount: blocking.length,
			messageTr:
				"Güvenli Havuzda devam eden veya bloke edilmiş bir işleminiz olduğu için önce aktif teslim sürecini tamamlamalısınız.",
		};
	}

	return {
		canDeleteAccount: true,
		httpStatus: 200,
		errorCode: null,
		anonymizedEmail: `deleted_${Number(params.userId) || 0}@anon.ustanomi.local`,
		messageTr:
			"Hesabınız ve kimlik verileriniz KVKK Madde 7 kapsamında kalıcı olarak anonimleştirilebilir.",
	};
}

/**
 * Digital Escrow Arbitrator & Dispute Resolution Engine (`DISPUTED` state handler).
 * Evaluates objective field proofs (Cargo Waybill delivery, Wet Signature, Before/After Photos)
 * to calculate kuruş-exact payout or refund splits between Customer and Pro/Sanayici.
 * @param {{
 *   totalEscrowAmountTl: number,
 *   hasBeforeAfterPhotoProof?: boolean,
 *   hasCustomerWetSignatureOrOtp?: boolean,
 *   hasVerifiedCargoDelivery?: boolean,
 *   proCompletionRatioPercent?: number
 * }} disputeInput
 */
export function resolveEscrowDisputeCase(disputeInput = {}) {
	const totalKurus = Math.max(
		0,
		Math.round((Number(disputeInput.totalEscrowAmountTl) || 0) * 100),
	);
	if (totalKurus <= 0) {
		throw new Error("DISPUTE_ESCROW_AMOUNT_REQUIRED");
	}

	// Case 1: Pro has full delivery proof (wet signature/OTP or verified cargo delivery + photo proof)
	if (
		disputeInput.hasCustomerWetSignatureOrOtp ||
		(disputeInput.hasVerifiedCargoDelivery &&
			disputeInput.hasBeforeAfterPhotoProof)
	) {
		const split = calculateSplitPaymentEscrow(totalKurus / 100);
		return {
			resolutionDecision: "RELEASE_FULL_TO_PRO",
			nextEscrowState: "CUSTOMER_APPROVED_RELEASED",
			customerRefundTl: 0,
			proPayoutNetTl: split.subMerchantShareTl,
			platformFeeTl: split.platformCommissionTl,
		};
	}

	// Case 2: Partial work completion agreed by Digital Eksper (e.g. 50% milestone completed)
	const ratio = Math.min(
		100,
		Math.max(0, Number(disputeInput.proCompletionRatioPercent) || 0),
	);
	if (ratio > 0 && disputeInput.hasBeforeAfterPhotoProof) {
		const proGrossKurus = Math.round((totalKurus * ratio) / 100);
		const customerRefundKurus = totalKurus - proGrossKurus;
		const proSplit = calculateSplitPaymentEscrow(proGrossKurus / 100);
		return {
			resolutionDecision: "PARTIAL_SETTLEMENT",
			nextEscrowState: "CUSTOMER_APPROVED_RELEASED",
			customerRefundTl: customerRefundKurus / 100,
			proPayoutNetTl: proSplit.subMerchantShareTl,
			platformFeeTl: proSplit.platformCommissionTl,
		};
	}

	// Case 3: No delivery or work proof -> 100% Full Refund to Customer
	return {
		resolutionDecision: "FULL_REFUND_TO_CUSTOMER",
		nextEscrowState: "REFUNDED",
		customerRefundTl: totalKurus / 100,
		proPayoutNetTl: 0,
		platformFeeTl: 0,
	};
}

/**
 * Detects which external commercial or social platform a URL belongs to, enforcing strict HTTPS
 * and SSRF host whitelist validation.
 * @param {string} rawUrl
 */
export function detectExternalPlatformConnector(rawUrl) {
	if (typeof rawUrl !== "string" || !rawUrl.trim()) {
		return null;
	}
	try {
		const parsed = new URL(rawUrl.trim());
		if (parsed.protocol !== "https:") {
			return null;
		}
		const host = parsed.hostname.toLowerCase();
		for (const conn of Object.values(EXTERNAL_COMMERCE_CONNECTORS)) {
			if (
				conn.allowedHosts.some(
					(allowed) => host === allowed || host.endsWith(`.${allowed}`),
				)
			) {
				return {
					connector: conn,
					normalizedUrl: parsed.toString(),
					extractedSlug:
						parsed.pathname.split("/").filter(Boolean).pop() ||
						"ustanomi_store",
				};
			}
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Automatically extracts and normalizes commercial profile data, working hours, price menu items,
 * and showcase media from an external marketplace/social URL + metadata snapshot.
 */
export function parseAndImportExternalCommerceProfile(input) {
	if (!input || typeof input.sourceUrl !== "string") {
		throw new Error("EXTERNAL_SOURCE_URL_REQUIRED");
	}
	const detected = detectExternalPlatformConnector(input.sourceUrl);
	if (!detected) {
		throw new Error("UNSUPPORTED_OR_UNSAFE_EXTERNAL_PLATFORM_URL");
	}

	const { connector, normalizedUrl, extractedSlug } = detected;
	const cleanSlug = extractedSlug.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
	const rawTitle =
		typeof input.rawTitle === "string" && input.rawTitle.trim()
			? input.rawTitle.trim()
			: `${connector.nameTr} (${cleanSlug})`;
	const rawDesc =
		typeof input.rawDescription === "string" && input.rawDescription.trim()
			? input.rawDescription.trim()
			: `${connector.nameTr} üzerinden otomatik senkronize edilen doğrulanmış ticari profil, ilanlar ve fiyat listesi.`;

	const cluster = resolveUniversalProfessionCluster(`${rawTitle} ${rawDesc}`);
	const defaultItems = [
		{
			title: `${cluster.titleTr} • Standart Paket / İlan #1`,
			priceTl: cluster.startingPriceTl,
			mediaType:
				connector.code === "TIKTOK_CREATOR"
					? "REEL_VIDEO"
					: "BEFORE_AFTER_PHOTO",
		},
		{
			title: `${cluster.titleTr} • Garantili Parça + İşçilik Paketi #2`,
			priceTl: Math.round(cluster.startingPriceTl * 1.8),
			mediaType: "REEL_VIDEO",
		},
	];

	const sourceItems =
		Array.isArray(input.rawItems) && input.rawItems.length > 0
			? input.rawItems
			: defaultItems;

	const importedPriceMenu = sourceItems.map((item) => ({
		title: redactKvkkSensitiveText(String(item.title || "İlan Kalemi").trim()),
		priceTl: Math.max(100, Number(item.priceTl) || cluster.startingPriceTl),
		pricingType: "FIXED",
		durationLabel: `${connector.badgeEmoji} ${connector.code} Senkronize`,
	}));

	const importedMediaGrid = sourceItems.map((item, idx) => ({
		id: `ext_${connector.code.toLowerCase()}_${idx + 1}`,
		mediaType: item.mediaType || "BEFORE_AFTER_PHOTO",
		caption: `${connector.badgeEmoji} ${redactKvkkSensitiveText(String(item.title || "İlan Görseli").trim())}`,
		priceTagTl: Math.max(100, Number(item.priceTl) || cluster.startingPriceTl),
	}));

	const showcase = formatInstagramProShowcase({
		handle: cleanSlug || "ustanomi_ticari",
		displayName: redactKvkkSensitiveText(rawTitle),
		professionTitle: `${connector.badgeEmoji} ${cluster.titleTr} (${connector.nameTr} Onaylı)`,
		clusterId: cluster.id,
		city: input.city || "İstanbul",
		district: input.district || "Maslak / Kadıköy",
		rating: Number(input.rating) || 4.9,
		completedJobsCount: Number(input.reviewCount) || 185,
		followersCount: 3420,
		responseTimeMinutes: 3,
		availabilityConfig: {
			manualMode: "OPEN",
			openHour: typeof input.openHour === "number" ? input.openHour : 8,
			closeHour: typeof input.closeHour === "number" ? input.closeHour : 20,
			currentHour: 14,
		},
		priceMenu: importedPriceMenu,
		mediaGrid: importedMediaGrid,
	});

	return {
		syncId: `SYNC-${Date.now().toString(36).toUpperCase()}`,
		connectorCode: connector.code,
		connectorNameTr: connector.nameTr,
		connectorEmoji: connector.badgeEmoji,
		sourceUrl: normalizedUrl,
		autoSyncedFields: connector.autoSyncFields,
		importedItemsCount: sourceItems.length,
		clusterCode: cluster.code,
		clusterTitleTr: cluster.titleTr,
		showcaseProfile: showcase,
		syncedAt: new Date().toISOString(),
	};
}

/**
 * Generates bi-directional omnichannel engagement & Escrow checkout deep-links.
 */
export function buildOmnichannelEngagementLinks(params = {}) {
	const cleanHandle = String(params.proHandle || "ustanomi_pro")
		.replace(/[^a-zA-Z0-9_]/g, "")
		.toLowerCase();
	const escrowUrl = `https://ustanomi-web-production.up.railway.app/app/?pro=${encodeURIComponent(cleanHandle)}&escrow=1`;
	const title = String(
		params.title || "Güvenli Havuz & Proforma Teklifi",
	).trim();
	const priceText = params.priceTl ? ` (${params.priceTl} ₺)` : "";
	const shareText = `🛡️ ${title}${priceText} — Ödemeniz iş/parça teslimine kadar Ustanomi BDDK Emanet Havuzunda korunur: ${escrowUrl}`;

	return {
		proHandle: `@${cleanHandle}`,
		escrowDirectCheckoutUrl: escrowUrl,
		sahibindenAdEmbedSnippetTr: `🛡️ [USTANOMI GÜVENLİ HAVUZ & PROFORMA GARANTİSİ] Parça ve işçilik ödemeniz teslim onayına kadar emanet havuzda korunur: ${escrowUrl}`,
		whatsappInstantQuoteUrl: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
		instagramBioLink: escrowUrl,
		sharePayload: {
			title: `Ustanomi • @${cleanHandle}`,
			text: shareText,
			url: escrowUrl,
		},
	};
}

/**
 * Validates whether a URL belongs to Ustanomi or an approved 3D Secure payment host (PayTR / iyzico).
 * @param {string} rawUrl
 * @returns {boolean}
 */
export function isAllowedUstanomiUrl(rawUrl) {
	if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
		return false;
	}
	try {
		const parsed = new URL(rawUrl);
		if (parsed.protocol !== "https:") {
			return false;
		}
		const host = parsed.hostname.toLowerCase();
		if (ALLOWED_NAVIGATION_HOSTS.has(host)) {
			return true;
		}
		return host.endsWith(".ustanomi.com");
	} catch {
		return false;
	}
}

/**
 * Verifies allowed state transitions for Ustanomi "Güvenli Havuz" (Escrow) milestones (%30 / %40 / %30).
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
export function canTransitionEscrow(fromStatus, toStatus) {
	if (typeof fromStatus !== "string" || typeof toStatus !== "string") {
		return false;
	}
	const allowed = ESCROW_TRANSITIONS[fromStatus];
	return Array.isArray(allowed) && allowed.includes(toStatus);
}

/**
 * Verifies allowed transitions for AI Studio LeadLifecycleState.
 * @param {string} fromState
 * @param {string} toState
 * @returns {boolean}
 */
export function canTransitionLeadState(fromState, toState) {
	if (typeof fromState !== "string" || typeof toState !== "string") {
		return false;
	}
	const allowed = LEAD_LIFECYCLE_TRANSITIONS[fromState.trim().toUpperCase()];
	return (
		Array.isArray(allowed) && allowed.includes(toState.trim().toUpperCase())
	);
}

/**
 * Verifies allowed transitions for AI Studio OfferLifecycleState.
 * @param {string} fromState
 * @param {string} toState
 * @returns {boolean}
 */
export function canTransitionOfferState(fromState, toState) {
	if (typeof fromState !== "string" || typeof toState !== "string") {
		return false;
	}
	const allowed = OFFER_LIFECYCLE_TRANSITIONS[fromState.trim().toUpperCase()];
	return (
		Array.isArray(allowed) && allowed.includes(toState.trim().toUpperCase())
	);
}

/**
 * Deterministic RBAC & Anti-IDOR policy evaluator ported from AI Studio WorkflowRoleAccessEvaluator.
 * Prevents role spoofing, self-bidding, and cross-customer lead/offer tampering.
 */
export function evaluateWorkflowRoleAccess(params) {
	const {
		action,
		actorUserId,
		authenticatedRole,
		isVerifiedPro = false,
		claimedClientRole = null,
		leadOwnerUserId = null,
		offerAuthorProUserId = null,
		assignedProUserId = null,
		participatingProUserIds = [],
	} = params || {};

	if (
		typeof claimedClientRole === "string" &&
		claimedClientRole.trim() !== "" &&
		claimedClientRole.trim().toUpperCase() !==
			String(authenticatedRole).toUpperCase()
	) {
		return {
			allowed: false,
			errorCode: "ROLE_SPOOFING_REJECTED",
			detectedRoleSpoofingAttempt: true,
			reason: `Client claimed role '${claimedClientRole}' conflicts with authenticated server role '${authenticatedRole}'`,
		};
	}

	switch (action) {
		case "CREATE_LEAD":
			return authenticatedRole === "CUSTOMER"
				? { allowed: true, errorCode: null, detectedRoleSpoofingAttempt: false }
				: {
						allowed: false,
						errorCode: "ROLE_FORBIDDEN",
						detectedRoleSpoofingAttempt: false,
						reason: "Only CUSTOMER accounts can create service requests",
					};

		case "PUBLISH_LEAD_OPEN_FOR_OFFERS":
		case "ACCEPT_SINGLE_OFFER":
		case "COMPLETE_ASSIGNED_JOB":
		case "CANCEL_OWN_LEAD":
			if (authenticatedRole !== "CUSTOMER") {
				return {
					allowed: false,
					errorCode: "ROLE_FORBIDDEN",
					detectedRoleSpoofingAttempt: false,
					reason: `Action ${action} requires CUSTOMER role`,
				};
			}
			if (leadOwnerUserId == null || actorUserId !== leadOwnerUserId) {
				return {
					allowed: false,
					errorCode: "OWNERSHIP_FORBIDDEN",
					detectedRoleSpoofingAttempt: false,
					reason: "Customer does not own target lead",
				};
			}
			return {
				allowed: true,
				errorCode: null,
				detectedRoleSpoofingAttempt: false,
			};

		case "VIEW_LEAD_OFFERS":
			if (authenticatedRole === "CUSTOMER") {
				return leadOwnerUserId != null && actorUserId === leadOwnerUserId
					? {
							allowed: true,
							errorCode: null,
							detectedRoleSpoofingAttempt: false,
						}
					: {
							allowed: false,
							errorCode: "OWNERSHIP_FORBIDDEN",
							detectedRoleSpoofingAttempt: false,
							reason: "Customer cannot read offers for another customer's lead",
						};
			}
			if (!isVerifiedPro) {
				return {
					allowed: false,
					errorCode: "PRO_VERIFICATION_REQUIRED",
					detectedRoleSpoofingAttempt: false,
					reason: "Unverified MASTER cannot inspect lead offers",
				};
			}
			if (
				participatingProUserIds.includes(actorUserId) ||
				actorUserId === assignedProUserId
			) {
				return {
					allowed: true,
					errorCode: null,
					detectedRoleSpoofingAttempt: false,
				};
			}
			return {
				allowed: false,
				errorCode: "OWNERSHIP_FORBIDDEN",
				detectedRoleSpoofingAttempt: false,
				reason: "MASTER has no participating offer on this lead",
			};

		case "SUBMIT_PRO_OFFER":
			if (authenticatedRole !== "MASTER") {
				return {
					allowed: false,
					errorCode: "ROLE_FORBIDDEN",
					detectedRoleSpoofingAttempt: false,
					reason: "Only MASTER accounts can submit Pro offers",
				};
			}
			if (!isVerifiedPro) {
				return {
					allowed: false,
					errorCode: "PRO_VERIFICATION_REQUIRED",
					detectedRoleSpoofingAttempt: false,
					reason: "Unverified MASTER cannot submit Pro offers",
				};
			}
			if (leadOwnerUserId != null && actorUserId === leadOwnerUserId) {
				return {
					allowed: false,
					errorCode: "SELF_BIDDING_FORBIDDEN",
					detectedRoleSpoofingAttempt: false,
					reason: "Actor cannot submit an offer on their own lead",
				};
			}
			return {
				allowed: true,
				errorCode: null,
				detectedRoleSpoofingAttempt: false,
			};

		case "WITHDRAW_PRO_OFFER":
			if (authenticatedRole !== "MASTER") {
				return {
					allowed: false,
					errorCode: "ROLE_FORBIDDEN",
					detectedRoleSpoofingAttempt: false,
					reason: "Only MASTER accounts can withdraw Pro offers",
				};
			}
			if (
				offerAuthorProUserId == null ||
				actorUserId !== offerAuthorProUserId
			) {
				return {
					allowed: false,
					errorCode: "OWNERSHIP_FORBIDDEN",
					detectedRoleSpoofingAttempt: false,
					reason: "MASTER cannot withdraw offer authored by another Pro",
				};
			}
			return {
				allowed: true,
				errorCode: null,
				detectedRoleSpoofingAttempt: false,
			};

		case "START_ASSIGNED_JOB":
			if (authenticatedRole !== "MASTER") {
				return {
					allowed: false,
					errorCode: "ROLE_FORBIDDEN",
					detectedRoleSpoofingAttempt: false,
					reason: "Only the assigned MASTER can mark a job IN_PROGRESS",
				};
			}
			if (!isVerifiedPro) {
				return {
					allowed: false,
					errorCode: "PRO_VERIFICATION_REQUIRED",
					detectedRoleSpoofingAttempt: false,
					reason: "Assigned MASTER must remain verified",
				};
			}
			if (assignedProUserId == null || actorUserId !== assignedProUserId) {
				return {
					allowed: false,
					errorCode: "OWNERSHIP_FORBIDDEN",
					detectedRoleSpoofingAttempt: false,
					reason: "MASTER is not the assigned Pro for this job",
				};
			}
			return {
				allowed: true,
				errorCode: null,
				detectedRoleSpoofingAttempt: false,
			};

		default:
			return {
				allowed: false,
				errorCode: "UNKNOWN_ACTION",
				detectedRoleSpoofingAttempt: false,
				reason: "Unsupported workflow action",
			};
	}
}

/**
 * Kuruş-exact Split-Payment & Milestones calculator (%88 Sub-Merchant Master / %12 Platform Commission,
 * plus %30 / %40 / %30 staged escrow breakdown). Zero floating-point drift.
 * @param {number} totalAmountTl
 */
export function calculateSplitPaymentEscrow(totalAmountTl) {
	if (
		typeof totalAmountTl !== "number" ||
		!Number.isFinite(totalAmountTl) ||
		totalAmountTl <= 0
	) {
		throw new Error("INVALID_ESCROW_AMOUNT");
	}
	const totalKurus = Math.round(totalAmountTl * 100);
	const platformCommissionKurus = Math.round((totalKurus * 1200) / 10000);
	const subMerchantShareKurus = totalKurus - platformCommissionKurus;

	const stage1Kurus = Math.round((totalKurus * 3000) / 10000);
	const stage2Kurus = Math.round((totalKurus * 4000) / 10000);
	const stage3Kurus = totalKurus - stage1Kurus - stage2Kurus;

	return {
		totalKurus,
		subMerchantShareKurus,
		platformCommissionKurus,
		totalAmountTl: totalKurus / 100,
		subMerchantShareTl: subMerchantShareKurus / 100,
		platformCommissionTl: platformCommissionKurus / 100,
		milestonesTl: [stage1Kurus / 100, stage2Kurus / 100, stage3Kurus / 100],
		escrowStatus: "HAVUZ_HESAPTA",
	};
}

/**
 * Masks sensitive KVKK fields (Turkish phone numbers, TCKN, IBAN) before logging or error reporting.
 * @param {string} text
 * @returns {string}
 */
export function redactKvkkSensitiveText(text) {
	if (typeof text !== "string") {
		return "";
	}
	return text
		.replace(/\bTR\d{2}\s?(\d{4}\s?){5}\d{2}\b/gi, "TR**[IBAN-REDACTED]**")
		.replace(
			/\b(?:\+?90|0)?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g,
			"+905**[PHONE-REDACTED]**",
		)
		.replace(/\b[1-9]\d{10}\b/g, "**[TCKN-REDACTED]**");
}

function getCapacitorPlugin(pluginName) {
	if (typeof window === "undefined") {
		return null;
	}
	const cap = window.Capacitor;
	if (!cap?.Plugins) {
		return null;
	}
	return cap.Plugins[pluginName] || null;
}

export async function getOfflineQueue() {
	const prefPlugin = getCapacitorPlugin("Preferences");
	let raw = null;
	if (prefPlugin && typeof prefPlugin.get === "function") {
		const res = await prefPlugin.get({ key: OFFLINE_QUEUE_KEY });
		raw = res ? res.value : null;
	} else if (typeof localStorage !== "undefined") {
		raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
	}
	if (!raw) {
		return [];
	}
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

async function saveOfflineQueue(queue) {
	const serialized = JSON.stringify(queue.slice(-MAX_QUEUE_ITEMS));
	const prefPlugin = getCapacitorPlugin("Preferences");
	if (prefPlugin && typeof prefPlugin.set === "function") {
		await prefPlugin.set({ key: OFFLINE_QUEUE_KEY, value: serialized });
	} else if (typeof localStorage !== "undefined") {
		localStorage.setItem(OFFLINE_QUEUE_KEY, serialized);
	}
}

export async function enqueueOfflineAction(type, payload) {
	if (typeof type !== "string" || !type.trim()) {
		throw new Error("Offline action type is required");
	}
	const current = await getOfflineQueue();
	const entry = {
		id: `ust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		type: type.trim(),
		payload: payload && typeof payload === "object" ? payload : {},
		createdAt: new Date().toISOString(),
	};
	current.push(entry);
	await saveOfflineQueue(current);
	await triggerHapticImpact("LIGHT");
	return entry;
}

export async function flushOfflineQueue(syncHandler) {
	const queue = await getOfflineQueue();
	if (queue.length === 0) {
		return { synced: 0, remaining: 0 };
	}
	const remaining = [];
	let synced = 0;
	for (const item of queue) {
		try {
			const ok =
				typeof syncHandler === "function" ? await syncHandler(item) : true;
			if (ok) {
				synced += 1;
			} else {
				remaining.push(item);
			}
		} catch {
			remaining.push(item);
		}
	}
	await saveOfflineQueue(remaining);
	return { synced, remaining: remaining.length };
}

export async function triggerHapticImpact(style = "LIGHT") {
	const haptics = getCapacitorPlugin("Haptics");
	if (haptics && typeof haptics.impact === "function") {
		try {
			await haptics.impact({ style });
			return true;
		} catch {
			return false;
		}
	}
	if (
		typeof navigator !== "undefined" &&
		typeof navigator.vibrate === "function"
	) {
		navigator.vibrate(15);
		return true;
	}
	return false;
}

export async function captureFieldPhoto(options = {}) {
	const camera = getCapacitorPlugin("Camera");
	const quality =
		typeof options.quality === "number"
			? Math.min(Math.max(options.quality, 40), 95)
			: 82;
	if (camera && typeof camera.getPhoto === "function") {
		return await camera.getPhoto({
			quality,
			allowEditing: Boolean(options.allowEditing),
			resultType: "uri",
			source: "PROMPT",
		});
	}
	throw new Error("CAMERA_PLUGIN_UNAVAILABLE");
}

export async function getCurrentRadarLocation() {
	const geo = getCapacitorPlugin("Geolocation");
	if (geo && typeof geo.getCurrentPosition === "function") {
		return await geo.getCurrentPosition({
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 30000,
		});
	}
	if (typeof navigator !== "undefined" && navigator.geolocation) {
		return await new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: true,
				timeout: 10000,
			});
		});
	}
	throw new Error("GEOLOCATION_UNAVAILABLE");
}

export async function openSecurePaymentOrLegalUrl(url) {
	if (!isAllowedUstanomiUrl(url)) {
		throw new Error("BLOCKED_UNTRUSTED_NAVIGATION_URL");
	}
	const browser = getCapacitorPlugin("Browser");
	if (browser && typeof browser.open === "function") {
		await browser.open({
			url,
			presentationStyle: "popover",
			toolbarColor: "#153E49",
		});
		return true;
	}
	if (typeof window !== "undefined") {
		window.open(url, "_blank", "noopener,noreferrer");
		return true;
	}
	return false;
}

export function createTouchWetSignatureProof(options = {}) {
	const jobId = String(options.jobId || "JOB-801").trim();
	const signerName = redactKvkkSensitiveText(
		String(options.signerName || "Müşteri Teslim Onayı").trim(),
	);
	const strokePointsCount = Number(options.strokePointsCount || 0);
	const boundingBoxWidth = Number(options.boundingBoxWidth || 0);
	const boundingBoxHeight = Number(options.boundingBoxHeight || 0);
	const timestampIso = String(
		options.timestampIso || new Date().toISOString(),
	).trim();

	if (
		strokePointsCount < 12 ||
		boundingBoxWidth < 24 ||
		boundingBoxHeight < 10
	) {
		return {
			valid: false,
			errorCode: "SIGNATURE_TOO_SHORT_OR_EMPTY",
			messageTr:
				"Lütfen ekrandaki imza alanına parmağınızla geçerli bir ıslak imza atınız.",
		};
	}

	const rawSeed = `${jobId}|${signerName}|${strokePointsCount}|${boundingBoxWidth}x${boundingBoxHeight}|${timestampIso}`;
	let hashAcc = 2166136261;
	for (let i = 0; i < rawSeed.length; i += 1) {
		hashAcc ^= rawSeed.charCodeAt(i);
		hashAcc = Math.imul(hashAcc, 16777619) >>> 0;
	}
	const hexDigest = hashAcc.toString(16).toUpperCase().padStart(8, "0");

	return {
		valid: true,
		jobId,
		signerName,
		strokePointsCount,
		proofCode: `SIG-2026-${hexDigest}`,
		escrowAction: "RELEASE_88_PERCENT_TO_PRO_IBAN",
		timestampIso,
		messageTr: `✓ Islak imza doğrulandı (SIG-2026-${hexDigest}). %88 uzman hakedişi TR IBAN hesabına aktarıma açıldı.`,
	};
}

export function evaluateMobileViewportErgonomics(metrics = {}) {
	const viewportWidthPx = Number(metrics.viewportWidthPx || 390);
	const documentScrollWidthPx = Number(
		metrics.documentScrollWidthPx || viewportWidthPx,
	);
	const minTapTargetPx = Number(metrics.minTapTargetPx || 44);
	const inputFontSizePx = Number(metrics.inputFontSizePx || 16);
	const hasSafeAreaInsets = Boolean(metrics.hasSafeAreaInsets ?? true);

	const horizontalDriftPx = Math.max(
		0,
		documentScrollWidthPx - viewportWidthPx,
	);
	const zeroHorizontalShift = horizontalDriftPx === 0;
	const tapTargetsCompliant = minTapTargetPx >= 44;
	const zeroKeyboardZoomShift = inputFontSizePx >= 16;

	const compliant =
		zeroHorizontalShift &&
		tapTargetsCompliant &&
		zeroKeyboardZoomShift &&
		hasSafeAreaInsets;

	return {
		compliant,
		horizontalDriftPx,
		zeroHorizontalShift,
		tapTargetsCompliant,
		zeroKeyboardZoomShift,
		hasSafeAreaInsets,
		grade: compliant ? "A+_ZERO_SHIFT_MOBILE" : "LAYOUT_DRIFT_DETECTED",
	};
}

export function createSignaturePad(canvas) {
	if (!canvas || typeof canvas.getContext !== "function") {
		throw new Error("VALID_CANVAS_REQUIRED");
	}
	const ctx = canvas.getContext("2d");
	let isDrawing = false;
	let hasInk = false;
	let strokePointsCount = 0;
	let minX = Number.POSITIVE_INFINITY;
	let maxX = 0;
	let minY = Number.POSITIVE_INFINITY;
	let maxY = 0;

	const recordPoint = (pt) => {
		strokePointsCount += 1;
		if (pt.x < minX) minX = pt.x;
		if (pt.x > maxX) maxX = pt.x;
		if (pt.y < minY) minY = pt.y;
		if (pt.y > maxY) maxY = pt.y;
	};

	const getPoint = (event) => {
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / (rect.width || 1);
		const scaleY = canvas.height / (rect.height || 1);
		return {
			x: (event.clientX - rect.left) * scaleX,
			y: (event.clientY - rect.top) * scaleY,
		};
	};

	const onPointerDown = (event) => {
		if (!ctx) return;
		const pt = getPoint(event);
		recordPoint(pt);
		ctx.beginPath();
		ctx.moveTo(pt.x, pt.y);
		isDrawing = true;
		hasInk = true;
	};

	const onPointerMove = (event) => {
		if (!isDrawing || !ctx) return;
		const pt = getPoint(event);
		recordPoint(pt);
		ctx.lineWidth = 2.6;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.strokeStyle = "#10B981";
		ctx.lineTo(pt.x, pt.y);
		ctx.stroke();
	};

	const onPointerUp = () => {
		isDrawing = false;
	};

	canvas.addEventListener("pointerdown", onPointerDown);
	canvas.addEventListener("pointermove", onPointerMove);
	canvas.addEventListener("pointerup", onPointerUp);
	canvas.addEventListener("pointercancel", onPointerUp);

	return {
		clear() {
			if (ctx) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
			}
			hasInk = false;
			strokePointsCount = 0;
			minX = Number.POSITIVE_INFINITY;
			maxX = 0;
			minY = Number.POSITIVE_INFINITY;
			maxY = 0;
		},
		isEmpty() {
			return !hasInk;
		},
		getProof(jobId = "JOB-801", signerName = "Müşteri Teslim Onayı") {
			return createTouchWetSignatureProof({
				jobId,
				signerName,
				strokePointsCount,
				boundingBoxWidth: hasInk ? Math.max(0, Math.round(maxX - minX)) : 0,
				boundingBoxHeight: hasInk ? Math.max(0, Math.round(maxY - minY)) : 0,
			});
		},
		toDataURL() {
			return canvas.toDataURL("image/png");
		},
		destroy() {
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("pointermove", onPointerMove);
			canvas.removeEventListener("pointerup", onPointerUp);
			canvas.removeEventListener("pointercancel", onPointerUp);
		},
	};
}

export async function initUstanomiNativeShell(callbacks = {}) {
	const statusBar = getCapacitorPlugin("StatusBar");
	if (statusBar && typeof statusBar.setBackgroundColor === "function") {
		try {
			await statusBar.setBackgroundColor({ color: "#0A0F1D" });
		} catch {
			// Ignore on web
		}
	}

	const appPlugin = getCapacitorPlugin("App");
	if (appPlugin && typeof appPlugin.addListener === "function") {
		appPlugin.addListener("backButton", ({ canGoBack }) => {
			if (
				canGoBack &&
				typeof window !== "undefined" &&
				window.history.length > 1
			) {
				window.history.back();
			} else if (typeof appPlugin.minimizeApp === "function") {
				appPlugin.minimizeApp();
			}
		});
	}

	const networkPlugin = getCapacitorPlugin("Network");
	if (networkPlugin && typeof networkPlugin.addListener === "function") {
		networkPlugin.addListener("networkStatusChange", (status) => {
			if (typeof callbacks.onNetworkChange === "function") {
				callbacks.onNetworkChange(status);
			}
		});
	} else if (typeof window !== "undefined") {
		window.addEventListener("online", () => {
			if (typeof callbacks.onNetworkChange === "function") {
				callbacks.onNetworkChange({ connected: true, connectionType: "wifi" });
			}
		});
		window.addEventListener("offline", () => {
			if (typeof callbacks.onNetworkChange === "function") {
				callbacks.onNetworkChange({ connected: false, connectionType: "none" });
			}
		});
	}
}

export const UstanomiNative = Object.freeze({
	OFFER_SERVICE_CATEGORIES,
	UNIVERSAL_PROFESSION_CLUSTERS,
	URGENCY_TIERS,
	PRO_AVAILABILITY_MODES,
	ESCROW_PAYMENT_PROVIDERS,
	LEAD_LIFECYCLE_TRANSITIONS,
	OFFER_LIFECYCLE_TRANSITIONS,
	resolveOfferServiceCategory,
	resolveUniversalProfessionCluster,
	evaluateProAvailability,
	formatInstagramProShowcase,
	createUrgentJobPostPayload,
	calculateTalentTrendingScore,
	rankTalentShowcasePosts,
	createWorkWithYouRequestPayload,
	validateTurkishTckn,
	validateTurkishVkn,
	validateTurkishIban,
	evaluatePasswordStrength,
	validateKycRegistrationPayload,
	GLOBAL_LOCALES,
	convertAndFormatGlobalPrice,
	estimateArmutStyleSmartQuote,
	filterAndSearchMarketplace,
	B2B_TENDER_CATEGORIES,
	createSealedProformaBidPayload,
	EXTERNAL_COMMERCE_CONNECTORS,
	FULL_MARKETPLACE_FILTER_SCHEMA,
	detectExternalPlatformConnector,
	parseAndImportExternalCommerceProfile,
	buildOmnichannelEngagementLinks,
	verifyWaybillAndEscrowRelease,
	generateGibEfaturaQrSummary,
	sanitizeInAppChatMessage,
	createDmProformaMessageCard,
	buildFullScreenStoryDeck,
	calculateProWalletDashboard,
	evaluateWafRateLimitAndHoneypot,
	evaluateAccountDeletionEligibility,
	resolveEscrowDisputeCase,
	isAllowedUstanomiUrl,
	canTransitionEscrow,
	canTransitionLeadState,
	canTransitionOfferState,
	evaluateWorkflowRoleAccess,
	calculateSplitPaymentEscrow,
	redactKvkkSensitiveText,
	getOfflineQueue,
	enqueueOfflineAction,
	flushOfflineQueue,
	triggerHapticImpact,
	captureFieldPhoto,
	getCurrentRadarLocation,
	openSecurePaymentOrLegalUrl,
	createTouchWetSignatureProof,
	evaluateMobileViewportErgonomics,
	createSignaturePad,
	initUstanomiNativeShell,
});

if (typeof window !== "undefined") {
	window.UstanomiNative = UstanomiNative;
}
