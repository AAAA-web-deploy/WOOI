import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const output = path.join(root, "dist");
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export async function build() {
  const raw = await fs.readFile(path.join(root, "site.config.js"), "utf8");
  const context = { window: {} };
  vm.runInNewContext(raw, context, { timeout: 1000, filename: "site.config.js" });
  let siteUrl = "";
  try {
    const url = new URL(context.window.WOOI_CONFIG?.siteUrl || "");
    if (url.protocol === "https:" && !url.username && !url.password) {
      url.search = "";
      url.hash = "";
      url.pathname = url.pathname.replace(/\/?$/, "/");
      siteUrl = url.href;
    }
  } catch (_) {}
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  await fs.cp(path.join(root, "src"), output, { recursive: true });
  await fs.cp(path.join(root, "assets"), path.join(output, "assets"), { recursive: true });
  await fs.copyFile(path.join(root, "site.config.js"), path.join(output, "site.config.js"));
  await fs.writeFile(path.join(output, ".nojekyll"), "");
  let html = await fs.readFile(path.join(output, "index.html"), "utf8");
  // The editable template can also be opened directly from src/. Built pages
  // always resolve against their own folder, including a GitHub Pages subpath.
  html = html.replace(/\s*<base href="\.\.\/" data-source-preview>\s*/, "\n  ");
  if (siteUrl) {
    const socialImage = new URL("assets/brand/og-1200x630.jpg", siteUrl).href;
    html = html.replaceAll('content="assets/brand/og-1200x630.jpg"', 'content="' + escape(socialImage) + '"');
    html = html.replace("</head>", '  <link rel="canonical" href="' + escape(siteUrl) + '">\n  <meta property="og:url" content="' + escape(siteUrl) + '">\n</head>');
    await fs.writeFile(path.join(output, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: " + new URL("sitemap.xml", siteUrl).href + "\n");
    await fs.writeFile(path.join(output, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + escape(siteUrl) + "</loc></url></urlset>\n");
  } else {
    await fs.writeFile(path.join(output, "robots.txt"), "User-agent: *\nAllow: /\n");
  }
  await fs.writeFile(path.join(output, "index.html"), html);
  // Keep an actual homepage beside assets/ in the extracted kit. This makes
  // both double-click previews and a repository-root deployment self-contained.
  for (const name of ["index.html", "styles.css", "app.js", "core.js", "robots.txt", ".nojekyll"]) {
    await fs.copyFile(path.join(output, name), path.join(root, name));
  }
  if (siteUrl) await fs.copyFile(path.join(output, "sitemap.xml"), path.join(root, "sitemap.xml"));
  else await fs.rm(path.join(root, "sitemap.xml"), { force: true });
  return { output, siteUrl: siteUrl || null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await build();
  console.log("Built WOOI → " + result.output);
}
