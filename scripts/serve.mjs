import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { build, output, root } from "./build.mjs";

await build();
let lastBuild = Date.now();
let rebuilding = null;
const production = process.argv.includes("--production");
const serveRoot = production ? output : root;
const argPort = process.argv.indexOf("--port");
const port = Number(process.env.PORT || (argPort >= 0 ? process.argv[argPort + 1] : 3000));
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml"
};

async function refresh() {
  if (production) return;
  const names = ["src/index.html", "src/styles.css", "src/app.js", "src/core.js", "site.config.js"];
  const stamps = await Promise.all(names.map(async (name) => (await fs.stat(path.join(root, name))).mtimeMs));
  if (Math.max(...stamps) > lastBuild) {
    if (!rebuilding) rebuilding = build().then(() => { lastBuild = Date.now(); }).finally(() => { rebuilding = null; });
    await rebuilding;
  } else if (rebuilding) {
    await rebuilding;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (!production && url.pathname.startsWith("/__qa/")) {
      if (url.pathname === "/__qa/without-scripts") {
        await refresh();
        const fixture = (await fs.readFile(path.join(output, "index.html"), "utf8"))
          .replace("<head>", '<head><base href="/">')
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        response.end(fixture);
        return;
      }
      if (url.pathname === "/__qa/config-ready.js") {
        response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
        response.end('window.WOOI_CONFIG={contractAddress:"0x1234567890aBcDEF1234567890abcdef12345678",pairAddress:"",links:{buy:"https://app.uniswap.org/",chart:"",x:"https://x.com/wooi",telegram:"https://t.me/wooi"}};');
        return;
      }
      if (url.pathname === "/__qa/configured") {
        await refresh();
        const fixture = (await fs.readFile(path.join(output, "index.html"), "utf8"))
          .replace("<head>", '<head><base href="/">')
          .replace('src="site.config.js"', 'src="/__qa/config-ready.js"');
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        response.end(fixture);
        return;
      }
      const widths = { mobile: 390, small: 320, tablet: 768, desktop: 1440 };
      const key = url.pathname.split("/").filter(Boolean).at(-1);
      const width = widths[key];
      if (!width) { response.writeHead(404); response.end("Unknown QA viewport"); return; }
      const height = width < 500 ? 844 : 1024;
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      const frameSource = url.searchParams.has("configured") ? "/__qa/configured#token" : url.searchParams.has("without-scripts") ? "/__qa/without-scripts" : "/";
      const clipboardField = url.searchParams.has("configured") ? '<textarea aria-label="Clipboard verification" placeholder="QA clipboard check" style="position:fixed;left:12px;bottom:12px;width:180px;height:45px"></textarea>' : "";
      response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>WOOI responsive QA — ' + key + '</title><style>body{margin:0;background:#e8e5dc;font:14px system-ui;display:flex;flex-direction:column;align-items:center;padding:18px;gap:12px}p{margin:0;color:#345}iframe{border:0;background:#101c1a;box-shadow:0 5px 30px #0003;flex-shrink:0;max-width:none}</style></head><body><p>WOOI · ' + width + ' × ' + height + ' responsive viewport</p><iframe id="viewport" title="WOOI mobile viewport" src="' + frameSource + '" width="' + width + '" height="' + height + '"></iframe>' + clipboardField + '</body></html>');
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405); response.end(); return; }
    await refresh();
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch (_) { response.writeHead(400); response.end("Invalid URL"); return; }
    const target = path.resolve(serveRoot, "." + (pathname === "/" ? "/index.html" : pathname));
    if (target !== serveRoot && !target.startsWith(serveRoot + path.sep)) { response.writeHead(403); response.end("Forbidden"); return; }
    let stat;
    try { stat = await fs.stat(target); } catch (_) { response.writeHead(404); response.end("Not found"); return; }
    const file = stat.isDirectory() ? path.join(target, "index.html") : target;
    const data = await fs.readFile(file);
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch (error) {
    console.error(error.message);
    response.writeHead(500); response.end("Preview could not load this file.");
  }
});
server.listen(port, "0.0.0.0", () => {
  console.log("WOOI preview ready at http://localhost:" + port);
  console.log("Responsive QA: /__qa/mobile, /__qa/small, /__qa/tablet");
});
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
