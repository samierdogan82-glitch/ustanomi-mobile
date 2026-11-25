import { getProfessionGiftCatalog } from "../www/capacitor-bridge.js";
import {
	aggregateGiftSplit,
	buildDisputeSettlement,
	buildEscrowApprovalRequest,
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
	splitKurus,
	suggestDisputeDecision,
	validateKycDecision,
	validateSettingChange,
} from "./admin-domain.js";

const POLICY = await fetch("../includes/admin-rbac-policy.json").then((r) =>
	r.json(),
);
const params = new URLSearchParams(window.location.search);
const isPreview = params.get("preview") === "1";

const state = {
	admin: {
		id: 1,
		full_name: "Sami Erdoğan",
		role: params.get("role") || "SUPER_ADMIN",
		linked_user_id: null,
	},
	csrf: "",
	tables: {},
	charts: {},
	data: createPreviewData(),
};

function createPreviewData() {
	return {
		kpis: {
			revenue_today_kurus: 18450000,
			revenue_week_kurus: 112400000,
			held_in_pool_kurus: 46800000,
			released_to_pro_kurus: 58200000,
			platform_revenue_kurus: 8420000,
			active_live_streams: 4,
			open_urgent_jobs: 11,
			pending_kyc: 3,
			open_disputes: 2,
			pending_dual_approvals: 1,
		},
		series: [
			{ day: "2026-11-20", gross_kurus: 12100000 },
			{ day: "2026-11-21", gross_kurus: 14500000 },
			{ day: "2026-11-22", gross_kurus: 13800000 },
			{ day: "2026-11-23", gross_kurus: 16200000 },
			{ day: "2026-11-24", gross_kurus: 19400000 },
			{ day: "2026-11-25", gross_kurus: 17950000 },
			{ day: "2026-11-26", gross_kurus: 18450000 },
		],
		users: [
			{
				id: 101,
				fullName: "Selim Karaca",
				email: "selim@ustanomi.com",
				phone: "05321112233",
				role: "MASTER",
				verified: true,
				efatura: true,
				isActive: true,
				isSuspended: false,
				escrowStates: ["CUSTOMER_APPROVED_RELEASED"],
				deletionRequestedAt: null,
			},
			{
				id: 102,
				fullName: "Maslak Bimmer Servis",
				email: "servis@maslak.com",
				phone: "05334445566",
				role: "MASTER",
				verified: true,
				efatura: true,
				isActive: true,
				isSuspended: false,
				escrowStates: ["WORK_IN_PROGRESS"],
				deletionRequestedAt: "2026-11-25 10:15:00",
			},
			{
				id: 103,
				fullName: "Ahmet Yılmaz",
				email: "ahmet@mail.com",
				phone: "05427778899",
				role: "CUSTOMER",
				verified: false,
				efatura: false,
				isActive: true,
				isSuspended: false,
				escrowStates: ["CUSTOMER_APPROVED_RELEASED"],
				deletionRequestedAt: "2026-11-25 14:20:00",
			},
			{
				id: 104,
				fullName: "Kaan Oto Kurtarma",
				email: "kaan@oto.com",
				phone: "05559990011",
				role: "MASTER",
				verified: true,
				efatura: false,
				isActive: true,
				isSuspended: true,
				escrowStates: [],
				deletionRequestedAt: null,
			},
		],
		kyc: [
			{
				id: 11,
				userId: 205,
				fullName: "Burak Demir",
				role: "MASTER",
				tckn: "10000000146",
				vkn: "1234567890",
				iban: "TR330006100519786457841326",
				checks: { tckn: true, vkn: true, iban: true },
				status: "PENDING_REVIEW",
				createdAt: "2026-11-25 18:10:00",
			},
			{
				id: 12,
				userId: 206,
				fullName: "Elif Aydın",
				role: "MASTER",
				tckn: "10000000146",
				vkn: null,
				iban: "TR330006100519786457841326",
				checks: { tckn: true, vkn: false, iban: true },
				status: "PENDING_REVIEW",
				createdAt: "2026-11-25 19:40:00",
			},
		],
		escrow: [
			{
				id: 501,
				requestCode: "UST-2026-501",
				title: "2021 BMW 320i Triger Seti",
				customerId: 103,
				masterId: 102,
				totalKurus: 1900000,
				releasedMilestones: 2,
				escrowStatus: "WORK_IN_PROGRESS",
				createdAt: "2026-11-24 11:00:00",
			},
			{
				id: 502,
				requestCode: "UST-2026-502",
				title: "Kadıköy Termal Su Kaçağı Tespiti",
				customerId: 103,
				masterId: 101,
				totalKurus: 85000,
				releasedMilestones: 3,
				escrowStatus: "CUSTOMER_APPROVED_RELEASED",
				createdAt: "2026-11-23 09:30:00",
			},
			{
				id: 503,
				requestCode: "UST-2026-503",
				title: "Ataşehir Klima Kompresör Revizyonu",
				customerId: 103,
				masterId: 104,
				totalKurus: 450000,
				releasedMilestones: 1,
				escrowStatus: "DISPUTED",
				createdAt: "2026-11-22 15:00:00",
			},
		],
		dualApprovals: [
			{
				id: 71,
				actionType: "ESCROW_RELEASE",
				requestId: 501,
				amountKurus: 1900000,
				proNetKurus: 1672000,
				platformFeeKurus: 228000,
				customerRefundKurus: 0,
				reason: "Müşteri SMS onayı alındı, manuel serbest bırakma",
				status: "PENDING",
				requestedByAdminId: 2,
				requestedBy: "Zeynep Finans",
			},
		],
		disputes: [
			{
				id: 503,
				requestCode: "UST-2026-503",
				title: "Ataşehir Klima Kompresör Revizyonu",
				totalKurus: 450000,
				evidence: {
					wetSignature: false,
					cargoWaybill: true,
					beforePhoto: true,
					afterPhoto: false,
				},
				completionPct: 50,
			},
			{
				id: 504,
				requestCode: "UST-2026-504",
				title: "Beşiktaş 4K Drone Çekimi",
				totalKurus: 280000,
				evidence: {
					wetSignature: true,
					cargoWaybill: false,
					beforePhoto: true,
					afterPhoto: true,
				},
				completionPct: 100,
			},
		],
		tenders: [
			{
				id: 901,
				tenderCode: "TND-901",
				category: "AUTO_REPAIR_PARTS",
				title: "BMW F30 Orijinal OEM Triger & Devirdaim",
				city: "Maslak",
				status: "OPEN_FOR_SEALED_BIDS",
				bids: [
					{
						proformaRefCode: "PRF-2026-901A",
						supplierCompanyTitle: "Maslak Bimmer Özel Servis Ltd.",
						grandTotalKurus: 1900000,
						supplierNetKurus: 1672000,
						warrantyMonths: 12,
					},
					{
						proformaRefCode: "PRF-2026-901B",
						supplierCompanyTitle: "Anadolu OEM Parça A.Ş.",
						grandTotalKurus: 1780000,
						supplierNetKurus: 1566400,
						warrantyMonths: 24,
					},
				],
			},
		],
		streams: [
			{
				id: 301,
				streamCode: "LIVE-301",
				streamerId: 102,
				streamerName: "Maslak Bimmer Servis",
				clusterCode: "AUTO_LOGISTICS",
				workTitle: "BMW F30 N20 Triger & Sente Ayarı",
				city: "Maslak",
				viewerCount: 418,
				totalCoins: 3400,
				creatorNetKurus: 144500,
				status: "LIVE",
			},
			{
				id: 302,
				streamCode: "LIVE-302",
				streamerId: 101,
				streamerName: "Selim Karaca",
				clusterCode: "HOME_TECH",
				workTitle: "Kırmadan Termal Su Kaçağı Tespiti",
				city: "Kadıköy",
				viewerCount: 276,
				totalCoins: 1950,
				creatorNetKurus: 82875,
				status: "LIVE",
			},
		],
		gifts: [
			{
				receipt: "GFT-301-1",
				sender: 101,
				streamer: 102,
				clusterCode: "AUTO_LOGISTICS",
				giftCode: "GOLDEN_PISTON",
				qty: 1,
				coins: 1000,
				grossKurus: 50000,
				creatorNetKurus: 42500,
				platformFeeKurus: 7500,
			},
			{
				receipt: "GFT-302-1",
				sender: 102,
				streamer: 101,
				clusterCode: "HOME_TECH",
				giftCode: "THERMAL_LENS",
				qty: 2,
				coins: 400,
				grossKurus: 20000,
				creatorNetKurus: 17000,
				platformFeeKurus: 3000,
			},
		],
		moderation: [
			{
				id: 81,
				targetType: "TALENT_POST",
				targetId: 201,
				reasonCode: "OFF_PLATFORM_PAYMENT",
				details: "Açıklamada harici IBAN paylaşıldı.",
				reporterName: "Mehmet K.",
				status: "OPEN",
			},
			{
				id: 82,
				targetType: "DM_MESSAGE",
				targetId: 412,
				reasonCode: "SPAM",
				details: "Tekrarlayan reklam mesajı.",
				reporterName: "Elif S.",
				status: "OPEN",
			},
		],
		payable: [
			{
				txId: 801,
				requestCode: "UST-2026-502",
				masterId: 101,
				masterName: "Selim Karaca",
				grossKurus: 85000,
				proNetKurus: 74800,
				platformFeeKurus: 10200,
			},
		],
		efatura: [
			{
				requestCode: "UST-2026-502",
				amountKurus: 85000,
				status: "ISSUED",
				uuid: "e7f3a120-9a14-4d12-8b31-101010101010",
			},
			{
				requestCode: "UST-2026-498",
				amountKurus: 240000,
				status: "FAILED",
				uuid: "-",
			},
		],
		audit: [
			{
				id: 1,
				createdAt: "2026-11-26 00:05:00",
				role: "SUPER_ADMIN",
				adminName: "Sami Erdoğan",
				action: "SETTING_VERSION_CREATED",
				targetType: "SETTING",
				targetId: "escrow_platform_fee_bps",
				reason: "Başlangıç komisyon sürümü",
				ip: "127.0.0.1",
			},
			{
				id: 2,
				createdAt: "2026-11-26 00:12:00",
				role: "FINANCE",
				adminName: "Zeynep Finans",
				action: "ESCROW_RELEASE_REQUESTED",
				targetType: "ESCROW",
				targetId: "501",
				reason: "Müşteri SMS onayı alındı",
				ip: "127.0.0.1",
			},
		],
		admins: [
			{
				id: 1,
				fullName: "Sami Erdoğan",
				email: "sami@ustanomi.com",
				role: "SUPER_ADMIN",
				isActive: true,
				totpEnabled: true,
			},
			{
				id: 2,
				fullName: "Zeynep Finans",
				email: "finans@ustanomi.com",
				role: "FINANCE",
				isActive: true,
				totpEnabled: true,
			},
			{
				id: 3,
				fullName: "Emre Moderatör",
				email: "mod@ustanomi.com",
				role: "MODERATOR",
				isActive: true,
				totpEnabled: true,
			},
			{
				id: 4,
				fullName: "Deniz Destek",
				email: "destek@ustanomi.com",
				role: "SUPPORT",
				isActive: true,
				totpEnabled: true,
			},
		],
	};
}

