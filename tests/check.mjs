// Behaviour check: proves the page still DOES what it did, whatever it looks like.
//
//   node tests/check.mjs            # checks ./index.html
//   node tests/check.mjs other.html # checks another page in this folder
//
// It reads only ids, roles and text the app itself defines, never class names
// of a particular look, so it runs unchanged against the old page and the new.
// Exit 0 = every behaviour held. Exit 1 = the first thing that broke is printed.
import { chromium } from "playwright-core";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = process.argv[2] || "index.html";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// sha256 of JSON.stringify(FILMS) on the page as it stood before the CRT makeover
// (commit bf6b191). The library is data: a restyle may never change one byte of it.
const FILMS_SHA = "81f04d9aef08a6ae31f846bb76c53a4921b65ccfc5ba48b5698808982611ac39";
const FILM_COUNT = 1138;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json" };

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

function serve(port) {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || PAGE;
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(port, "127.0.0.1", () => r(srv)));
}

let failures = 0;
function ok(cond, what) {
  console.log((cond ? "  ok   " : "  FAIL ") + what);
  if (!cond) failures++;
}

async function waitForFilmTitle(page, titles, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = await page.textContent("#cardTitle");
    if (t && titles.has(t)) return t;
    await page.waitForTimeout(100);
  }
  return null;
}

const port = await freePort();
const srv = await serve(port);
const url = `http://127.0.0.1:${port}/${PAGE}`;
// GL=gpu (default) drives the 3D set on the Mac's GPU; GL=soft forces a software
// rasteriser, which the page must answer with the flat TV — both must behave.
const GL = process.env.GL || "gpu";
const browser = await chromium.launch({
  executablePath: CHROME,
  args: GL === "soft"
    ? ["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"]
    : ["--ignore-gpu-blocklist", "--use-angle=metal"],
});
console.log(`graphics: ${GL}`);

