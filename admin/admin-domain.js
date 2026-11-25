/**
 * Ustanomi Admin Console — pure domain logic shared by the panel UI and the test-suite.
 * Every rule here mirrors the server-side PHP in includes/admin-security.php and api/admin/*.php.
 * The server is the source of truth; this module never grants access by itself.
 */

/** Integer kuruş split, half-up rounding. fee + net === total, always. */
export function splitKurus(totalKurus, feeBps) {
	if (
		!Number.isInteger(totalKurus) ||
		totalKurus < 0 ||
		!Number.isInteger(feeBps) ||
		feeBps < 0 ||
		feeBps > 10000
	) {
		throw new Error("INVALID_SPLIT_INPUT");
	}
	const feeKurus = Math.floor((totalKurus * feeBps + 5000) / 10000);
	return { totalKurus, feeKurus, netKurus: totalKurus - feeKurus };
}

/** 30/40/30 milestones; the last milestone absorbs rounding. */
export function milestonesKurus(totalKurus) {
	const m1 = Math.floor((totalKurus * 30 + 50) / 100);
	const m2 = Math.floor((totalKurus * 40 + 50) / 100);
	return [m1, m2, totalKurus - m1 - m2];
}

export function formatTl(kurus) {
	const sign = kurus < 0 ? "-" : "";
	const abs = Math.abs(Math.trunc(kurus));
	const lira = Math.floor(abs / 100)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	const kr = String(abs % 100).padStart(2, "0");
	return `${sign}${lira},${kr} ₺`;
}

/** Mirror of require_admin_permission(): unknown permission or wrong role => 403. */
export function evaluateAdminPermission(policy, role, permission) {
	const roles = policy?.permissions?.[permission];
	const allowed = Array.isArray(roles) && roles.includes(role);
	return { allowed, httpStatus: allowed ? 200 : 403 };
}

export function permissionsFor(policy, role) {
	return Object.entries(policy.permissions)
		.filter(([, roles]) => roles.includes(role))
		.map(([perm]) => perm);
}

export function maskPhone(v) {
	const d = String(v ?? "").replace(/\D/g, "");
	return d.length >= 4 ? "*".repeat(d.length - 2) + d.slice(-2) : "****";
}

export function maskTckn(v) {
	const d = String(v ?? "").replace(/\D/g, "");
	return d.length === 11
		? `${d.slice(0, 2)}*******${d.slice(-2)}`
		: "***********";
}

export function maskIban(v) {
	const c = String(v ?? "")
		.replace(/\s+/g, "")
		.toUpperCase();
	return c.length >= 8
		? c.slice(0, 4) + "*".repeat(c.length - 8) + c.slice(-4)
		: "TR**";
}

export function maskEmail(v) {
	const [local, domain] = String(v ?? "").split("@");
	return local && domain ? `${local.slice(0, 1)}***@${domain}` : "***";
}

/** Versioned settings: latest version whose effectiveFrom <= at. */
export function resolveSettingAt(versions, key, atIso, fallback) {
	const at = Date.parse(atIso);
	const candidates = versions
		.filter((v) => v.key === key && Date.parse(v.effectiveFrom) <= at)
		.sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom));
	return candidates.length > 0 ? candidates[0].value : fallback;
}

/** Mirror of admin_validate_setting() + the no-retroactive rule in api/admin/settings.php. */
export function validateSettingChange(key, value, effectiveFromMs, nowMs) {
	if (effectiveFromMs < nowMs - 60_000) {
		return { valid: false, error: "RETROACTIVE_CHANGE_FORBIDDEN" };
	}
	switch (key) {
		case "escrow_platform_fee_bps":
		case "live_gift_platform_fee_bps":
			return Number.isInteger(value) && value >= 0 && value <= 3000
				? { valid: true }
				: { valid: false, error: "BPS_OUT_OF_RANGE" };
		case "gift_catalog": {
			if (!Array.isArray(value) || value.length !== 18) {
				return { valid: false, error: "GIFT_CATALOG_MUST_HAVE_18_ITEMS" };
			}
			const ok = value.every(
				(g) =>
					/^[A-Z0-9_]{3,40}$/.test(String(g?.code ?? "")) &&
					String(g?.titleTr ?? "").trim().length >= 2 &&
					Number.isInteger(g?.coins) &&
					g.coins >= 1 &&
					g.coins <= 100000 &&
					typeof g?.active === "boolean",
			);
			return ok
				? { valid: true }
				: { valid: false, error: "INVALID_GIFT_ITEM" };
		}
		case "profession_clusters":
			return Array.isArray(value) &&
				value.length > 0 &&
				value.every(
					(c) =>
						/^[A-Z_]{3,40}$/.test(String(c?.code ?? "")) &&
						String(c?.titleTr ?? "").trim().length >= 2,
				)
				? { valid: true }
				: { valid: false, error: "INVALID_CLUSTER" };
		case "notification_templates":
			return value &&
				typeof value === "object" &&
				!Array.isArray(value) &&
				Object.entries(value).every(
					([k, t]) =>
						/^[a-z_]{3,40}$/.test(k) &&
						typeof t === "string" &&
						t.length <= 500,
				)
				? { valid: true }
				: { valid: false, error: "INVALID_TEMPLATE" };
		default:
			return { valid: false, error: "UNKNOWN_SETTING_KEY" };
	}
}

