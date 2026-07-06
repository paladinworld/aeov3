#!/usr/bin/env node
// One-command AI-visibility audit — the fixated process (see AUDIT-RUNBOOK.md), codified.
//
//   node scripts/audit.mjs --name "Frymire Home Services" --url frymire.com --city Dallas --state TX
//
// Flags:
//   --name     (required) company name
//   --url      (required) website
//   --city     (required) service-area city
//   --state    (required) 2-letter state
//   --vertical (default HVAC)
//   --repeats  (default 5)        runs per prompt
//   --limit    (optional)         cap number of prompts (for cheap tests)
//   --quick    shortcut for --repeats 1 --limit 3 (smoke test, ~$0.05)
//   --port     (default 3000)     dev-server port
//   --push     after the run, upsert to prod Supabase + mint a no-login share link
//              (needs env SB_KEY = prod service_role, PROD_ACCESS_SECRET)
//
// Pre-flight aborts early if Vertex auth, DataForSEO balance, or the dev server is down —
// so a 30-min run never dies halfway on a stale token.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

function arg(name, def) { const i = process.argv.indexOf("--" + name); if (i < 0) return def; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; }
const quick = Boolean(arg("quick", false));
// --market: market-level report (no target company). Head prompts only, no follow-up, + SEO
// SERP column. Ranks the whole field. Default 3 repeats; name/url auto-derived from the market.
const market = Boolean(arg("market", false));
const cfg = {
  name: arg("name") || (market ? `${arg("vertical", "HVAC")} — ${arg("city")}, ${arg("state")}` : undefined),
  url: arg("url") || (market ? "market://landscape" : undefined),
  city: arg("city"), state: arg("state"),
  vertical: arg("vertical", "HVAC"),
  repeats: Number(arg("repeats", quick ? 1 : market ? 3 : 5)),
  limit: arg("limit", quick ? 3 : undefined),
  port: arg("port", "3000"),
  push: Boolean(arg("push", false)),
  market,
};
const required = market ? ["city", "state"] : ["name", "url", "city", "state"];
for (const k of required) if (!cfg[k]) { console.error(`Missing --${k}`); process.exit(1); }
const BASE = `http://127.0.0.1:${cfg.port}`;
// Cosmetic company metadata only — prompts are driven by --vertical via PROMPTS_BY_VERTICAL
// (lib/query-generator.ts), NOT by this list. Keyed so a non-HVAC record isn't stamped HVAC.
const SERVICES_BY_VERTICAL = {
  "HVAC": ["AC repair","AC installation","Furnace repair","Furnace installation","Heat pump repair","Ductless mini split","Indoor air quality","Duct cleaning","Emergency HVAC","Maintenance/tune-up"],
  "Pest Control": ["General pest control","Emergency pest control","Termite control","Bed bug control","Ant control","Rodent control","Mosquito control","Quarterly pest control"],
  "Plumbing": ["General plumbing","Emergency plumbing","Water heater","Tankless water heater","Drain cleaning","Sewer line","Leak repair","Repipe","Commercial plumbing"],
  "Roofing": ["General roofing","Roof repair","Roof replacement","Metal roofing","Shingle roofing","Flat roofing","Leak repair","Storm damage","Roof inspection","Commercial roofing"],
  "Windows": ["Window replacement","Window installation","Energy efficient windows","Vinyl windows","Specialty windows","Storm windows","Glass replacement","Window repair","Doors"],
  "Foundation": ["Foundation repair","Crack repair","Waterproofing","Crawl space","House leveling","Pier & beam","Slab repair","Structural repair","Foundation inspection","Piering"],
  "Water Treatment": ["Water softener","Water filtration","Reverse osmosis","Whole house filtration","Well water treatment","Water testing","Drinking water systems","Iron/sulfur removal"],
  "Water Heater": ["Water heater installation","Water heater repair","Tankless water heater","Water heater replacement","Gas water heater","Electric water heater","Heat pump water heater","Emergency water heater"],
};
const SERVICES = SERVICES_BY_VERTICAL[cfg.vertical] || SERVICES_BY_VERTICAL["HVAC"];
const log = (...a) => console.log(...a);

