/**
 * Ustanomi Production PWA Service Worker (`pwa-workbox-lifecycle` skill compliant)
 * - Precaches core offline app shell (`index.html`, `offline.html`, `capacitor-bridge.js`, `manifest.json`)
 * - Strictly excludes dynamic API endpoints (`/api/*`, `*.php`) from caching to prevent stale financial/escrow state
 * - Safely invalidates older caches on activation
 */

const CACHE_NAME = "ustanomi-shell-v2";
const PRECACHE_ASSETS = [
	"/index.html",
	"/offline.html",
	"/capacitor-bridge.js",
	"/manifest.json",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(PRECACHE_ASSETS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((oldKey) => caches.delete(oldKey)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") {
		return;
	}
	const url = new URL(req.url);

	// Never cache dynamic API or PHP endpoints
	if (url.pathname.startsWith("/api/") || url.pathname.endsWith(".php")) {
		return;
	}

	event.respondWith(
		fetch(req).catch(async () => {
			const cached = await caches.match(req);
			if (cached) {
				return cached;
			}
			if (req.mode === "navigate") {
				return caches.match("/offline.html");
			}
			return new Response("Offline", { status: 503 });
		}),
	);
});