/** Self-dealing guard: an admin linked to a party user cannot act on that case. */
export function assertNotParty(linkedUserId, partyUserIds) {
	if (linkedUserId == null) return { allowed: true };
	const isParty = partyUserIds.some(
		(id) => id != null && Number(id) === Number(linkedUserId),
	);
	return isParty
		? { allowed: false, httpStatus: 403, error: "SELF_DEALING_FORBIDDEN" }
		: { allowed: true };
}

/** Four-eyes rule for escrow release/refund and payout batches. */
export function evaluateDualApproval(policy, { requestedByAdminId, approver }) {
	const perm = evaluateAdminPermission(policy, approver.role, "escrow.approve");
	if (!perm.allowed)
		return { allowed: false, httpStatus: 403, error: "FORBIDDEN" };
	if (Number(approver.id) === Number(requestedByAdminId)) {
		return { allowed: false, httpStatus: 403, error: "FOUR_EYES_REQUIRED" };
	}
	return { allowed: true, httpStatus: 200 };
}

/** Builds a release/refund approval request exactly like api/admin/escrow.php. */
export function buildEscrowApprovalRequest(type, totalKurus, feeBps) {
	if (type === "ESCROW_RELEASE") {
		const s = splitKurus(totalKurus, feeBps);
		return {
			amountKurus: totalKurus,
			proNetKurus: s.netKurus,
			platformFeeKurus: s.feeKurus,
			customerRefundKurus: 0,
		};
	}
	if (type === "ESCROW_REFUND") {
		return {
			amountKurus: totalKurus,
			proNetKurus: 0,
			platformFeeKurus: 0,
			customerRefundKurus: totalKurus,
		};
	}
	throw new Error("INVALID_TYPE");
}

/** Escrow state machine (mirror of can_transition_escrow in PHP). */
const ESCROW_TRANSITIONS = {
	PENDING_PAYMENT: ["FUNDS_HELD_IN_POOL"],
	FUNDS_HELD_IN_POOL: ["WORK_IN_PROGRESS", "REFUNDED"],
	WORK_IN_PROGRESS: ["CUSTOMER_APPROVED_RELEASED", "DISPUTED"],
	DISPUTED: ["CUSTOMER_APPROVED_RELEASED", "REFUNDED"],
	CUSTOMER_APPROVED_RELEASED: [],
	REFUNDED: [],
};

export function canTransitionEscrowState(from, to) {
	return (ESCROW_TRANSITIONS[from] ?? []).includes(to);
}

/** Integer-kuruş port of resolveEscrowDisputeCase used for the admin suggestion. */
export function suggestDisputeDecision(
	totalKurus,
	evidence,
	completionPct,
	feeBps,
) {
	if (!Number.isInteger(totalKurus) || totalKurus <= 0) {
		throw new Error("DISPUTE_ESCROW_AMOUNT_REQUIRED");
	}
	const photos = Boolean(evidence.beforePhoto && evidence.afterPhoto);
	if (evidence.wetSignature || (evidence.cargoWaybill && photos)) {
		return buildDisputeSettlement("RELEASE_FULL_TO_PRO", totalKurus, 0, feeBps);
	}
	const pct = Math.max(0, Math.min(100, Math.trunc(completionPct || 0)));
	if (pct > 0 && photos) {
		return buildDisputeSettlement(
			"PARTIAL_SETTLEMENT",
			totalKurus,
			pct,
			feeBps,
		);
	}
	return buildDisputeSettlement(
		"FULL_REFUND_TO_CUSTOMER",
		totalKurus,
		0,
		feeBps,
	);
}