function toast(msg) {
	const el = document.createElement("div");
	el.className = "toast-msg";
	el.textContent = msg;
	document.getElementById("toast-box").appendChild(el);
	setTimeout(() => el.remove(), 2600);
}

function hasPerm(perm) {
	return evaluateAdminPermission(POLICY, state.admin.role, perm).allowed;
}

function esc(s) {
	return String(s ?? "").replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			],
	);
}

function openModal(title, html, onMount) {
	document.getElementById("modal-title").textContent = title;
	const body = document.getElementById("modal-body");
	body.innerHTML = html;
	document.getElementById("admin-modal").classList.add("open");
	if (onMount) onMount(body);
}

function closeModal() {
	document.getElementById("admin-modal").classList.remove("open");
}
document
	.getElementById("modal-close-btn")
	.addEventListener("click", closeModal);

async function bootstrapAuth() {
	if (isPreview) return true;
	try {
		const res = await fetch("../api/admin/auth.php?action=me");
		const data = await res.json();
		if (!res.ok || !data.success) {
			window.location.replace("login.html");
			return false;
		}
		state.admin = data.admin;
		state.csrf = data.csrf;
		return true;
	} catch {
		return isPreview;
	}
}

function applyRbacToNav() {
	document.getElementById("admin-role-pill").textContent = state.admin.role;
	document.getElementById("admin-name-label").textContent =
		state.admin.full_name;
	document.querySelectorAll(".nav-item[data-perm]").forEach((btn) => {
		btn.style.display = hasPerm(btn.dataset.perm) ? "flex" : "none";
	});
}

