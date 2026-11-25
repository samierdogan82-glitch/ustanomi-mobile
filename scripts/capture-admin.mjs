import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..");
const outDir =
	"C:\\Users\\VİCTUS\\.gemini\\antigravity\\brain\\1c2959e0-9ad7-4c92-bd5e-b470f8dedd69";

const browserBin = [
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
	"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => fs.existsSync(p));

const mime = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
};

const server = http.createServer((req, res) => {
	const u = new URL(req.url, "http://127.0.0.1");
	const rel = u.pathname === "/" ? "/admin/index.html" : u.pathname;
	const file = path.join(projectRoot, rel);
	if (
		!file.startsWith(projectRoot) ||
		!fs.existsSync(file) ||
		fs.statSync(file).isDirectory()
	) {
		res.writeHead(404);
		res.end("nf");
		return;
	}
	res.writeHead(200, {
		"Content-Type": mime[path.extname(file)] || "text/plain",
	});
	res.end(fs.readFileSync(file));
});

const captures = [
	["admin_1440_login.png", "/admin/login.html", 1440, 900],
	[
		"admin_1440_dashboard.png",
		"/admin/index.html?preview=1&view=dashboard",
		1440,
		900,
	],
	["admin_1440_users.png", "/admin/index.html?preview=1&view=users", 1440, 900],
	[
		"admin_1440_escrow.png",
		"/admin/index.html?preview=1&view=escrow",
		1440,
		900,
	],
	["admin_1440_live.png", "/admin/index.html?preview=1&view=live", 1440, 900],
	[
		"admin_1440_finance.png",
		"/admin/index.html?preview=1&view=finance",
		1440,
		900,
	],
	[
		"admin_1024_dashboard.png",
		"/admin/index.html?preview=1&view=dashboard",
		1024,
		768,
	],
	[
		"admin_1024_disputes.png",
		"/admin/index.html?preview=1&view=disputes",
		1024,
		768,
	],
];

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

try {
	for (const [file, route, w, h] of captures) {
		const target = path.join(outDir, file);
		await execFileAsync(browserBin, [
			"--headless=new",
			"--no-sandbox",
			"--disable-gpu",
			"--hide-scrollbars",
			`--window-size=${w},${h}`,
			"--virtual-time-budget=4000",
			`--screenshot=${target}`,
			`http://127.0.0.1:${port}${route}`,
		]);
		console.log(`Captured ${file} (${w}x${h})`);
	}
} finally {
	server.close();
}