export function buildDisputeSettlement(
	decision,
	totalKurus,
	completionPct,
	feeBps,
) {
	if (decision === "RELEASE_FULL_TO_PRO") {
		const s = splitKurus(totalKurus, feeBps);
		return {
			decision,
			customerRefundKurus: 0,
			proPayoutKurus: s.netKurus,
			platformFeeKurus: s.feeKurus,
			nextState: "CUSTOMER_APPROVED_RELEASED",
		};
	}
	if (decision === "PARTIAL_SETTLEMENT") {
		if (!(completionPct >= 1 && completionPct <= 99)) {
			throw new Error("COMPLETION_PCT_REQUIRED");
		}
		const proGross = Math.floor((totalKurus * completionPct + 50) / 100);
		const s = splitKurus(proGross, feeBps);
		return {
			decision,
			customerRefundKurus: totalKurus - proGross,
			proPayoutKurus: s.netKurus,
			platformFeeKurus: s.feeKurus,
			nextState: "CUSTOMER_APPROVED_RELEASED",
		};
	}
	if (decision === "FULL_REFUND_TO_CUSTOMER") {
		return {
			decision,
			customerRefundKurus: totalKurus,
			proPayoutKurus: 0,
			platformFeeKurus: 0,
			nextState: "REFUNDED",
		};
	}
	throw new Error("INVALID_DECISION");
}

/** Gift loop detection (A->B->...->A). Mirror of admin_detect_gift_cycles(). */
export function detectGiftCycles(edges, maxLength = 4) {
	const graph = new Map();
	for (const { sender, streamer } of edges) {
		if (sender === streamer) continue;
		if (!graph.has(sender)) graph.set(sender, new Set());
		graph.get(sender).add(streamer);
	}
	const found = [];
	const seen = new Set();
	for (const start of graph.keys()) {
		const stack = [[start, [start]]];
		while (stack.length > 0) {
			const [node, path] = stack.pop();
			for (const next of graph.get(node) ?? []) {
				if (next === start && path.length >= 2) {
					const sig = [...path].sort((a, b) => a - b).join("-");
					if (!seen.has(sig)) {
						seen.add(sig);
						found.push(path);
					}
				} else if (!path.includes(next) && path.length < maxLength) {
					stack.push([next, [...path, next]]);
				}
			}
		}
	}
	return found;
}

/** 85/15 gift split report grouped by profession cluster, with a conservation flag. */
export function aggregateGiftSplit(giftRows) {
	const byCluster = new Map();
	for (const g of giftRows) {
		const cur = byCluster.get(g.clusterCode) ?? {
			clusterCode: g.clusterCode,
			txCount: 0,
			grossKurus: 0,
			creatorNetKurus: 0,
			platformFeeKurus: 0,
		};
		cur.txCount += 1;
		cur.grossKurus += g.grossKurus;
		cur.creatorNetKurus += g.creatorNetKurus;
		cur.platformFeeKurus += g.platformFeeKurus;
		byCluster.set(g.clusterCode, cur);
	}
	return [...byCluster.values()]
		.map((r) => ({
			...r,
			conserved: r.creatorNetKurus + r.platformFeeKurus === r.grossKurus,
		}))
		.sort((a, b) => b.grossKurus - a.grossKurus);
}

const ESCROW_BLOCKING_STATES = new Set([
	"PENDING_PAYMENT",
	"FUNDS_HELD_IN_POOL",
	"WORK_IN_PROGRESS",
	"DISPUTED",
]);

/** KVKK deletion: blocked while any of the user's jobs still has money in the pool. */
export function evaluateUserDeletion(escrowStatuses) {
	const blocked = escrowStatuses.some((s) => ESCROW_BLOCKING_STATES.has(s));
	return blocked
		? {
				allowed: false,
				httpStatus: 409,
				error: "ACTIVE_ESCROW_BLOCKS_DELETION",
			}
		: { allowed: true, httpStatus: 200 };
}

export function validateKycDecision({ currentStatus, decision, reason }) {
	if (!["approve", "reject"].includes(decision)) {
		return { valid: false, error: "INVALID_DECISION" };
	}
	if (currentStatus !== "PENDING_REVIEW") {
		return { valid: false, error: "KYC_NOT_PENDING" };
	}
	if (decision === "reject" && String(reason ?? "").trim().length < 10) {
		return { valid: false, error: "REASON_REQUIRED" };
	}
	return {
		valid: true,
		nextStatus: decision === "approve" ? "VERIFIED_ALGORITHMIC" : "REJECTED",
	};
}