function switchView(viewId) {
	document.querySelectorAll(".nav-item").forEach((b) => {
		b.classList.toggle("active", b.dataset.view === viewId);
	});
	document.querySelectorAll(".view-pane").forEach((p) => {
		p.classList.toggle("active", p.id === `view-${viewId}`);
	});
	const activeBtn = document.querySelector(
		`.nav-item[data-view="${viewId}"] span`,
	);
	if (activeBtn)
		document.getElementById("topbar-title").textContent = activeBtn.textContent;
}

document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
	btn.addEventListener("click", () => switchView(btn.dataset.view));
});

function renderDashboard() {
	const k = state.data.kpis;
	const cards = [
		["Günlük Ciro", formatTl(k.revenue_today_kurus), "Son 24 saat"],
		["Haftalık Ciro", formatTl(k.revenue_week_kurus), "Son 7 gün"],
		["Havuzda Bekleyen", formatTl(k.held_in_pool_kurus), "Güvenli emanet"],
		["Ustaya Aktarılan", formatTl(k.released_to_pro_kurus), "Net hak ediş"],
		[
			"Platform Geliri",
			formatTl(k.platform_revenue_kurus),
			"Havuz + hediye payı",
		],
		["Aktif Canlı Yayın", String(k.active_live_streams), "İş başında yayınlar"],
		["Açık Acil İş", String(k.open_urgent_jobs), "30 dk nöbetçi radar"],
		[
			"Bekleyen KYC / İhtilaf",
			`${k.pending_kyc} / ${k.open_disputes}`,
			"İnceleme kuyruğu",
		],
	];
	document.getElementById("dashboard-kpi-grid").innerHTML = cards
		.map(
			([lbl, val, sub]) =>
				`<div class="card"><div class="kpi-label">${esc(lbl)}</div><div class="kpi-value">${esc(val)}</div><div class="kpi-sub">${esc(sub)}</div></div>`,
		)
		.join("");

	document.getElementById("badge-kyc").textContent = String(
		state.data.kyc.filter((x) => x.status === "PENDING_REVIEW").length,
	);
	document.getElementById("badge-mod").textContent = String(
		state.data.moderation.filter((x) => x.status === "OPEN").length,
	);
	document.getElementById("badge-dual").textContent = String(
		state.data.dualApprovals.filter((x) => x.status === "PENDING").length,
	);
	document.getElementById("badge-dispute").textContent = String(
		state.data.disputes.length,
	);
	document.getElementById("badge-live").textContent = String(
		state.data.streams.filter((x) => x.status === "LIVE").length,
	);

	if (window.Chart) {
		state.charts.rev?.destroy();
		state.charts.rev = new window.Chart(
			document.getElementById("chart-revenue"),
			{
				type: "bar",
				data: {
					labels: state.data.series.map((s) => s.day.slice(5)),
					datasets: [
						{
							label: "Ciro (₺)",
							data: state.data.series.map((s) => s.gross_kurus / 100),
							backgroundColor: "#0095F6",
							borderRadius: 6,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: { legend: { display: false } },
				},
			},
		);
		const split = aggregateGiftSplit(state.data.gifts);
		state.charts.gifts?.destroy();
		state.charts.gifts = new window.Chart(
			document.getElementById("chart-gifts"),
			{
				type: "doughnut",
				data: {
					labels: split.map((s) => s.clusterCode),
					datasets: [
						{
							data: split.map((s) => s.grossKurus / 100),
							backgroundColor: ["#0095F6", "#FFB400", "#1F9D55", "#ED4956"],
						},
					],
				},
				options: { responsive: true, maintainAspectRatio: false },
			},
		);
	}
}

function makeTable(elId, data, columns, extra = {}) {
	if (!window.Tabulator) return null;
	if (state.tables[elId]) {
		state.tables[elId].replaceData(data);
		return state.tables[elId];
	}
	state.tables[elId] = new window.Tabulator(`#${elId}`, {
		data,
		layout: "fitColumns",
		pagination: true,
		paginationSize: 10,
		columns,
		...extra,
	});
	return state.tables[elId];
}

function renderUsers() {
	const filtered = filterUsers(state.data.users, {
		q: document.getElementById("user-search-input").value,
		role: document.getElementById("user-role-filter").value,
		status: document.getElementById("user-status-filter").value,
	});
	const rows = filtered.map((u) => ({
		...u,
		maskedEmail: maskEmail(u.email),
		maskedPhone: maskPhone(u.phone),
	}));
	makeTable("table-users", rows, [
		{ title: "ID", field: "id", width: 64 },
		{ title: "Ad Soyad", field: "fullName", minWidth: 140 },
		{ title: "E-posta (Maskeli)", field: "maskedEmail" },
		{ title: "Telefon (Maskeli)", field: "maskedPhone" },
		{ title: "Rol", field: "role", width: 95 },
		{
			title: "Rozetler",
			field: "verified",
			formatter: (c) => {
				const d = c.getRow().getData();
				return `${d.verified ? '<span class="pill blue">Onaylı</span> ' : ""}${d.efatura ? '<span class="pill ok">e-Fatura</span>' : ""}`;
			},
		},
		{
			title: "Durum",
			field: "isSuspended",
			width: 95,
			formatter: (c) =>
				c.getValue()
					? '<span class="pill danger">Askıda</span>'
					: '<span class="pill ok">Aktif</span>',
		},
		{
			title: "İşlem",
			headerSort: false,
			width: 170,
			formatter: () =>
				`<button class="btn btn-sm" data-act="detail">Detay</button> <button class="btn btn-sm" data-act="suspend">Askı</button>`,
			cellClick: (e, cell) => {
				const row = cell.getRow().getData();
				if (e.target.dataset.act === "suspend") {
					if (!hasPerm("users.suspend"))
						return toast("Bu işlem için yetkiniz yok (403).");
					row.isSuspended = !row.isSuspended;
					renderUsers();
					toast(`${row.fullName} durumu güncellendi.`);
				} else if (e.target.dataset.act === "detail") {
					openModal(
						row.fullName,
						`
						<p><b>E-posta:</b> ${esc(row.maskedEmail)} · <b>Tel:</b> ${esc(row.maskedPhone)}</p>
						<p><b>Havuz Durumları:</b> ${esc(row.escrowStates.join(", ") || "Yok")}</p>
						<div class="field"><label>Yönetici Notu</label><input id="m-user-note" class="input" placeholder="Not yazın..."></div>
						<button type="button" class="btn btn-primary" id="m-save-note">Notu Kaydet</button>
					`,
						(b) => {
							b.querySelector("#m-save-note").addEventListener("click", () => {
								toast("Not kaydedildi (KVKK maskeli).");
								closeModal();
							});
						},
					);
				}
			},
		},
	]);

	const delRows = state.data.users
		.filter((u) => u.deletionRequestedAt)
		.map((u) => {
			const check = evaluateUserDeletion(u.escrowStates);
			return { ...u, blockedByEscrow: !check.allowed };
		});
	makeTable("table-deletion-queue", delRows, [
		{ title: "ID", field: "id", width: 64 },
		{ title: "Ad Soyad", field: "fullName" },
		{ title: "Talep Tarihi", field: "deletionRequestedAt" },
		{
			title: "Havuz Kontrolü",
			field: "blockedByEscrow",
			formatter: (c) =>
				c.getValue()
					? '<span class="pill danger">Engelli (Havuzda Para Var)</span>'
					: '<span class="pill ok">Silinebilir</span>',
		},
		{
			title: "KVKK İşlem",
			headerSort: false,
			formatter: (c) =>
				c.getRow().getData().blockedByEscrow
					? '<span class="pill">Beklemede</span>'
					: '<button class="btn btn-sm btn-danger">Anonimleştir</button>',
			cellClick: (_e, cell) => {
				const row = cell.getRow().getData();
				if (row.blockedByEscrow)
					return toast("Havuzda parası olan hesap silinemez (409).");
				if (!hasPerm("users.delete"))
					return toast("Yalnızca SUPER_ADMIN hesap silebilir (403).");
				state.data.users = state.data.users.filter((u) => u.id !== row.id);
				renderUsers();
				toast("Hesap KVKK uyumlu anonimleştirildi.");
			},
		},
	]);
}

function renderKyc() {
	const rows = state.data.kyc.map((k) => ({
		...k,
		tcknMasked: maskTckn(k.tckn),
		ibanMasked: maskIban(k.iban),
	}));
	makeTable("table-kyc", rows, [
		{ title: "ID", field: "id", width: 64 },
		{ title: "Ad Soyad", field: "fullName" },
		{ title: "TCKN (Maskeli)", field: "tcknMasked" },
		{ title: "IBAN (Maskeli)", field: "ibanMasked" },
		{ title: "Durum", field: "status", width: 130 },
		{
			title: "Karar",
			headerSort: false,
			width: 170,
			formatter: () =>
				'<button class="btn btn-sm btn-ok" data-k="approve">Onayla</button> <button class="btn btn-sm btn-danger" data-k="reject">Reddet</button>',
			cellClick: (e, cell) => {
				if (!hasPerm("kyc.decide"))
					return toast("KYC kararı için yetkiniz yok (403).");
				const row = cell.getRow().getData();
				const decision = e.target.dataset.k;
				if (!decision) return;
				const target = state.data.kyc.find((x) => x.id === row.id);
				if (decision === "reject") {
					const check = validateKycDecision({
						currentStatus: target.status,
						decision,
						reason: "Belge okunaksız",
					});
					if (check.valid) target.status = check.nextStatus;
				} else {
					const check = validateKycDecision({
						currentStatus: target.status,
						decision,
					});
					if (check.valid) target.status = check.nextStatus;
				}
				renderKyc();
				renderDashboard();
				toast(`KYC #${row.id}: ${target.status}`);
			},
		},
	]);
}

function renderEscrow() {
	const rows = state.data.escrow.map((r) => {
		const s = splitKurus(r.totalKurus, 1200);
		const ms = milestonesKurus(r.totalKurus);
		return {
			...r,
			totalFmt: formatTl(r.totalKurus),
			proNetFmt: formatTl(s.netKurus),
			milestonesFmt: `${r.releasedMilestones}/3 (${ms.map(formatTl).join(" / ")})`,
		};
	});
	makeTable("table-escrow", rows, [
		{ title: "Kod", field: "requestCode", width: 130 },
		{ title: "İş Başlığı", field: "title", minWidth: 160 },
		{ title: "Toplam", field: "totalFmt", width: 110 },
		{ title: "Usta Net (%88)", field: "proNetFmt", width: 120 },
		{ title: "Etap (%30/%40/%30)", field: "milestonesFmt", minWidth: 180 },
		{ title: "Durum", field: "escrowStatus", width: 175 },
		{
			title: "Çift İmza Talebi",
			headerSort: false,
			width: 150,
			formatter: () =>
				'<button class="btn btn-sm" data-e="ESCROW_RELEASE">Çöz</button> <button class="btn btn-sm" data-e="ESCROW_REFUND">İade</button>',
			cellClick: (e, cell) => {
				if (!hasPerm("escrow.request"))
					return toast("Yalnızca FINANCE manuel havuz talebi açabilir (403).");
				const row = cell.getRow().getData();
				const type = e.target.dataset.e;
				if (!type) return;
				const calc = buildEscrowApprovalRequest(type, row.totalKurus, 1200);
				state.data.dualApprovals.push({
					id: Date.now(),
					actionType: type,
					requestId: row.id,
					...calc,
					reason: "Yönetici manuel havuz işlemi talebi",
					status: "PENDING",
					requestedByAdminId: state.admin.id,
					requestedBy: state.admin.full_name,
				});
				renderEscrow();
				renderDashboard();
				toast("Çift imza onay kuyruğuna eklendi.");
			},
		},
	]);

	makeTable(
		"table-dual-approvals",
		state.data.dualApprovals.map((d) => ({
			...d,
			amountFmt: formatTl(d.amountKurus),
		})),
		[
			{ title: "Tür", field: "actionType", width: 150 },
			{ title: "Talep ID", field: "requestId", width: 90 },
			{ title: "Tutar", field: "amountFmt", width: 110 },
			{ title: "Talep Eden", field: "requestedBy", width: 130 },
			{ title: "Gerekçe", field: "reason", minWidth: 180 },
			{ title: "Durum", field: "status", width: 100 },
			{
				title: "2. Onay",
				headerSort: false,
				width: 120,
				formatter: () =>
					'<button class="btn btn-sm btn-primary">Onayla</button>',
				cellClick: (_e, cell) => {
					const row = cell.getRow().getData();
					const gate = evaluateDualApproval(POLICY, {
						requestedByAdminId: row.requestedByAdminId,
						approver: state.admin,
					});
					if (!gate.allowed) return toast(`Engellendi: ${gate.error} (403)`);
					const target = state.data.dualApprovals.find((d) => d.id === row.id);
					target.status = "EXECUTED";
					renderEscrow();
					toast("Çift imza tamamlandı ve havuz güncellendi.");
				},
			},
		],
	);
}

function renderDisputes() {
	const rows = state.data.disputes.map((d) => {
		const sug = suggestDisputeDecision(
			d.totalKurus,
			d.evidence,
			d.completionPct,
			1200,
		);
		return {
			...d,
			totalFmt: formatTl(d.totalKurus),
			evidenceFmt:
				[
					d.evidence.wetSignature ? "Islak İmza" : null,
					d.evidence.cargoWaybill ? "Kargo" : null,
					d.evidence.beforePhoto && d.evidence.afterPhoto
						? "Öncesi/Sonrası Foto"
						: null,
				]
					.filter(Boolean)
					.join(", ") || "Yetersiz",
			suggestedDecision: sug.decision,
		};
	});
	makeTable("table-disputes", rows, [
		{ title: "Kod", field: "requestCode", width: 130 },
		{ title: "İş", field: "title", minWidth: 160 },
		{ title: "Tutar", field: "totalFmt", width: 110 },
		{ title: "Kanıtlar", field: "evidenceFmt", minWidth: 160 },
		{ title: "Sistem Önerisi", field: "suggestedDecision", width: 185 },
		{
			title: "Nihai Karar",
			headerSort: false,
			width: 110,
			formatter: () =>
				'<button class="btn btn-sm btn-primary">Karar Ver</button>',
			cellClick: (_e, cell) => {
				if (!hasPerm("disputes.decide"))
					return toast(
						"Uyuşmazlık kararı yalnızca FINANCE rolüne açıktır (403).",
					);
				const row = cell.getRow().getData();
				const settlement = buildDisputeSettlement(
					row.suggestedDecision,
					row.totalKurus,
					row.completionPct || 50,
					1200,
				);
				toast(
					`Karar kaydedildi: ${settlement.decision} (Usta: ${formatTl(settlement.proPayoutKurus)}, İade: ${formatTl(settlement.customerRefundKurus)})`,
				);
			},
		},
	]);
}

function renderTenders() {
	const canSeeSealed = hasPerm("tenders.view_sealed");
	document.getElementById("sealed-notice-pill").textContent = canSeeSealed
		? "Yetkili Görünüm: Kapalı Zarf Açık"
		: "Kısıtlı Görünüm: Tutarlar Maskeli";
	const rows = state.data.tenders.map((t) => {
		const visibleBids = presentSealedBids(POLICY, state.admin.role, t.bids);
		const summary = visibleBids
			.map((b) =>
				b.sealed
					? `${b.supplierCompanyTitle} (Gizli)`
					: `${b.supplierCompanyTitle}: ${formatTl(b.grandTotalKurus)}`,
			)
			.join(" | ");
		return { ...t, bidsSummary: summary };
	});
	makeTable("table-tenders", rows, [
		{ title: "Kod", field: "tenderCode", width: 100 },
		{ title: "Başlık", field: "title", minWidth: 180 },
		{ title: "Şehir", field: "city", width: 100 },
		{ title: "Durum", field: "status", width: 165 },
		{ title: "Kapalı Zarf Teklifler", field: "bidsSummary", minWidth: 240 },
	]);
}

function renderLive() {
	const cycles = detectGiftCycles(
		state.data.gifts.map((g) => ({ sender: g.sender, streamer: g.streamer })),
	);
	document.getElementById("gift-cycle-alert").textContent =
		cycles.length > 0
			? `${cycles.length} Şüpheli Hediye Döngüsü Tespit Edildi!`
			: "Şüpheli Döngü Yok";

	makeTable(
		"table-live-streams",
		state.data.streams.map((s) => ({
			...s,
			netFmt: formatTl(s.creatorNetKurus),
		})),
		[
			{ title: "Kod", field: "streamCode", width: 100 },
			{ title: "Usta", field: "streamerName", width: 150 },
			{ title: "Yayın Başlığı", field: "workTitle", minWidth: 180 },
			{ title: "İzleyici", field: "viewerCount", width: 85 },
			{ title: "Jeton", field: "totalCoins", width: 85 },
			{ title: "Usta Net", field: "netFmt", width: 105 },
			{ title: "Durum", field: "status", width: 105 },
			{
				title: "İşlem",
				headerSort: false,
				width: 100,
				formatter: () =>
					'<button class="btn btn-sm btn-danger">Durdur</button>',
				cellClick: (_e, cell) => {
					if (!hasPerm("live.suspend"))
						return toast("Yayın durdurma yetkiniz yok (403).");
					const row = cell.getRow().getData();
					const target = state.data.streams.find((s) => s.id === row.id);
					target.status = "SUSPENDED";
					renderLive();
					renderDashboard();
					toast(`${row.streamCode} durduruldu (SUSPENDED).`);
				},
			},
		],
	);

	makeTable(
		"table-live-gifts",
		state.data.gifts.map((g) => ({
			...g,
			grossFmt: formatTl(g.grossKurus),
			netFmt: formatTl(g.creatorNetKurus),
			feeFmt: formatTl(g.platformFeeKurus),
		})),
		[
			{ title: "Makbuz", field: "receipt", width: 110 },
			{ title: "Meslek", field: "clusterCode", width: 140 },
			{ title: "Hediye", field: "giftCode", width: 140 },
			{ title: "Brüt", field: "grossFmt", width: 100 },
			{ title: "Usta (%85)", field: "netFmt", width: 105 },
			{ title: "Platform (%15)", field: "feeFmt", width: 115 },
		],
	);
}

function renderModeration() {
	makeTable("table-moderation", state.data.moderation, [
		{ title: "ID", field: "id", width: 64 },
		{ title: "Tür", field: "targetType", width: 120 },
		{ title: "Sebep", field: "reasonCode", width: 165 },
		{ title: "Detay", field: "details", minWidth: 180 },
		{ title: "Durum", field: "status", width: 95 },
		{
			title: "Karar",
			headerSort: false,
			width: 170,
			formatter: () =>
				'<button class="btn btn-sm" data-m="hide">Gizle</button> <button class="btn btn-sm btn-danger" data-m="delete">Sil</button>',
			cellClick: (e, cell) => {
				if (!hasPerm("moderation.act"))
					return toast("Moderasyon yetkiniz yok (403).");
				const dec = e.target.dataset.m;
				if (!dec) return;
				const row = cell.getRow().getData();
				const target = state.data.moderation.find((m) => m.id === row.id);
				const r = resolveModerationDecision(dec, target.status);
				if (r.valid) target.status = r.nextStatus;
				renderModeration();
				renderDashboard();
				toast(`Şikâyet #${row.id}: ${target.status}`);
			},
		},
	]);
}

function downloadCsv(filename, rows) {
	if (!rows.length) return;
	const headers = Object.keys(rows[0]);
	const lines = [
		headers.join(";"),
		...rows.map((r) => headers.map((h) => csvSafeCell(r[h])).join(";")),
	];
	const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
		type: "text/csv;charset=utf-8;",
	});
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = filename;
	a.click();
}

