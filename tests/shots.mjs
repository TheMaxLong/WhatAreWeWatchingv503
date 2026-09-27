// Screenshots for the design review: each viewport idle, mid channel-change,
// and playing a film. Uses real Chrome with GPU so the WebGL set renders as a
// person would see it.
//
//   node tests/shots.mjs [outdir]      # default .impeccable/review
import { chromium } from "playwright-core";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(ROOT, process.argv[2] || ".impeccable/review");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const port = await new Promise(r => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html");
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html" : "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(port, "127.0.0.1");

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=metal"] });
const views = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "user-1920", width: 1920, height: 1080 },
  { name: "user-1728", width: 1728, height: 1117 },
  { name: "mobile", width: 390, height: 844, mobile: true },
];
const FIXED_FILM = process.env.FILM || "Chinatown";

for (const v of views) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.mobile ? 3 : 1, isMobile: !!v.mobile, hasTouch: !!v.mobile });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text()); });
  page.on("pageerror", e => logs.push("pageerror: " + e));
  await page.goto(`http://127.0.0.1:${port}/index.html${process.env.Q || ""}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.classList.contains("tv-ready"), null, { timeout: 15000 }).catch(() => logs.push("tv-ready never set"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(OUT, `${v.name}.png`) });

  // the channel change, held still so the capture can see it (snow, then the torn bars)
  await page.evaluate(() => TV.hold("snow"));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${v.name}-static.png`) });
  await page.evaluate(() => TV.hold("bars"));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${v.name}-bars.png`) });
  // a known film with poster art, through the app's own showFilm
  await page.evaluate(title => showFilm(FILMS.find(f => f.t === title), null), FIXED_FILM);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(OUT, `${v.name}-film.png`) });
  if (v.mobile) await page.screenshot({ path: path.join(OUT, `${v.name}-film-full.png`), fullPage: true });
  console.log(v.name, logs.length ? logs.join(" | ") : "clean");
  await ctx.close();
}
await browser.close();
srv.close();
console.log("shots in", OUT);
