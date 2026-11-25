import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = "C:\\Users\\VİCTUS\\Desktop\\projeler\\ustanomi-mobile";
const outFile =
	"C:\\Users\\VİCTUS\\.gemini\\antigravity\\brain\\1c2959e0-9ad7-4c92-bd5e-b470f8dedd69\\logo_preview.png";
const master = path.join(root, "assets", "icon-only.png");
const fg = path.join(root, "assets", "icon-foreground.png");

const W = 1500;
const H = 980;
const layers = [];
const bg = (x, y, w, h, color) => ({
	input: {
		create: { width: w, height: h, channels: 3, background: color },
	},
	left: x,
	top: y,
});
layers.push(bg(0, 0, 640, H, "#FFFFFF"));
layers.push(bg(640, 0, 860, H, "#E9E9EC"));

const sized = async (size, shape) => {
	let img = sharp(master).resize(size, size);
	if (shape === "circle") {
		const mask = Buffer.from(
			`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`,
		);
		img = img.composite([{ input: mask, blend: "dest-in" }]);
	} else if (shape === "squircle") {
		const r = Math.round(size * 0.225);
		const mask = Buffer.from(
			`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}"/></svg>`,
		);
		img = img.composite([{ input: mask, blend: "dest-in" }]);
	}
	return img.png().toBuffer();
};

// Big hero on white
layers.push({ input: await sized(560, "squircle"), left: 40, top: 40 });
// Android adaptive foreground safe zone (66%) overlay on ink
const fgBuf = await sharp(fg).resize(300, 300).png().toBuffer();
layers.push(bg(40, 640, 300, 300, "#0E1726"));
layers.push({ input: fgBuf, left: 40, top: 640 });
layers.push({
	input: await sized(300, "circle"),
	left: 360,
	top: 640,
});

// Size ladder on grey
let x = 680;
for (const s of [192, 120, 76, 48, 32, 16]) {
	layers.push({ input: await sized(s, "squircle"), left: x, top: 60 });
	x += s + 24;
}
// Round + squircle at launcher size on grey
layers.push({ input: await sized(180, "circle"), left: 680, top: 330 });
layers.push({ input: await sized(180, "squircle"), left: 890, top: 330 });
// Dark and light home-screen tiles
layers.push(bg(1100, 330, 180, 180, "#101010"));
layers.push({ input: await sized(120, "squircle"), left: 1130, top: 360 });
layers.push(bg(1300, 330, 160, 180, "#F4F4F4"));
layers.push({ input: await sized(120, "squircle"), left: 1320, top: 360 });

// Mark-only on light (dark variant) to prove contrast on white
const markDark = await sharp(
	path.join(root, "assets/brand/ustanomi-mark-dark.svg"),
)
	.resize(300, 300)
	.png()
	.toBuffer();
layers.push({ input: markDark, left: 700, top: 600 });

const splash = await sharp(path.join(root, "assets", "splash.png"))
	.resize(300, 300)
	.png()
	.toBuffer();
layers.push({ input: splash, left: 1040, top: 600 });

await sharp({
	create: { width: W, height: H, channels: 3, background: "#FFFFFF" },
})
	.composite(layers)
	.png()
	.toFile(outFile);
console.log("preview ok", fs.statSync(outFile).size);