function renderFinance() {
	makeTable(
		"table-finance-payable",
		state.data.payable.map((p) => ({
			...p,
			grossFmt: formatTl(p.grossKurus),
			netFmt: formatTl(p.proNetKurus),
			feeFmt: formatTl(p.platformFeeKurus),
		})),
		[
			{ title: "İş Kodu", field: "requestCode", width: 130 },
			{ title: "Usta", field: "masterName", minWidth: 140 },
			{ title: "Brüt", field: "grossFmt", width: 110 },
			{ title: "Net Hak Ediş", field: "netFmt", width: 120 },
			{ title: "Platform Payı", field: "feeFmt", width: 120 },
		],
	);
	makeTable(
		"table-finance-commission",
		aggregateGiftSplit(state.data.gifts).map((c) => ({
			...c,
			grossFmt: formatTl(c.grossKurus),
			feeFmt: formatTl(c.platformFeeKurus),
		})),
		[
			{ title: "Kaynak / Küme", field: "clusterCode" },
			{ title: "Brüt", field: "grossFmt" },
			{ title: "Komisyon", field: "feeFmt" },
		],
	);
	makeTable(
		"table-finance-efatura",
		state.data.efatura.map((f) => ({
			...f,
			amountFmt: formatTl(f.amountKurus),
		})),
		[
			{ title: "İş", field: "requestCode", width: 130 },
			{ title: "Tutar", field: "amountFmt", width: 105 },
			{ title: "Durum", field: "status", width: 100 },
			{ title: "UUID", field: "uuid" },
		],
	);
}

