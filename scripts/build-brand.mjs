/**
 * Ustanomi brand build.
 *
 * Single source of truth for the logo geometry. Everything else (SVG sources,
 * store icons, PWA icons, native icon/splash masters) is derived from it, so
 * the mark can never drift between platforms.
 *
 * Concept: a "U" drawn as a horseshoe-bottomed cup (usta = craft) holding one
 * coin (ekonomi = the escrow pool). Flat colour, no gradients, no text, so it
 * stays legible from 16 px favicon to 1024 px store art.
 *
 * Rasteriser: sharp (Apache-2.0). Native icon/splash fan-out is done by
 * @capacitor/assets (MIT), see `npm run brand:build`.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const INK = "#0E1726";
const AMBER = "#FFB400";
const WHITE = "#FFFFFF";
const GRAPHITE = "#262626";

// 1024-unit grid. Stroke 136, centrelines 304 apart, bottom radius 152.
const U_PATH = "M360 262V542A152 152 0 0 0 664 542V262";
const U_STROKE = 136;
const COIN = { cx: 512, cy: 488, r: 60 };

const mark = ({ u = WHITE, coin = AMBER } = {}) =>
	`<path d="${U_PATH}" fill="none" stroke="${u}" stroke-width="${U_STROKE}"/>` +
	`<circle cx="${COIN.cx}" cy="${COIN.cy}" r="${COIN.r}" fill="${coin}"/>`;

const doc = (inner, { size = 1024, bg, radius = 0 } = {}) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}" role="img" aria-label="Ustanomi">` +
	`<title>Ustanomi</title>` +
	(bg ? `<rect width="1024" height="1024" rx="${radius}" fill="${bg}"/>` : "") +
	`${inner}</svg>`;

const out = (...p) => {
	const file = path.join(root, ...p);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	return file;
};
const write = (file, data) => fs.writeFileSync(out(file), data);

const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 });
const opaque = (svg) =>
	sharp(Buffer.from(svg)).removeAlpha().png({ compressionLevel: 9 });

// ---- 1. Vector sources -----------------------------------------------------
write("assets/brand/ustanomi-icon.svg", doc(mark(), { bg: INK }));
write(
	"assets/brand/ustanomi-icon-rounded.svg",
	doc(mark(), { bg: INK, radius: 224 }),
);
write("assets/brand/ustanomi-mark.svg", doc(mark()));
write("assets/brand/ustanomi-mark-dark.svg", doc(mark({ u: GRAPHITE })));
write("www/favicon.svg", doc(mark(), { bg: INK, radius: 224 }));

// ---- 2. Native masters for @capacitor/assets --------------------------------
await opaque(doc(mark(), { bg: INK })).toFile(out("assets/icon-only.png"));
await png(doc(mark())).toFile(out("assets/icon-foreground.png"));
await sharp({
	create: { width: 1024, height: 1024, channels: 3, background: INK },
})
	.png()
	.toFile(out("assets/icon-background.png"));

const SPLASH = 2732;
const splashMark = await png(doc(mark(), { size: 1500 })).toBuffer();
for (const name of ["splash.png", "splash-dark.png"]) {
	await sharp({
		create: { width: SPLASH, height: SPLASH, channels: 3, background: INK },
	})
		.composite([
			{
				input: splashMark,
				left: (SPLASH - 1500) / 2,
				top: (SPLASH - 1500) / 2,
			},
		])
		.removeAlpha()
		.png({ compressionLevel: 9 })
		.toFile(out("assets", name));
}

// ---- 3. Store art (no alpha channel, as both stores require) ----------------
const full = (size) => doc(mark(), { size, bg: INK });
await opaque(full(512)).toFile(out("store-assets/google-play-icon-512.png"));
await opaque(full(1024)).toFile(
	out("store-assets/apple-app-store-icon-1024.png"),
);

// Feature graphic: mark + lowercase wordmark. Text is rasterised only here, so
// no font file ever ships; if the host has no usable font it falls back to the
// mark alone.
const markForFeature = await png(doc(mark(), { size: 340 })).toBuffer();
const wordmarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="160"><text x="0" y="108" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="118" font-weight="700" letter-spacing="-4" fill="${WHITE}">ustanomi</text></svg>`;
const wordmark = await sharp(Buffer.from(wordmarkSvg)).png().toBuffer();
await sharp({
	create: { width: 1024, height: 500, channels: 3, background: INK },
})
	.composite([
		{ input: markForFeature, left: 96, top: 80 },
		{ input: wordmark, left: 450, top: 172 },
	])
	.removeAlpha()
	.png({ compressionLevel: 9 })
	.toFile(out("store-assets/google-play-feature-graphic-1024x500.png"));

// ---- 4. PWA / web icons -----------------------------------------------------
for (const size of [192, 512]) {
	await opaque(full(size)).toFile(out(`www/icons/icon-${size}.png`));
}
await opaque(full(180)).toFile(out("www/icons/apple-touch-icon.png"));

console.log("Brand build complete.");
