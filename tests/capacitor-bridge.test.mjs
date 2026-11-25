import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	calculateSplitPaymentEscrow,
	canTransitionEscrow,
	canTransitionLeadState,
	canTransitionOfferState,
	enqueueOfflineAction,
	evaluateWorkflowRoleAccess,
	flushOfflineQueue,
	getOfflineQueue,
	isAllowedUstanomiUrl,
	OFFER_SERVICE_CATEGORIES,
	redactKvkkSensitiveText,
	resolveOfferServiceCategory,
} from "../www/capacitor-bridge.js";

// Simple in-memory localStorage shim for Node test runner
const memoryStore = new Map();
globalThis.localStorage = {
	getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
	setItem: (key, val) => memoryStore.set(key, String(val)),
	removeItem: (key) => memoryStore.delete(key),
	clear: () => memoryStore.clear(),
};

describe("Ustanomi Native Capacitor Bridge & AI Studio Workflow Suite", () => {
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

		// Reject cleartext HTTP and untrusted domains
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

		// AI Studio LeadLifecycleState
		assert.equal(canTransitionLeadState("DRAFT", "OPEN_FOR_OFFERS"), true);
		assert.equal(
			canTransitionLeadState("OPEN_FOR_OFFERS", "OFFER_ACCEPTED"),
			true,
		);
		assert.equal(canTransitionLeadState("OFFER_ACCEPTED", "IN_PROGRESS"), true);
		assert.equal(canTransitionLeadState("IN_PROGRESS", "COMPLETED"), true);
		assert.equal(canTransitionLeadState("COMPLETED", "OPEN_FOR_OFFERS"), false);

		// AI Studio OfferLifecycleState
		assert.equal(canTransitionOfferState("PENDING", "ACCEPTED"), true);
		assert.equal(canTransitionOfferState("PENDING", "WITHDRAWN"), true);
		assert.equal(canTransitionOfferState("ACCEPTED", "COMPLETED"), true);
		assert.equal(canTransitionOfferState("REJECTED", "ACCEPTED"), false);
	});

	it("resolves all 6 AI Studio canonical service categories and Turkish aliases", () => {
		assert.equal(OFFER_SERVICE_CATEGORIES.length, 6);
		assert.equal(
			resolveOfferServiceCategory("Su Tesisatı")?.apiParam,
			"Plumbing",
		);
		assert.equal(
			resolveOfferServiceCategory("akıllı ev")?.apiParam,
			"Electrical",
		);
		assert.equal(
			resolveOfferServiceCategory("alçıpan")?.apiParam,
			"Renovation",
		);
		assert.equal(resolveOfferServiceCategory("marangoz")?.apiParam, "Woodwork");
		assert.equal(resolveOfferServiceCategory("kombi")?.apiParam, "HVAC");
		assert.equal(
			resolveOfferServiceCategory("ofis temizliği")?.apiParam,
			"Cleaning",
		);
	});

	it("enforces AI Studio RBAC, Anti-IDOR ownership, and Role-Spoofing protection", () => {
		// Reject role spoofing
		const spoofed = evaluateWorkflowRoleAccess({
			action: "SUBMIT_PRO_OFFER",
			actorUserId: 10,
			authenticatedRole: "CUSTOMER",
			claimedClientRole: "MASTER",
		});
		assert.equal(spoofed.allowed, false);
		assert.equal(spoofed.errorCode, "ROLE_SPOOFING_REJECTED");
		assert.equal(spoofed.detectedRoleSpoofingAttempt, true);

		// Prevent self-bidding by a master on their own lead
		const selfBid = evaluateWorkflowRoleAccess({
			action: "SUBMIT_PRO_OFFER",
			actorUserId: 42,
			authenticatedRole: "MASTER",
			isVerifiedPro: true,
			leadOwnerUserId: 42,
		});
		assert.equal(selfBid.allowed, false);
		assert.equal(selfBid.errorCode, "SELF_BIDDING_FORBIDDEN");

		// Allow verified master to bid on another customer's lead
		const validBid = evaluateWorkflowRoleAccess({
			action: "SUBMIT_PRO_OFFER",
			actorUserId: 99,
			authenticatedRole: "MASTER",
			isVerifiedPro: true,
			leadOwnerUserId: 42,
		});
		assert.equal(validBid.allowed, true);
	});

	it("calculates kuruş-exact 88% Sub-Merchant / 12% Platform Split-Payment and 30/40/30 milestones", () => {
		const split = calculateSplitPaymentEscrow(10000);
		assert.equal(split.totalKurus, 1000000);
		assert.equal(split.subMerchantShareTl, 8800);
		assert.equal(split.platformCommissionTl, 1200);
		assert.deepEqual(split.milestonesTl, [3000, 4000, 3000]);
		assert.equal(split.escrowStatus, "HAVUZ_HESAPTA");
	});

	it("redacts Turkish phone numbers, IBANs, and TCKN from field notes (KVKK compliance)", () => {
		const raw =
			"Müşteri tel 0532 123 45 67, IBAN TR33 0006 1005 1978 6457 8413 26, TCKN 12345678901";
		const safe = redactKvkkSensitiveText(raw);
		assert.equal(safe.includes("0532 123 45 67"), false);
		assert.equal(safe.includes("12345678901"), false);
		assert.equal(safe.includes("TR**[IBAN-REDACTED]**"), true);
		assert.equal(safe.includes("+905**[PHONE-REDACTED]**"), true);
		assert.equal(safe.includes("**[TCKN-REDACTED]**"), true);
	});

	it("enqueues and flushes offline field milestone proofs reliably", async () => {
		await enqueueOfflineAction("FIELD_MILESTONE_PROOF", {
			note: "#1042 2. Etap Seramik Döşeme",
			hasSignature: true,
		});
		await enqueueOfflineAction("DISCOVERY_CHECKIN", {
			lat: 41.0082,
			lng: 28.9784,
		});

		const queued = await getOfflineQueue();
		assert.equal(queued.length, 2);
		assert.equal(queued[0].type, "FIELD_MILESTONE_PROOF");

		let callCount = 0;
		const firstFlush = await flushOfflineQueue(async () => {
			callCount += 1;
			return callCount === 1;
		});
		assert.equal(firstFlush.synced, 1);
		assert.equal(firstFlush.remaining, 1);

		const secondFlush = await flushOfflineQueue(async () => true);
		assert.equal(secondFlush.synced, 1);
		assert.equal(secondFlush.remaining, 0);
	});
});