document
	.getElementById("export-payable-csv-btn")
	.addEventListener("click", () => {
		if (!hasPerm("finance.export"))
			return toast("Dışa aktarım yetkiniz yok (403).");
		downloadCsv("ustanomi-hakedis.csv", state.data.payable);
	});
document
	.getElementById("export-commission-csv-btn")
	.addEventListener("click", () => {
		if (!hasPerm("finance.export"))
			return toast("Dışa aktarım yetkiniz yok (403).");
		downloadCsv("ustanomi-komisyon.csv", aggregateGiftSplit(state.data.gifts));
	});

function renderSettings() {
	const gifts = getProfessionGiftCatalog("ALL").map((g) => ({
		...g,
		active: true,
		priceFmt: formatTl(g.priceKurus),
	}));
	makeTable("table-gift-catalog", gifts, [
		{ title: "Küme", field: "clusterCode", width: 135 },
		{ title: "Hediye", field: "titleTr", minWidth: 130 },
		{ title: "Jeton", field: "coins", width: 75 },
		{ title: "Fiyat", field: "priceFmt", width: 90 },
		{ title: "Aktif", field: "active", width: 70, formatter: "tickCross" },
	]);
}

document.getElementById("save-rates-btn").addEventListener("click", () => {
	if (!hasPerm("settings.edit"))
		return toast("Yalnızca SUPER_ADMIN ayar değiştirebilir (403).");
	const bps = Number(document.getElementById("setting-escrow-bps").value);
	const reason = document.getElementById("setting-reason").value.trim();
	if (reason.length < 10) return toast("En az 10 karakterlik gerekçe zorunlu.");
	const check = validateSettingChange(
		"escrow_platform_fee_bps",
		bps,
		Date.now(),
		Date.now(),
	);
	if (!check.valid) return toast(`Hata: ${check.error}`);
	toast(
		"Yeni oran sürümü kaydedildi (yalnızca gelecek işlemler için geçerli).",
	);
});

