/**
 * Ustanomi Native Capacitor 6 Bridge, AI Studio Lead/Offer Workflow, Offline Field Queue & Split-Payment Engine
 * License: MIT (_mit-kit aligned: mobile/offline-hook, service/signature-qr-helpers, payments/iyzico-paytr-webhook, finance/tr-money-math)
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
 * Canonical 6 Ustanomi Service Categories from AI Studio (OfferServiceCategory)
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
 * @param {{
 *   action: string,
 *   actorUserId: number,
 *   authenticatedRole: "CUSTOMER" | "MASTER",
 *   isVerifiedPro?: boolean,
 *   claimedClientRole?: string | null,
 *   leadOwnerUserId?: number | null,
 *   offerAuthorProUserId?: number | null,
 *   assignedProUserId?: number | null,
 *   participatingProUserIds?: number[]
 * }} params
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

/**
 * Helper to access Capacitor native plugins safely without throwing in browser/WebView fallback mode.
 * @param {string} pluginName
 * @returns {Record<string, unknown> | null}
 */
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

/**
 * Reads offline field queue from Capacitor Preferences or localStorage fallback.
 * @returns {Promise<Array<{id: string, type: string, payload: Record<string, unknown>, createdAt: string}>>}
 */
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

/**
 * Persists offline queue array to Capacitor Preferences or localStorage.
 * @param {Array<{id: string, type: string, payload: Record<string, unknown>, createdAt: string}>} queue
 */
async function saveOfflineQueue(queue) {
	const serialized = JSON.stringify(queue.slice(-MAX_QUEUE_ITEMS));
	const prefPlugin = getCapacitorPlugin("Preferences");
	if (prefPlugin && typeof prefPlugin.set === "function") {
		await prefPlugin.set({ key: OFFLINE_QUEUE_KEY, value: serialized });
	} else if (typeof localStorage !== "undefined") {
		localStorage.setItem(OFFLINE_QUEUE_KEY, serialized);
	}
}

/**
 * Enqueues a field action (milestone photo, discovery note, customer wet signature) when offline.
 * @param {string} type
 * @param {Record<string, unknown>} payload
 */
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

/**
 * Flushes queued offline field actions when connectivity is restored.
 * @param {(item: {id: string, type: string, payload: Record<string, unknown>, createdAt: string}) => Promise<boolean>} syncHandler
 */
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

/**
 * Triggers native tactile feedback via @capacitor/haptics.
 * @param {"LIGHT" | "MEDIUM" | "HEAVY"} style
 */
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

/**
 * Captures a work-site photo or MYK/MEB certificate via @capacitor/camera.
 * @param {{quality?: number, allowEditing?: boolean}} options
 */
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

/**
 * Fetches current verified GPS coordinates for Emergency 30-Min Usta Radar.
 */
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

/**
 * Opens an approved 3D Secure payment page (PayTR / iyzico) or Ustanomi legal document in @capacitor/browser.
 * @param {string} url
 */
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

/**
 * Mounts a touch-friendly wet-signature canvas for field milestone approval (_mit-kit/service/signature-qr-helpers).
 * @param {HTMLCanvasElement} canvas
 */
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

/**
 * Initializes native lifecycle listeners: StatusBar, SplashScreen, Android hardware back button, and Network observer.
 * @param {{onNetworkChange?: (status: {connected: boolean, connectionType: string}) => void}} callbacks
 */
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
	ESCROW_PAYMENT_PROVIDERS,
	LEAD_LIFECYCLE_TRANSITIONS,
	OFFER_LIFECYCLE_TRANSITIONS,
	resolveOfferServiceCategory,
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
