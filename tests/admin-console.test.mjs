import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
	aggregateGiftSplit,
	assertNotParty,
	buildDisputeSettlement,
	buildEscrowApprovalRequest,
	buildPayoutBatch,
	canTransitionEscrowState,
	computeDashboardKpis,
	csvSafeCell,
	detectGiftCycles,
	evaluateAdminPermission,
	evaluateDualApproval,
	evaluateUserDeletion,
	filterUsers,
	formatTl,
	maskEmail,
	maskIban,
	maskPhone,
	maskTckn,
	milestonesKurus,
	presentSealedBids,
	resolveModerationDecision,
	resolveSettingAt,
	splitKurus,
	suggestDisputeDecision,
	validateKycDecision,
	validateSettingChange,
} from "../admin/admin-domain.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
const policy = JSON.parse(
	fs.readFileSync(
		path.join(projectRoot, "includes/admin-rbac-policy.json"),
		"utf8",
	),
);

describe("Ustanomi Admin Console — RBAC, Kuruş Conservation & 11-Module Suite", () => {
	it("enforces RBAC permissions for all 4 roles and rejects unauthorized roles with 403", () => {
		assert.deepEqual(policy.roles, [
			"SUPER_ADMIN",
			"FINANCE",
			"MODERATOR",
			"SUPPORT",
		]);

		// FINANCE can move money, cannot delete users or read audit logs
		assert.equal(
			evaluateAdminPermission(policy, "FINANCE", "escrow.request").httpStatus,
			200,
		);
		assert.equal(
			evaluateAdminPermission(policy, "FINANCE", "users.delete").httpStatus,
			403,
		);
		assert.equal(
			evaluateAdminPermission(policy, "FINANCE", "audit.view").httpStatus,
			403,
		);

		// MODERATOR can review KYC & suspend live streams, cannot touch money
		assert.equal(
			evaluateAdminPermission(policy, "MODERATOR", "kyc.decide").httpStatus,
			200,
		);
		assert.equal(
			evaluateAdminPermission(policy, "MODERATOR", "live.suspend").httpStatus,
			200,
		);
		assert.equal(
			evaluateAdminPermission(policy, "MODERATOR", "escrow.request").httpStatus,
			403,
		);
		assert.equal(
			evaluateAdminPermission(policy, "MODERATOR", "tenders.view_sealed")
				.httpStatus,
			403,
		);

		// SUPPORT can view & add notes, cannot reveal PII or suspend/delete
		assert.equal(
			evaluateAdminPermission(policy, "SUPPORT", "users.note").httpStatus,
			200,
		);
		assert.equal(
			evaluateAdminPermission(policy, "SUPPORT", "pii.reveal").httpStatus,
			403,
		);
		assert.equal(
			evaluateAdminPermission(policy, "SUPPORT", "users.suspend").httpStatus,
			403,
		);

		// Only SUPER_ADMIN can read audit logs, edit settings, and manage admins
		assert.equal(
			evaluateAdminPermission(policy, "SUPER_ADMIN", "audit.view").httpStatus,
			200,
		);
		assert.equal(
			evaluateAdminPermission(policy, "SUPER_ADMIN", "settings.edit")
				.httpStatus,
			200,
		);
		assert.equal(
			evaluateAdminPermission(policy, "FINANCE", "settings.edit").httpStatus,
			403,
		);
	});

	it("verifies every api/admin/*.php endpoint enforces server-side RBAC, CSRF, and policy-registered permissions", () => {
		const adminApiDir = path.join(projectRoot, "api/admin");
		const files = fs.readdirSync(adminApiDir).filter((f) => f.endsWith(".php"));
		assert.equal(files.length >= 12, true);

		for (const file of files) {
			const content = fs.readFileSync(path.join(adminApiDir, file), "utf8");
			assert.equal(
				content.includes("admin_endpoint_headers();"),
				true,
				`${file} must call admin_endpoint_headers()`,
			);
			if (file !== "auth.php") {
				assert.equal(
					content.includes("require_admin_permission("),
					true,
					`${file} must call require_admin_permission()`,
				);
			}
			for (const match of content.matchAll(
				/require_admin_permission\('([^']+)'\)/g,
			)) {
				const perm = match[1];
				assert.equal(
					Array.isArray(policy.permissions[perm]),
					true,
					`Permission ${perm} in ${file} must exist in admin-rbac-policy.json`,
				);
			}
		}
	});

	it("preserves integer kuruş conservation across splits, 30/40/30 milestones, dual approvals, disputes, and payout batches", () => {
		for (const total of [1, 33, 100, 999, 12345, 1900000, 9999999]) {
			const s = splitKurus(total, 1200);
			assert.equal(s.netKurus + s.feeKurus, total);

			const ms = milestonesKurus(total);
			assert.equal(ms[0] + ms[1] + ms[2], total);

			const rel = buildEscrowApprovalRequest("ESCROW_RELEASE", total, 1200);
			assert.equal(
				rel.proNetKurus + rel.platformFeeKurus + rel.customerRefundKurus,
				total,
			);

			const partial = buildDisputeSettlement(
				"PARTIAL_SETTLEMENT",
				total,
				37,
				1200,
			);
			assert.equal(
				partial.customerRefundKurus +
					partial.proPayoutKurus +
					partial.platformFeeKurus,
				total,
			);
		}
		assert.equal(formatTl(1900000), "19.000,00 ₺");
		assert.equal(
			canTransitionEscrowState("WORK_IN_PROGRESS", "DISPUTED"),
			true,
		);
		assert.equal(
			canTransitionEscrowState("REFUNDED", "WORK_IN_PROGRESS"),
			false,
		);
	});

	it("enforces four-eyes dual approval and self-dealing guard", () => {
		const sameAdmin = evaluateDualApproval(policy, {
			requestedByAdminId: 2,
			approver: { id: 2, role: "FINANCE" },
		});
		assert.equal(sameAdmin.allowed, false);
		assert.equal(sameAdmin.error, "FOUR_EYES_REQUIRED");

		const secondFinance = evaluateDualApproval(policy, {
			requestedByAdminId: 2,
			approver: { id: 5, role: "FINANCE" },
		});
		assert.equal(secondFinance.allowed, true);

		assert.equal(
			assertNotParty(102, [101, 102]).error,
			"SELF_DEALING_FORBIDDEN",
		);
		assert.equal(assertNotParty(999, [101, 102]).allowed, true);

		const batchBlocked = buildPayoutBatch(
			[
				{
					masterId: 101,
					grossKurus: 10000,
					proNetKurus: 8800,
					platformFeeKurus: 1200,
				},
			],
			101,
		);
		assert.equal(batchBlocked.valid, false);
		assert.equal(batchBlocked.error, "SELF_DEALING_FORBIDDEN");
	});

	it("handles KVKK masking, deletion escrow lock, KYC validation, moderation, sealed bids, and CSV safety", () => {
		assert.equal(maskPhone("05321112233"), "*********33");
		assert.equal(maskTckn("10000000146"), "10*******46");
		assert.equal(
			maskIban("TR330006100519786457841326").startsWith("TR33****"),
			true,
		);
		assert.equal(maskEmail("selim@ustanomi.com"), "s***@ustanomi.com");

		assert.equal(evaluateUserDeletion(["WORK_IN_PROGRESS"]).httpStatus, 409);
		assert.equal(
			evaluateUserDeletion(["CUSTOMER_APPROVED_RELEASED"]).httpStatus,
			200,
		);

		assert.equal(
			validateKycDecision({
				currentStatus: "PENDING_REVIEW",
				decision: "reject",
				reason: "kısa",
			}).error,
			"REASON_REQUIRED",
		);
		assert.equal(
			validateKycDecision({
				currentStatus: "PENDING_REVIEW",
				decision: "approve",
			}).nextStatus,
			"VERIFIED_ALGORITHMIC",
		);

		assert.equal(
			resolveModerationDecision("hide", "OPEN").contentState,
			"HIDDEN",
		);
		assert.equal(
			resolveModerationDecision("delete", "OPEN").contentState,
			"DELETED",
		);

		const bids = [
			{
				proformaRefCode: "PRF-1",
				supplierCompanyTitle: "A",
				grandTotalKurus: 50000,
			},
		];
		assert.equal(presentSealedBids(policy, "MODERATOR", bids)[0].sealed, true);
		assert.equal(
			presentSealedBids(policy, "FINANCE", bids)[0].grandTotalKurus,
			50000,
		);

		assert.equal(csvSafeCell("=CMD()"), "'=CMD()");
		assert.equal(
			filterUsers(
				[
					{
						fullName: "Selim",
						email: "a@b.c",
						role: "MASTER",
						isSuspended: false,
						isActive: true,
					},
				],
				{ q: "selim" },
			).length,
			1,
		);
	});

	it("detects live gift cycles, verifies 85/15 split, prevents retroactive rate changes, and computes dashboard KPIs", () => {
		const cycles = detectGiftCycles([
			{ sender: 101, streamer: 102 },
			{ sender: 102, streamer: 101 },
		]);
		assert.equal(cycles.length, 1);

		const split = aggregateGiftSplit([
			{
				clusterCode: "AUTO_LOGISTICS",
				grossKurus: 50000,
				creatorNetKurus: 42500,
				platformFeeKurus: 7500,
			},
		]);
		assert.equal(split[0].conserved, true);

		const nowMs = Date.parse("2026-11-26T00:00:00Z");
		assert.equal(
			validateSettingChange(
				"escrow_platform_fee_bps",
				1000,
				nowMs - 3600_000,
				nowMs,
			).error,
			"RETROACTIVE_CHANGE_FORBIDDEN",
		);
		const versions = [
			{
				key: "escrow_platform_fee_bps",
				value: 1200,
				effectiveFrom: "2026-11-01T00:00:00Z",
			},
			{
				key: "escrow_platform_fee_bps",
				value: 1000,
				effectiveFrom: "2026-12-01T00:00:00Z",
			},
		];
		assert.equal(
			resolveSettingAt(
				versions,
				"escrow_platform_fee_bps",
				"2026-11-15T00:00:00Z",
				1200,
			),
			1200,
		);
		assert.equal(
			resolveSettingAt(
				versions,
				"escrow_platform_fee_bps",
				"2026-12-05T00:00:00Z",
				1200,
			),
			1000,
		);

		const sug = suggestDisputeDecision(
			100000,
			{ wetSignature: true, beforePhoto: false, afterPhoto: false },
			0,
			1200,
		);
		assert.equal(sug.decision, "RELEASE_FULL_TO_PRO");

		const kpis = computeDashboardKpis(
			{
				escrowTx: [
					{
						amountKurus: 100000,
						status: "HELD",
						createdAt: "2026-11-26T00:01:00Z",
					},
				],
				ledger: [
					{
						escrowStatus: "USTAYA_AKTARILDI",
						subMerchantShareKurus: 88000,
						platformCommissionKurus: 12000,
					},
				],
				gifts: [{ platformFeeKurus: 7500 }],
				streams: [{ status: "LIVE" }],
				urgent: [{ status: "OPEN" }],
				kyc: [{ status: "PENDING_REVIEW" }],
				requests: [{ escrowStatus: "DISPUTED" }],
			},
			"2026-11-26T00:10:00Z",
		);
		assert.equal(kpis.heldInPoolKurus, 100000);
		assert.equal(kpis.platformRevenueKurus, 19500);
	});
});