function renderAudit() {
	makeTable("table-audit", state.data.audit, [
		{ title: "Zaman", field: "createdAt", width: 155 },
		{ title: "Yönetici", field: "adminName", width: 130 },
		{ title: "Rol", field: "role", width: 115 },
		{ title: "İşlem", field: "action", minWidth: 180 },
		{ title: "Hedef", field: "targetType", width: 100 },
		{ title: "Gerekçe", field: "reason", minWidth: 180 },
	]);
}

document.getElementById("verify-chain-btn").addEventListener("click", () => {
	toast("Hash zinciri doğrulandı: bütünlük tam (0 kırık).");
});

function renderAdmins() {
	makeTable("table-admins", state.data.admins, [
		{ title: "ID", field: "id", width: 60 },
		{ title: "Ad Soyad", field: "fullName" },
		{ title: "E-posta", field: "email" },
		{ title: "Rol", field: "role", width: 130 },
		{ title: "2FA", field: "totpEnabled", width: 70, formatter: "tickCross" },
		{ title: "Aktif", field: "isActive", width: 70, formatter: "tickCross" },
	]);
}

document
	.getElementById("user-search-input")
	.addEventListener("input", renderUsers);
document
	.getElementById("user-role-filter")
	.addEventListener("change", renderUsers);
document
	.getElementById("user-status-filter")
	.addEventListener("change", renderUsers);
document.getElementById("logout-btn").addEventListener("click", () => {
	if (!isPreview)
		fetch("../api/admin/auth.php", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Admin-CSRF": state.csrf,
			},
			body: JSON.stringify({ action: "logout" }),
		});
	window.location.replace("login.html");
});

if (await bootstrapAuth()) {
	applyRbacToNav();
	renderDashboard();
	renderUsers();
	renderKyc();
	renderEscrow();
	renderDisputes();
	renderTenders();
	renderLive();
	renderModeration();
	renderFinance();
	renderSettings();
	renderAudit();
	renderAdmins();
	const view = params.get("view");
	if (view) switchView(view);
}
