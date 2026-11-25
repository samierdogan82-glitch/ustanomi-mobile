import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const file = (...p) => path.join(root, ...p);

describe("Ustanomi brand assets", () => {
	it("keeps the vector sources in sync with the single geometry definition", () => {
		const builder = fs.readFileSync(file("scripts/build-brand.mjs"), "utf8");
		assert.equal(builder.includes('const U_PATH = "M360 262V542'), true);
		for (const svg of [
			"assets/brand/ustanomi-icon.svg",
			"assets/brand/ustanomi-mark.svg",
			"www/favicon.svg",
		]) {
			const text = fs.readFileSync(file(svg), "utf8");
			assert.equal(
				text.includes("M360 262V542A152 152 0 0 0 664 542V262"),
				true,
			);
			assert.equal(
				text.includes("<text"),
				false,
				`${svg} must not depend on fonts`,
			);
			assert.equal(
				text.includes("linearGradient"),
				false,
				`${svg} must stay flat`,
			);
		}
	});

	it("ships store art with exact sizes and no alpha channel", async () => {
		const expected = {
			"store-assets/google-play-icon-512.png": [512, 512],
			"store-assets/apple-app-store-icon-1024.png": [1024, 1024],
			"store-assets/google-play-feature-graphic-1024x500.png": [1024, 500],
		};
		for (const [rel, [w, h]] of Object.entries(expected)) {
			const meta = await sharp(file(rel)).metadata();
			assert.equal(meta.width, w, rel);
			assert.equal(meta.height, h, rel);
			assert.equal(meta.hasAlpha, false, `${rel} must have no alpha`);
		}
	});

	it("generates every Android launcher density and adaptive layer", async () => {
		const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
		for (const [density, px] of Object.entries(sizes)) {
			for (const name of ["ic_launcher.png", "ic_launcher_round.png"]) {
				const meta = await sharp(
					file(`android/app/src/main/res/mipmap-${density}`, name),
				).metadata();
				assert.equal(meta.width, px, `${density}/${name}`);
				assert.equal(meta.height, px, `${density}/${name}`);
			}
			assert.equal(
				fs.existsSync(
					file(
						`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`,
					),
				),
				true,
			);
		}
		assert.equal(
			fs.existsSync(
				file("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"),
			),
			true,
		);
	});

	it("references only local, existing icons from the PWA manifest and shell", () => {
		const manifest = JSON.parse(
			fs.readFileSync(file("www/manifest.json"), "utf8"),
		);
		assert.equal(manifest.theme_color, "#FFFFFF");
		const purposes = manifest.icons.map((i) => i.purpose);
		assert.equal(purposes.includes("maskable"), true);
		for (const icon of manifest.icons) {
			assert.equal(icon.src.startsWith("http"), false, icon.src);
			assert.equal(fs.existsSync(file("www", icon.src)), true, icon.src);
		}
		const html = fs.readFileSync(file("www/index.html"), "utf8");
		assert.equal(html.includes('rel="icon" href="favicon.svg"'), true);
		assert.equal(html.includes("icons/apple-touch-icon.png"), true);
		const sw = fs.readFileSync(file("www/sw.js"), "utf8");
		assert.equal(sw.includes("/favicon.svg"), true);
	});
});