// Mirror of lib/providers/google-aio.ts location handling, so the pre-flight probe sends
// exactly what the run will. Keep REGION_ALIASES in sync with the provider.
const US_STATES = { AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia" };
const REGION_ALIASES = { "long island,ny":"Hempstead,New York,United States","inland empire,ca":"Riverside,California,United States","bay area,ca":"San Francisco,California,United States","south bay,ca":"San Jose,California,United States","silicon valley,ca":"San Jose,California,United States","dmv,dc":"Washington,District of Columbia,United States","northern virginia,va":"Arlington,Virginia,United States","central florida,fl":"Orlando,Florida,United States","south florida,fl":"Miami,Florida,United States","the triangle,nc":"Raleigh,North Carolina,United States","triangle,nc":"Raleigh,North Carolina,United States" };
function dfsLocationName(city, state) {
  const s2 = (state || "").toUpperCase().trim();
  const alias = REGION_ALIASES[`${(city || "").toLowerCase().trim()},${s2.toLowerCase()}`];
  if (alias) return alias;
  return [city, US_STATES[s2] || state, "United States"].filter(Boolean).join(",");
}
function dfsStateLocation(state) { const f = US_STATES[(state || "").toUpperCase().trim()] || state; return f ? `${f},United States` : null; }

async function preflight() {
  log("• Pre-flight");
  // Vertex auth (service account or ADC)
  if (env.GOOGLE_APPLICATION_CREDENTIALS) process.env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS;
  try {
    const a = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
    const t = await (await a.getClient()).getAccessToken();
    if (!t.token) throw new Error("no token");
    const who = (await a.getCredentials()).client_email || "ADC user";
    log(`  ✓ Vertex auth (${who})`);
  } catch (e) { console.error(`  ✗ Vertex auth FAILED: ${e.message}\n    → service account broken, or run: gcloud auth application-default login`); process.exit(1); }
  // DataForSEO balance
  try {
    const r = await fetch("https://api.dataforseo.com/v3/appendix/user_data", { headers: { Authorization: "Basic " + env.DATAFORSEO_B64 } });
    const bal = (await r.json()).tasks?.[0]?.result?.[0]?.money?.balance;
    if (!(bal > 0)) throw new Error("balance " + bal);
    log(`  ✓ DataForSEO balance $${bal}`);
  } catch (e) { console.error(`  ✗ DataForSEO FAILED: ${e.message}`); process.exit(1); }
  // AI Mode location probe — ONE ~$0.004 call to confirm DataForSEO accepts this market's
  // location BEFORE any Gemini/ChatGPT spend. This is the Long-Island 40501 guard: catch a
  // bad/region location here instead of after an unusable full run. Mirrors the provider's
  // alias + state-fallback, so passing here means the real AI Mode runs will resolve too.
  try {
    const probe = async (loc) => {
      const r = await fetch("https://api.dataforseo.com/v3/serp/google/ai_mode/live/advanced", {
        method: "POST", headers: { Authorization: "Basic " + env.DATAFORSEO_B64, "Content-Type": "application/json" },
        body: JSON.stringify([{ keyword: `best ${cfg.vertical} company in ${cfg.city}, ${cfg.state}`, location_name: loc, language_code: "en" }])
      });
      return (await r.json()).tasks?.[0]?.status_code;
    };
    let loc = dfsLocationName(cfg.city, cfg.state);
    let sc = await probe(loc);
    if (sc === 40501) { const st = dfsStateLocation(cfg.state); if (st) { sc = await probe(st); loc = st; } } // mirror provider fallback
    if (sc !== 20000) throw new Error(`DataForSEO rejected location (status ${sc}) for "${cfg.city}, ${cfg.state}" — add a REGION_ALIASES entry in google-aio.ts (and here)`);
    log(`  ✓ AI Mode location ok → ${loc}`);
  } catch (e) { console.error(`  ✗ AI Mode location FAILED: ${e.message}`); process.exit(1); }
  // dev server
  try { const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error("HTTP " + r.status); log(`  ✓ Dev server ${BASE}`); }
  catch { console.error(`  ✗ Dev server not up at ${BASE} → npm run dev`); process.exit(1); }
}

function adminCookie() {
  const g = { reports: ["*"], email: "audit-cli", exp: Date.now() + 3600e3 };
  const b = Buffer.from(JSON.stringify(g)).toString("base64url");
  return "aeo_access=" + b + "." + crypto.createHmac("sha256", env.ACCESS_SECRET || "").update(b).digest("base64url");
}
const J = (cookie, method, url, body) => fetch(BASE + url, { method, headers: { "Content-Type": "application/json", Cookie: cookie }, body: body && JSON.stringify(body) });

async function run() {
  await preflight();
  const cookie = adminCookie();
  log(`• Creating "${cfg.name}" — ${cfg.city}, ${cfg.state} (${cfg.vertical})`);
  let r = await J(cookie, "POST", "/api/companies", { name: cfg.name, website: cfg.url, services: SERVICES, competitors: [], locations: [{ label: `${cfg.city} Service Area`, city: cfg.city, state: cfg.state, isPrimary: true }] });
  if (!r.ok) { console.error("  company create failed:", r.status, await r.text()); process.exit(1); }
  const co = await r.json();
  const body = { companyId: co.id, locationIds: [co.locations[0].id], vertical: cfg.vertical, repeatRuns: cfg.repeats };
  if (cfg.limit) body.queryLimit = Number(cfg.limit);
  if (cfg.market) body.market = true;
  r = await J(cookie, "POST", "/api/reports", body);
  if (!r.ok) { console.error("  report create failed:", r.status, await r.text()); process.exit(1); }
  const rep = await r.json();
  const surfaces = [...new Set(rep.queries.flatMap((q) => q.surfaces))];
  log(`  report ${rep.id} | ${rep.queries.length} prompts × ${cfg.repeats} | surfaces: ${surfaces.join(", ")}`);
  if (!surfaces.includes("google_ai_overview")) log("  ⚠ AI Mode surface missing — query generator may not be updated");

  log(`• Running (${cfg.repeats} repeats × 3 engines)… this can take a while`);
  const t0 = Date.now();
  // Fire the run DETACHED. /run is synchronous server-side (no response headers until the
  // whole audit finishes), so awaiting it trips Node's undici HeadersTimeout on any real run.
  // Instead kick it off and poll file-mode db.json for status — matches the manual workflow.
  J(cookie, "POST", `/api/reports/${rep.id}/run`, {}).catch(() => {});
  const dbPath = path.join(process.env.AEO_DATA_DIR || path.join(ROOT, "data"), "db.json"); // isolated store (market study) or default
  let done = null;
  for (let i = 0; i < 360; i++) { // poll up to ~60 min
    await new Promise((res) => setTimeout(res, 10000));
    try {
      const rr = JSON.parse(fs.readFileSync(dbPath, "utf8")).reports.find((x) => x.id === rep.id);
      if (rr?.status === "complete") { done = rr; break; }
      if (rr?.status === "failed") { console.error("  run failed (status: failed)"); process.exit(1); }
      if (rr) process.stdout.write(`\r  …${rr.runs.length} runs`);
    } catch { /* mid-write read; retry next tick */ }
  }
  process.stdout.write("\n");
  if (!done) { console.error("  run did not complete within 60 min"); process.exit(1); }
  const mins = ((Date.now() - t0) / 60000).toFixed(1);

  // readout
  const ENG = { gemini_search: "Gemini", google_ai_overview: "AI Mode", chatgpt_search: "ChatGPT" };
  let errs = 0;
  log(`• Done in ${mins}m — ${done.status}`);
  for (const s of Object.keys(ENG)) errs += done.runs.filter((x) => x.surface === s && String(x.rawAnswer).startsWith("Provider error:")).length;

  if (cfg.market) {
    // Market mode: no target — show the AI share-of-voice leaderboard + SERP coverage.
    const tally = {};
    for (const x of done.runs) {
      if (x.surface === "gemini_maps" || String(x.rawAnswer).startsWith("Provider error:")) continue;
      for (const mtn of (x.mentions || [])) { const n = (mtn.companyName || "").trim(); if (n) tally[n] = (tally[n] || 0) + 1; }
    }
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const serpN = done.serp ? Object.keys(done.serp).length : 0;
    log(`  AI share-of-voice leaderboard (top 15 of ${Object.keys(tally).length} companies named):`);
    top.forEach(([n, c], i) => log(`   ${String(i + 1).padStart(2)}. ${String(c).padStart(3)}  ${n}`));
    log(`  SEO/SERP captured for ${serpN}/${done.queries.length} prompts | errors: ${errs}`);
  } else {
    for (const s of Object.keys(ENG)) {
      const real = done.runs.filter((x) => x.surface === s && !String(x.rawAnswer).startsWith("Provider error:"));
      const m = real.filter((x) => (x.mentions || []).some((z) => z.isTarget));
      const ranks = m.map((x) => (x.mentions || []).find((z) => z.isTarget)?.rank).filter(Boolean);
      const r1 = ranks.filter((x) => x === 1).length;
      log(`  ${ENG[s].padEnd(8)} mention ${Math.round(100 * m.length / (real.length || 1))}% | #1 ×${r1} | avg rank ${ranks.length ? (ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1) : "-"}`);
    }
    log(`  errors: ${errs}`);
  }
  log(`• Review: ${BASE}/?report=${rep.id}`);

  if (cfg.push) await push(rep.id, co.id);
  log(`✓ REPORT_ID=${rep.id}`);
}

async function push(reportId, companyId) {
  // Prod secrets live in .env.push.local (gitignored, NOT auto-loaded by Next — so the dev
  // server can never use them to write prod; only this script reads them). Inline env vars
  // (SB_KEY / PROD_ACCESS_SECRET) still override, for one-off use.
  let pushEnv = {};
  const pushPath = path.join(ROOT, ".env.push.local");
  if (fs.existsSync(pushPath)) {
    pushEnv = Object.fromEntries(
      fs.readFileSync(pushPath, "utf8").split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    );
  }
  const SB = env.SUPABASE_URL, KEY = process.env.SB_KEY || pushEnv.SB_KEY, SECRET = process.env.PROD_ACCESS_SECRET || pushEnv.PROD_ACCESS_SECRET;
  if (!KEY || !SECRET) { log("• --push skipped: add SB_KEY + PROD_ACCESS_SECRET to .env.push.local (or pass as env vars)"); return; }
  const db = JSON.parse(fs.readFileSync(path.join(process.env.AEO_DATA_DIR || path.join(ROOT, "data"), "db.json"), "utf8"));
  const rep = db.reports.find((x) => x.id === reportId), co = db.companies.find((x) => x.id === companyId);
  const now = new Date().toISOString();
  const up = (table, rows) => fetch(`${SB}/rest/v1/${table}`, { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
  await up("companies", [{ id: co.id, payload: co, created_at: co.createdAt, updated_at: now }]);
  await up("reports", [{ id: rep.id, company_id: rep.companyId, payload: rep, created_at: rep.createdAt, updated_at: now }]);
  const g = { reports: [reportId], email: "share-link", exp: Date.now() + 365 * 86400e3 };
  const b = Buffer.from(JSON.stringify(g)).toString("base64url");
  const tok = b + "." + crypto.createHmac("sha256", SECRET).update(b).digest("base64url");
  log(`• Pushed to prod. Share: https://aisearch-neticlabs.vercel.app/?report=${reportId}&t=${tok}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
