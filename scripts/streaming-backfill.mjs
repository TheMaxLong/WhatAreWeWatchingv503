#!/usr/bin/env node
/**
 * streaming-backfill.mjs — fill index.html's STREAMING object with real TMDB data.
 *
 * Reads the FILMS array and the streaming-logo keys directly out of index.html
 * (never duplicates the data), asks TMDB where each film streams in the US
 * (flatrate / free / ads only — rent and buy stores are ignored), and writes:
 *
 *   scripts/streaming-output.js   ready-to-paste STREAMING_AS_OF + STREAMING block
 *   scripts/streaming-report.md   films it could NOT match + provider names it
 *                                 could not map (absence stays absent — nothing guessed)
 *
 * Usage:
 *   node scripts/streaming-backfill.mjs --dry-run     # no key needed, writes nothing
 *   TMDB_API_KEY=yourkey node scripts/streaming-backfill.mjs
 *
 * Flags:
 *   --dry-run    parse index.html + run the pipeline on ONE mock response. Never
 *                calls TMDB, never writes any file. Mock output goes to stdout only.
 *   --fresh      ignore saved progress and start over
 *   --limit N    only process the first N films (for a small test run)
 *
 * Data honesty rules baked in:
 *   - A film is matched ONLY on exact title (case-insensitive) + exact release year.
 *     No fuzzy matching. Zero or multiple exact matches -> the film goes in the
 *     report, not the output.
 *   - A TMDB provider name is mapped ONLY by exact name lookup. Unknown names go
 *     in the report, never guessed into a platform key.
 *   - "Apple TV" (no plus) is TMDB's rent/buy store, NOT Apple TV+. It is
 *     deliberately absent from the map.
 *
 * The run is resumable: progress is saved to scripts/.streaming-backfill.state.json
 * after every film, so Ctrl+C and re-running picks up where it left off.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = join(SCRIPT_DIR, "..", "index.html");
const STATE_FILE = join(SCRIPT_DIR, ".streaming-backfill.state.json");
const OUTPUT_FILE = join(SCRIPT_DIR, "streaming-output.js");
const REPORT_FILE = join(SCRIPT_DIR, "streaming-report.md");

const MIN_REQUEST_GAP_MS = 300; // ~3.3 req/sec, under TMDB's comfort zone

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FRESH = args.includes("--fresh");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
if (limitIdx !== -1 && (!Number.isFinite(LIMIT) || LIMIT < 1)) {
  fail("--limit needs a positive number, e.g. --limit 25");
}

function fail(msg) {
  console.error("ERROR: " + msg);
  process.exit(1);
}

// ── Pacific-time date stamp (matches how the app displays dates) ─────────────
function todayPacific() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()); // en-CA formats as YYYY-MM-DD
}

// ── Extract a balanced [..] or {..} literal from source text ─────────────────
// Skips string literals ("", '', ``) and // and /* */ comments so brackets
// inside film descriptions or SVG strings can't break the scan.
function extractBalancedLiteral(src, anchorRe) {
  const m = anchorRe.exec(src);
  if (!m) throw new Error("Could not find " + anchorRe + " in index.html — has the file changed shape?");
  const start = m.index + m[0].length - 1; // anchor regex ends on the opening bracket
  const open = src[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0, inStr = null, esc = false, inLine = false, inBlock = false;
  for (let j = start; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (inLine) { if (c === "\n") inLine = false; continue; }
    if (inBlock) { if (c === "*" && n === "/") { inBlock = false; j++; } continue; }
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "/" && n === "/") { inLine = true; j++; continue; }
    if (c === "/" && n === "*") { inBlock = true; j++; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  throw new Error("Unbalanced " + open + close + " literal after " + anchorRe);
}

function evalLiteral(literal, what) {
  try {
    return vm.runInNewContext("(" + literal + ")", Object.create(null), { timeout: 5000 });
  } catch (e) {
    throw new Error("Extracted " + what + " literal did not evaluate cleanly: " + e.message);
  }
}

// ── Read FILMS and the logo keys out of index.html ───────────────────────────
function loadFromIndexHtml() {
  const html = readFileSync(INDEX_HTML, "utf8");

  const films = evalLiteral(extractBalancedLiteral(html, /const FILMS = \[/), "FILMS");
  if (!Array.isArray(films) || films.length === 0) throw new Error("FILMS parsed but is empty or not an array");
  for (const f of films) {
    if (typeof f?.t !== "string" || typeof f?.y !== "number") {
      throw new Error("FILMS entry missing t/y: " + JSON.stringify(f).slice(0, 120));
    }
  }

  const logos = evalLiteral(extractBalancedLiteral(html, /const logos = \{/), "logos");
  const logoKeys = Object.keys(logos);
  if (logoKeys.length === 0) throw new Error("No streaming-logo keys found in index.html");

  // Duplicate Title|Year keys would silently collide in the STREAMING object.
  const seen = new Map();
  const dupes = [];
  for (const f of films) {
    const k = f.t + "|" + f.y;
    if (seen.has(k)) dupes.push(k); else seen.set(k, true);
  }
  return { films, logoKeys, dupes };
}

// ── Provider-name mapping (exact TMDB names only) ────────────────────────────
// Values are NORMALIZED platform names; they are matched against the logo keys
// actually present in index.html (e.g. "disney" matches the file's "disney+",
// "hbomax" matches "hbo-max"). If index.html has no matching logo key, the
// provider is reported, not guessed.
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const PROVIDER_MAP = {
  "Netflix": "netflix",
  "Netflix Standard with Ads": "netflix",
  "Amazon Prime Video": "prime",
  "Amazon Prime Video with Ads": "prime",
  "Disney Plus": "disney",
  "Max": "hbomax",
  "HBO Max": "hbomax",
  "The Criterion Channel": "criterion",
  "Criterion Channel": "criterion",
  "Paramount Plus": "paramount",
  "Paramount+ with Showtime": "paramount",
  "Paramount Plus with Showtime": "paramount",
  "Tubi TV": "tubi",
  "Tubi": "tubi",
  "Pluto TV": "pluto",
  "Hulu": "hulu",
  "Peacock": "peacock",
  "Peacock Premium": "peacock",
  "Peacock Premium Plus": "peacock",
  "Apple TV+": "appletv",
  "Apple TV Plus": "appletv",
  // NOTE deliberately absent: "Apple TV" (rent/buy store), channel bundles like
  // "Paramount+ Amazon Channel" (a different subscription than the app's key
  // implies). They land in the report instead.
};

function buildKeyResolver(logoKeys) {
  const byNorm = new Map(logoKeys.map((k) => [norm(k), k]));
  return (tmdbName) => {
    const target = PROVIDER_MAP[tmdbName];
    if (!target) return { fileKey: null, reason: "no mapping for TMDB provider name" };
    const fileKey = byNorm.get(target);
    if (!fileKey) return { fileKey: null, reason: 'maps to "' + target + '" but index.html has no such logo key' };
    return { fileKey, reason: null };
  };
}

// ── Match + provider logic (shared by real run and mock dry-run) ─────────────
function pickExactMatch(film, searchResults) {
  const want = film.t.trim().toLowerCase();
  const hits = (searchResults || []).filter((r) => {
    const yearOk = typeof r.release_date === "string" && r.release_date.startsWith(film.y + "-");
    const titleOk =
      (r.title || "").trim().toLowerCase() === want ||
      (r.original_title || "").trim().toLowerCase() === want;
    return yearOk && titleOk;
  });
  const ids = [...new Set(hits.map((r) => r.id))];
  if (ids.length === 1) return { id: ids[0], status: "ok" };
  if (ids.length === 0) return { id: null, status: "unmatched" };
  return { id: null, status: "ambiguous", candidates: ids };
}

function collectUsProviders(providersResponse) {
  const us = providersResponse?.results?.US;
  if (!us) return [];
  const names = [];
  for (const bucket of ["flatrate", "free", "ads"]) {
    for (const p of us[bucket] || []) {
      if (p?.provider_name && !names.includes(p.provider_name)) names.push(p.provider_name);
    }
  }
  return names;
}

function mapProviders(providerNames, resolveKey) {
  const platforms = [];
  const unmapped = [];
  for (const name of providerNames) {
    const { fileKey, reason } = resolveKey(name);
    if (fileKey) { if (!platforms.includes(fileKey)) platforms.push(fileKey); }
    else unmapped.push({ name, reason });
  }
  return { platforms, unmapped };
}

// ── TMDB HTTP (real run only) ────────────────────────────────────────────────
let lastRequestAt = 0;
async function tmdb(path, params, apiKey) {
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const url = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const headers = { Accept: "application/json" };
  if (apiKey.startsWith("eyJ")) headers.Authorization = "Bearer " + apiKey; // v4 read token
  else url.searchParams.set("api_key", apiKey); // classic v3 key

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "2", 10);
      await new Promise((r) => setTimeout(r, Math.max(retryAfter, 2) * 1000));
      continue;
    }
    if (res.status === 401) fail("TMDB rejected the key (401). Check TMDB_API_KEY.");
    if (!res.ok) {
      if (attempt < 3) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
      throw new Error("TMDB " + path + " returned HTTP " + res.status);
    }
    return res.json();
  }
  throw new Error("TMDB " + path + " kept rate-limiting after retries");
}

// ── State (resume support, real run only) ────────────────────────────────────
function loadState() {
  if (FRESH && existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
  if (existsSync(STATE_FILE)) {
    try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
    catch { console.error("WARNING: state file unreadable, starting fresh"); }
  }
  return { films: {} };
}
function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
}

// ── Output writers (real run only) ───────────────────────────────────────────
function renderOutput(films, state, asOf) {
  const lines = [];
  lines.push("// GENERATED " + asOf + " by scripts/streaming-backfill.mjs — TMDB /watch/providers, US region,");
  lines.push("// flatrate/free/ads only. Paste this over the STREAMING_AS_OF + STREAMING block in index.html.");
  lines.push('const STREAMING_AS_OF = "' + asOf + '";');
  lines.push("const STREAMING = {");
  let count = 0;
  for (const f of films) {
    const key = f.t + "|" + f.y;
    const r = state.films[key];
    if (r?.status === "ok" && r.platforms?.length) {
      lines.push("  " + JSON.stringify(key) + ": " + JSON.stringify(r.platforms) + ", // verified " + r.verifiedOn + " via TMDB watch/providers (US)");
      count++;
    }
  }
  lines.push("};");
  return { text: lines.join("\n") + "\n", count };
}

function renderReport(films, state, asOf, dupes, logoKeys) {
  const buckets = { unmatched: [], ambiguous: [], error: [], none: [] };
  const unmappedTally = new Map();
  let done = 0, withPlatforms = 0;
  for (const f of films) {
    const key = f.t + "|" + f.y;
    const r = state.films[key];
    if (!r) continue;
    done++;
    if (r.status === "ok") {
      if (r.platforms?.length) withPlatforms++;
      else buckets.none.push(key);
      for (const u of r.unmapped || []) {
        const t = unmappedTally.get(u.name) || { count: 0, reason: u.reason };
        t.count++;
        unmappedTally.set(u.name, t);
      }
    } else buckets[r.status]?.push(key + (r.detail ? "  (" + r.detail + ")" : ""));
  }
  const md = [];
  md.push("# Streaming backfill report — " + asOf);
  md.push("");
  md.push("Films processed: " + done + " of " + films.length);
  md.push("Films with at least one mapped platform: " + withPlatforms);
  md.push("Logo keys read from index.html: " + logoKeys.join(", "));
  md.push("");
  md.push("Everything below stayed OUT of streaming-output.js. Absence means unknown, not unavailable.");
  md.push("");
  md.push("## No exact TMDB match (title+year) — " + buckets.unmatched.length);
  md.push(buckets.unmatched.length ? buckets.unmatched.map((k) => "- " + k).join("\n") : "- none");
  md.push("");
  md.push("## Ambiguous (multiple exact matches, script refuses to pick) — " + buckets.ambiguous.length);
  md.push(buckets.ambiguous.length ? buckets.ambiguous.map((k) => "- " + k).join("\n") : "- none");
  md.push("");
  md.push("## Errored (network/API) — rerun the script to retry — " + buckets.error.length);
  md.push(buckets.error.length ? buckets.error.map((k) => "- " + k).join("\n") : "- none");
  md.push("");
  md.push("## Matched but no flatrate/free/ads streaming in US — " + buckets.none.length);
  md.push(buckets.none.length ? buckets.none.map((k) => "- " + k).join("\n") : "- none");
  md.push("");
  md.push("## TMDB provider names NOT mapped to any platform key (never guessed)");
  if (unmappedTally.size === 0) md.push("- none");
  else for (const [name, t] of [...unmappedTally.entries()].sort((a, b) => b[1].count - a[1].count)) {
    md.push("- " + name + " — seen on " + t.count + " film(s) — " + t.reason);
  }
  md.push("");
  if (dupes.length) {
    md.push("## WARNING: duplicate Title|Year keys in FILMS (entries would collide)");
    md.push(dupes.map((k) => "- " + k).join("\n"));
    md.push("");
  }
  return md.join("\n");
}

// ── Dry run: prove the parsing + pipeline on ONE clearly-labeled mock ────────
function dryRun() {
  const { films, logoKeys, dupes } = loadFromIndexHtml();
  const resolveKey = buildKeyResolver(logoKeys);

  console.log("DRY RUN — parsing check against the real index.html");
  console.log("  films parsed:        " + films.length);
  console.log("  first film:          " + films[0].t + "|" + films[0].y);
  console.log("  last film:           " + films[films.length - 1].t + "|" + films[films.length - 1].y);
  console.log("  logo keys found:     " + logoKeys.join(", "));
  console.log("  duplicate keys:      " + (dupes.length ? dupes.join(", ") : "none"));
  console.log("");

  // ══════════════════ MOCK TMDB RESPONSES — FAKE DATA ══════════════════
  // These two objects imitate TMDB's response shape so the pipeline can be
  // exercised without a key. The availability below is INVENTED and is
  // printed to stdout only — never written to any file.
  const sample = films[0];
  const MOCK_TMDB_SEARCH = {
    results: [
      { id: 999001, title: sample.t, original_title: sample.t, release_date: sample.y + "-03-15" },
      // near-miss on purpose: similar title, same year — must NOT be picked
      { id: 999002, title: sample.t + " Returns", original_title: sample.t + " Returns", release_date: sample.y + "-07-01" },
    ],
  };
  const MOCK_TMDB_PROVIDERS = {
    results: {
      US: {
        flatrate: [{ provider_name: "Netflix" }, { provider_name: "The Criterion Channel" }],
        ads: [{ provider_name: "Some Unknown Channel (mock)" }],
        buy: [{ provider_name: "Apple TV" }], // rent/buy bucket — must be ignored
      },
    },
  };
  // ═════════════════════════════════════════════════════════════════════

  const match = pickExactMatch(sample, MOCK_TMDB_SEARCH.results);
  const names = collectUsProviders(MOCK_TMDB_PROVIDERS);
  const { platforms, unmapped } = mapProviders(names, resolveKey);

  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║  MOCK DATA — NOT REAL AVAILABILITY — NOT WRITTEN TO ANY FILE       ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝");
  console.log("  mock search for:     " + sample.t + "|" + sample.y);
  console.log("  exact-match result:  " + (match.status === "ok" ? "picked id " + match.id + " (near-miss id 999002 correctly ignored)" : match.status));
  console.log("  providers returned:  " + names.join(", ") + "  (buy-bucket 'Apple TV' correctly ignored)");
  console.log("  mapped platforms:    " + JSON.stringify(platforms));
  console.log("  unmapped -> report:  " + unmapped.map((u) => u.name).join(", "));
  console.log("  would-be entry:      " + JSON.stringify(sample.t + "|" + sample.y) + ": " + JSON.stringify(platforms) + "  << MOCK, do not paste");
  console.log("");
  console.log("Dry run complete. No files written, no network calls made.");

  if (match.status !== "ok" || platforms.length !== 2 || unmapped.length !== 1) {
    fail("dry-run self-check FAILED — pipeline logic did not behave as expected");
  }
}

// ── Real run ─────────────────────────────────────────────────────────────────
async function realRun() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    fail("TMDB_API_KEY is not set. See scripts/README-STREAMING.md for the 3 steps.\n       (To test without a key: node scripts/streaming-backfill.mjs --dry-run)");
  }
  const { films, logoKeys, dupes } = loadFromIndexHtml();
  const resolveKey = buildKeyResolver(logoKeys);
  const state = loadState();
  const todo = films.slice(0, LIMIT === Infinity ? films.length : LIMIT);
  const already = todo.filter((f) => state.films[f.t + "|" + f.y]).length;

  console.log("Films in index.html: " + films.length + (LIMIT !== Infinity ? " (limiting to first " + LIMIT + ")" : ""));
  if (already) console.log("Resuming: " + already + " already done, " + (todo.length - already) + " to go (use --fresh to redo).");

  let processed = 0;
  for (const film of todo) {
    const key = film.t + "|" + film.y;
    if (state.films[key]) continue;
    try {
      const search = await tmdb("/search/movie", { query: film.t, primary_release_year: String(film.y), include_adult: "false" }, apiKey);
      const match = pickExactMatch(film, search.results);
      if (match.status !== "ok") {
        state.films[key] = { status: match.status, detail: match.candidates ? "TMDB ids " + match.candidates.join(", ") : undefined };
      } else {
        const provResp = await tmdb("/movie/" + match.id + "/watch/providers", {}, apiKey);
        const names = collectUsProviders(provResp);
        const { platforms, unmapped } = mapProviders(names, resolveKey);
        state.films[key] = { status: "ok", tmdbId: match.id, platforms, unmapped, verifiedOn: todayPacific() };
      }
    } catch (e) {
      state.films[key] = { status: "error", detail: e.message };
    }
    saveState(state);
    processed++;
    if (processed % 25 === 0) console.log("  ..." + processed + " fetched this session (" + key + ")");
  }

  const asOf = todayPacific();
  const { text, count } = renderOutput(films, state, asOf);
  writeFileSync(OUTPUT_FILE, text);
  writeFileSync(REPORT_FILE, renderReport(films, state, asOf, dupes, logoKeys));

  console.log("");
  console.log("Done. " + count + " films have verified streaming platforms.");
  console.log("  paste block: " + OUTPUT_FILE);
  console.log("  report:      " + REPORT_FILE);
  console.log("index.html was NOT modified — paste the block in yourself (or hand it to Claude).");
}

if (DRY_RUN) dryRun();
else await realRun();