try {
  // ── desktop ────────────────────────────────────────────────────────────
  console.log(`desktop 1440x900  ${url}`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  // a missing favicon or an unreachable poster is not the page failing; any other 4xx/5xx is
  page.on("response", r => { if (r.status() >= 400 && !/favicon|image\.tmdb\.org/.test(r.url())) errors.push(r.status() + " " + r.url()); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(url, { waitUntil: "load" });

  const { sha, count, titles } = await page.evaluate(async () => {
    const buf = new TextEncoder().encode(JSON.stringify(FILMS));
    const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))]
      .map(b => b.toString(16).padStart(2, "0")).join("");
    return { sha: h, count: FILMS.length, titles: FILMS.map(f => f.t) };
  });
  const TITLES = new Set(titles);
  await page.waitForFunction(() => document.documentElement.classList.contains("tv-ready"), null, { timeout: 20000 }).catch(() => {});
  const mode = await page.evaluate(() => document.documentElement.classList.contains("no-webgl") ? "flat" : "3d");
  ok(await page.evaluate(() => document.documentElement.classList.contains("tv-ready")), `the TV came up (${mode})`);
  ok(GL === "soft" ? mode === "flat" : mode === "3d", `software graphics get the flat TV, a GPU gets the 3D set (${GL} → ${mode})`);
  if (FILMS_SHA === "SET_ME") console.log("  (baseline) FILMS sha256 =", sha);
  else ok(sha === FILMS_SHA, `film library byte-identical (${sha.slice(0, 12)}…)`);
  ok(count === FILM_COUNT, `${FILM_COUNT} films in the library (got ${count})`);
  ok((await page.textContent("#total")).trim() === String(FILM_COUNT), "#total shows the library size");

  // Surprise me
  await page.getByRole("button", { name: /surprise me/i }).click();
  const first = await waitForFilmTitle(page, TITLES);
  ok(!!first, `SURPRISE ME lands a real film title (${first})`);
  ok(await page.evaluate(() => document.getElementById("card").classList.contains("show")), "card is shown");
  ok(/justwatch\.com/.test(await page.getAttribute("#watchLink", "href")), "WHERE TO WATCH points at JustWatch for that film");
  // 786 of the 1138 films carry poster art; a film without it must show no broken image
  const hasPoster = await page.evaluate(t => !!FILMS.find(f => f.t === t).p, first);
  const posterSrc = (await page.getAttribute("#cardPoster", "src")) || "";
  const posterHidden = await page.evaluate(() => getComputedStyle(document.getElementById("cardPoster")).display === "none");
  ok(hasPoster ? /image\.tmdb\.org/.test(posterSrc) : (!posterSrc && posterHidden),
     hasPoster ? "poster src is set from TMDB" : "film has no poster art: no poster shown, no broken image");
  ok(((await page.textContent("#cardDesc")) || "").length > 20, "description is filled");
  ok(((await page.textContent("#cardCast")) || "").length > 5, "cast is filled");

  // A second pick lands a film too (transition must always resolve)
  await page.getByRole("button", { name: /surprise me/i }).click();
  ok(!!(await waitForFilmTitle(page, TITLES)), "a second pick resolves to a real film");

  // Filters change the count
  const countOf = async () => { const m = ((await page.textContent("#countLine")) || "").match(/(\d+) films match/); return m ? +m[1] : null; };
  await page.locator("#genres button").first().click();
  const afterGenre = await countOf();
  ok(afterGenre !== null && afterGenre > 0 && afterGenre < FILM_COUNT, `a genre chip narrows the pool (${afterGenre})`);
  await page.locator("#decades button").first().click();
  const afterDecade = await countOf();
  ok(afterDecade !== null && afterDecade <= afterGenre, `a decade chip narrows it further (${afterDecade})`);
  const pressed = await page.locator("#genres button").first().evaluate(b => b.classList.contains("active") || b.getAttribute("aria-pressed") === "true");
  ok(pressed, "the chosen genre chip shows as chosen");
  // a filtered pick obeys the filter
  const genreName = (await page.locator("#genres button").first().textContent()).trim();
  await page.getByRole("button", { name: /surprise me/i }).click();
  const filtered = await waitForFilmTitle(page, TITLES);
  const obeys = await page.evaluate(([t, g]) => { const f = FILMS.find(x => x.t === t); return !!f && f.g.includes(g) && f.y < 1980; }, [filtered, genreName]);
  ok(obeys, `a filtered pick is a ${genreName} film from the 1970s (${filtered})`);
  // unset filters again
  await page.locator("#genres button").first().click();
  await page.locator("#decades button").first().click();

  // Actor hit
  await page.fill("#actorInput", "Nicholson");
  await page.press("#actorInput", "Enter");
  await page.waitForTimeout(1200);
  ok(/First film for Jack Nicholson/.test(await page.textContent("#actorNote")), "actor search names the actor's first film");
  ok(/films feature Jack Nicholson/.test(await page.textContent("#countLine")), "count line says how many films feature them");
  ok(!!(await waitForFilmTitle(page, TITLES)), "actor search shows a real film");

  // Actor miss
  await page.fill("#actorInput", "zzqxv");
  await page.press("#actorInput", "Enter");
  await page.waitForTimeout(1200);
  ok(/No films found for "zzqxv"/.test(await page.textContent("#actorNote")), "unknown actor says no films found");
  ok(((await page.textContent("#cardTitle")) || "") === "", "…and shows no title");

  // Clear
  await page.locator(".actor-row button").last().click();
  ok((await page.inputValue("#actorInput")) === "", "clear empties the actor box");
  ok(!(await page.evaluate(() => document.getElementById("card").classList.contains("show"))), "clear hides the card");

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  await ctx.close();

  // ── phone ──────────────────────────────────────────────────────────────
  console.log("phone 375x812");
  const pctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await pctx.newPage();
  const perr = [];
  p.on("pageerror", e => perr.push(String(e)));
  await p.goto(url, { waitUntil: "load" });
  ok(await p.isVisible("#genreToggle"), "genre toggle is shown on a phone");
  ok(!(await p.isVisible("#genres")), "genre list starts folded");
  await p.tap("#genreToggle");
  ok(await p.isVisible("#genres"), "tapping the toggle opens the genres");
  ok((await p.getAttribute("#genreToggle", "aria-expanded")) === "true", "toggle reports aria-expanded=true");
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 0, `no sideways scroll on a phone (overflow ${overflow}px)`);
  await p.getByRole("button", { name: /surprise me/i }).tap();
  ok(!!(await waitForFilmTitle(p, TITLES)), "SURPRISE ME works on a phone");
  ok(perr.length === 0, "no page errors on a phone" + (perr.length ? ": " + perr.join(" | ") : ""));
  await pctx.close();
} finally {
  await browser.close();
  srv.close();
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