const MODERATION_STATUS = {
	hide: "HIDDEN",
	delete: "DELETED",
	warn: "WARNED",
	dismiss: "DISMISSED",
};

export function resolveModerationDecision(decision, currentStatus) {
	if (!MODERATION_STATUS[decision])
		return { valid: false, error: "INVALID_DECISION" };
	if (currentStatus !== "OPEN")
		return { valid: false, error: "REPORT_NOT_OPEN" };
	return {
		valid: true,
		nextStatus: MODERATION_STATUS[decision],
		contentState:
			decision === "hide" ? "HIDDEN" : decision === "delete" ? "DELETED" : null,
	};
}

/** Payout batch totals with conservation and self-dealing checks. */
export function buildPayoutBatch(items, adminLinkedUserId) {
	const guard = assertNotParty(
		adminLinkedUserId,
		items.map((i) => i.masterId),
	);
	if (!guard.allowed) return { valid: false, ...guard };
	const grossKurus = items.reduce((s, i) => s + i.grossKurus, 0);
	const proNetKurus = items.reduce((s, i) => s + i.proNetKurus, 0);
	const platformFeeKurus = items.reduce((s, i) => s + i.platformFeeKurus, 0);
	if (proNetKurus + platformFeeKurus !== grossKurus) {
		return { valid: false, error: "KURUS_CONSERVATION_VIOLATION" };
	}
	return {
		valid: true,
		itemsCount: items.length,
		grossKurus,
		proNetKurus,
		platformFeeKurus,
	};
}

/** Dashboard KPIs computed from raw rows (same definitions as api/admin/dashboard.php). */
export function computeDashboardKpis(data, nowIso) {
	const now = new Date(nowIso);
	const startOfDay = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
	);
	const weekStart = startOfDay - 6 * 86_400_000;
	const sum = (rows, f) => rows.reduce((s, r) => s + f(r), 0);
	const released = data.ledger.filter(
		(l) => l.escrowStatus === "USTAYA_AKTARILDI",
	);
	return {
		revenueTodayKurus: sum(
			data.escrowTx.filter((t) => Date.parse(t.createdAt) >= startOfDay),
			(t) => t.amountKurus,
		),
		revenueWeekKurus: sum(
			data.escrowTx.filter((t) => Date.parse(t.createdAt) >= weekStart),
			(t) => t.amountKurus,
		),
		heldInPoolKurus: sum(
			data.escrowTx.filter((t) => t.status === "HELD"),
			(t) => t.amountKurus,
		),
		releasedToProKurus: sum(released, (l) => l.subMerchantShareKurus),
		platformRevenueKurus:
			sum(released, (l) => l.platformCommissionKurus) +
			sum(data.gifts, (g) => g.platformFeeKurus),
		activeLiveStreams: data.streams.filter((s) => s.status === "LIVE").length,
		openUrgentJobs: data.urgent.filter((u) => u.status === "OPEN").length,
		pendingKyc: data.kyc.filter((k) => k.status === "PENDING_REVIEW").length,
		openDisputes: data.requests.filter((r) => r.escrowStatus === "DISPUTED")
			.length,
	};
}

/** Client-side filter for the users table (server applies the same filters in SQL). */
export function filterUsers(rows, { q = "", role = "", status = "" } = {}) {
	const needle = q.trim().toLocaleLowerCase("tr-TR");
	return rows.filter(
		(u) =>
			(needle === "" ||
				u.fullName.toLocaleLowerCase("tr-TR").includes(needle) ||
				u.email.toLocaleLowerCase("tr-TR").includes(needle)) &&
			(role === "" || u.role === role) &&
			(status === "" ||
				(status === "suspended" && u.isSuspended) ||
				(status === "active" && !u.isSuspended && u.isActive)),
	);
}

/** Sealed bids: amounts are stripped unless the role holds tenders.view_sealed. */
export function presentSealedBids(policy, role, bids) {
	const canSee = evaluateAdminPermission(
		policy,
		role,
		"tenders.view_sealed",
	).allowed;
	return bids.map((b) =>
		canSee
			? b
			: {
					proformaRefCode: b.proformaRefCode,
					supplierCompanyTitle: b.supplierCompanyTitle,
					sealed: true,
				},
	);
}

/** Neutralises spreadsheet formula injection in CSV exports (mirror of finance.php). */
export function csvSafeCell(value) {
	const s = String(value ?? "");
	return /^[=+\-@]/.test(s) ? `'${s}` : s;
}
