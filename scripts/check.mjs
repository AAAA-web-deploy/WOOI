import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { build, root, output } from "./build.mjs";

await import(pathToFileURL(path.join(root, "src/core.js")).href);
const core = globalThis.WOOI_CORE;
const address = "0x1234567890aBcDEF1234567890abcdef12345678";
const pair = "0xaBcdef1234567890AbCdEF1234567890aBCDef12";
assert.equal(core.normalizeConfig({}).address, "");
assert.equal(core.normalizeConfig({ links: { buy: "https://app.uniswap.org/" } }).buy, "");
assert.equal(core.ethereumAddress("0x0000000000000000000000000000000000000000"), "");
assert.equal(core.ethereumAddress("0xnot-a-contract"), "");
assert.equal(core.ethereumAddress(" " + address + " "), address);
assert.equal(core.httpsUrl("javascript:alert(1)"), "");
assert.equal(core.httpsUrl("https://someone:secret@example.com/"), "");
assert.equal(core.normalizeConfig({ links: { x: "https://x.com.evil.example/" } }).x, "");
assert.equal(core.normalizeConfig({ links: { telegram: "https://example.com/" } }).telegram, "");
assert.equal(core.normalizeConfig({ contractAddress: address, links: { buy: "javascript:alert(1)" } }).buy, "");
const ready = core.normalizeConfig({
  contractAddress: address, pairAddress: pair,
  links: { buy: "https://app.uniswap.org/", x: "https://x.com/wooi", telegram: "https://t.me/wooi" }
});
assert.equal(ready.address, address);
assert.equal(ready.explorer, "https://etherscan.io/token/" + address);
assert.equal(ready.chart, "https://dexscreener.com/ethereum/" + pair);
assert.ok(ready.embed.includes(pair));
assert.equal(ready.buy, "https://app.uniswap.org/");
assert.equal(ready.x, "https://x.com/wooi");
assert.equal(ready.telegram, "https://t.me/wooi");

await build();
const html = await fs.readFile(path.join(output, "index.html"), "utf8");
const app = await fs.readFile(path.join(output, "app.js"), "utf8");
assert.ok(app.includes('item.file + "-1600.jpg"'), "The enlarged image must use JPEG too");
for (const name of ["index.html", "styles.css", "app.js", "core.js"]) {
  assert.equal(await fs.readFile(path.join(root, name), "utf8"), await fs.readFile(path.join(output, name), "utf8"), "Root preview must match dist/: " + name);
}
assert.ok(!html.includes("data-source-preview"), "Built pages must use their own asset base");
assert.match(html, /src="assets\/brand\/logo-256\.png"/, "The approved portrait must be used");
assert.ok(!html.includes("logo.svg"), "Remove the previous logo from the live site");
const template = await fs.readFile(path.join(root, "src/index.html"), "utf8");
assert.ok(template.includes('<base href="../" data-source-preview>'), "Direct source previews must resolve assets from the kit root");
assert.equal((html.match(/<h1\b/g) || []).length, 1, "Exactly one primary heading");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, new Set(ids).size, "HTML IDs must be unique");
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const value = match[1];
  if (value.startsWith("#")) {
    assert.ok(ids.includes(value.slice(1)), "Missing anchor " + value);
  } else if (!/^(https?:|mailto:|data:)/.test(value)) {
    await fs.access(path.join(output, value.split(/[?#]/)[0]));
  }
}
for (const match of html.matchAll(/\bsrcset="([^"]+)"/g)) {
  for (const part of match[1].split(",")) await fs.access(path.join(output, part.trim().split(/\s+/)[0]));
}
for (const match of html.matchAll(/<img\b[^>]*>/g)) {
  assert.match(match[0], /\balt="/, "Every image needs alt text");
  assert.match(match[0], /\bwidth="/, "Every image needs intrinsic dimensions");
  assert.match(match[0], /\bheight="/, "Every image needs intrinsic dimensions");
  if (match[0].includes("assets/web/")) {
    assert.match(match[0], /loading="eager"|fetchpriority="high"/, "Story images must load independently of scroll scripts");
    assert.match(match[0], /\.jpg"/, "Use broadly compatible JPEG display images");
  }
}
for (const name of await fs.readdir(path.join(output, "assets/web"))) {
  if (!name.endsWith(".jpg")) continue;
  const bytes = await fs.readFile(path.join(output, "assets/web", name));
  assert.equal(bytes.readUInt16BE(0), 0xffd8, "Invalid JPEG image " + name);
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, "Truncated JPEG image " + name);
}
const css = await fs.readFile(path.join(output, "styles.css"), "utf8");
assert.ok(css.includes("prefers-reduced-motion"));
assert.ok(css.includes("overflow-wrap:anywhere"));
assert.ok(css.includes("@media(max-width:600px)"));
assert.ok(!css.includes(".js-reveal .reveal{opacity:0"), "Images must remain visible when scripts fail");
assert.match(css, /\.hero-image\{[^}]*z-index:0/, "The hero must remain above the page background");
for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
  if (!/^(https?:|data:)/.test(match[1])) await fs.access(path.join(output, match[1]));
}
const fontCss = await fs.readFile(path.join(output, "assets/fonts/fonts.css"), "utf8");
for (const match of fontCss.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
  assert.ok(!match[1].startsWith("http"), "Fonts must be served locally");
  await fs.access(path.join(output, "assets/fonts", match[1]));
}
for (const name of ["index.html", "app.js", "core.js", "styles.css", "site.config.js"]) {
  const source = await fs.readFile(path.join(output, name), "utf8");
  assert.ok(!/GnmByQQ|H6mPEvka|WildwoodPrue|\$PRUE|pump\.fun|Solana/.test(source), "Reference token residue in " + name);
}
console.log("PASS: root/dist preview parity, source asset base, JPEG integrity, eager story images, visible-by-default artwork, approved portrait, launch configuration, links, fonts, accessibility metadata, reduced motion, and reference-token isolation.");
