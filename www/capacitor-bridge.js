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
	const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
	for (const cluster of UNIVERSAL_PROFESSION_CLUSTERS) {
		const haystack =
			`${cluster.titleTr} ${cluster.professions.join(" ")}`.toLocaleLowerCase(
				"tr-TR",
			);
		if (
			cluster.id.toLocaleLowerCase("tr-TR") === q ||
			cluster.code.toLocaleLowerCase("tr-TR") === q ||
			haystack.includes(q) ||
			(tokens.length > 0 && tokens.every((tok) => haystack.includes(tok)))
		) {
			return cluster;
		}
	}
	return UNIVERSAL_PROFESSION_CLUSTERS[0];
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

export function createSignaturePad(canvas) {
	if (!canvas || typeof canvas.getContext !== "function") {
		throw new Error("VALID_CANVAS_REQUIRED");
	}
	const ctx = canvas.getContext("2d");
	let isDrawing = false;
	let hasInk = false;

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
		ctx.beginPath();
		ctx.moveTo(pt.x, pt.y);
		isDrawing = true;
		hasInk = true;
	};

	const onPointerMove = (event) => {
		if (!isDrawing || !ctx) return;
		const pt = getPoint(event);
		ctx.lineWidth = 2.2;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.strokeStyle = "#153E49";
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
		},
		isEmpty() {
			return !hasInk;
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
			await statusBar.setBackgroundColor({ color: "#153E49" });
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
	createSignaturePad,
	initUstanomiNativeShell,
});

if (typeof window !== "undefined") {
	window.UstanomiNative = UstanomiNative;
}
