#!/usr/bin/env node
// publish.mjs — the ONE "go live" step. Optionally push a local report to prod, then
// rebuild BOTH trackers from prod (the single source of truth) so they never drift:
//   1. PROD-REPORTS.md          (the markdown registry)
//   2. ~/Projects/netic-ops/tracker-data.json  (the :3100 Reports Tracker)
// Both use clean bare `?report=<id>` URLs (no tokens — the gate is public-by-id now).
//
//   SB_KEY=<prod service_role> node scripts/publish.mjs [reportId]
//
// With a reportId: upsert that report+company from local db.json to prod, then sync.
// Without: just re-sync the trackers from whatever's already in prod.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.SB_KEY;
if (!KEY) { console.error("Set SB_KEY (prod service_role)"); process.exit(1); }
const SB = "https://ipmguqnjhrvjgqmzvtkk.supabase.co";
const PROD = "https://aisearch-neticlabs.vercel.app";
const TRACKER = "/Users/shanzhong/Projects/netic-ops/tracker-data.json";
const H = { apikey: KEY, Authorization: "Bearer " + KEY };
const bareUrl = (id) => `${PROD}/?report=${id}`;

// Blended-engine mention rate per surface, on the stored (already target-matched) mentions.
const ENG = { gemini_search: "Gemini", google_ai_overview: "AI Mode", chatgpt_search: "ChatGPT" };
function scores(report) {
  const out = {};
  for (const s of Object.keys(ENG)) {
    const real = (report.runs || []).filter((x) => x.surface === s && !String(x.rawAnswer).startsWith("Provider error:"));
    const m = real.filter((x) => (x.mentions || []).some((z) => z.isTarget));
    out[ENG[s]] = real.length ? Math.round((100 * m.length) / real.length) : 0;
  }
  return out;
}
const scoreNote = (sc) => `Gemini ${sc.Gemini}% / AI Mode ${sc["AI Mode"]}% / ChatGPT ${sc.ChatGPT}%`;

async function main() {
  const reportId = process.argv[2];

  // 1. Optional: push one local report → prod.
  if (reportId) {
    const db = JSON.parse(fs.readFileSync(path.join(process.env.AEO_DATA_DIR || path.join(ROOT, "data"), "db.json"), "utf8"));
    const rep = db.reports.find((x) => x.id === reportId);
    if (!rep) { console.error(`Report ${reportId} not in local db.json`); process.exit(1); }
    const co = db.companies.find((x) => x.id === rep.companyId);
    const now = new Date().toISOString();
    const up = (t, rows) => fetch(`${SB}/rest/v1/${t}`, { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    let r = await up("companies", [{ id: co.id, payload: co, created_at: co.createdAt, updated_at: now }]);
    if (!r.ok) throw new Error("company upsert " + r.status);
    r = await up("reports", [{ id: rep.id, company_id: rep.companyId, payload: rep, created_at: rep.createdAt, updated_at: now }]);
    if (!r.ok) throw new Error("report upsert " + r.status);
    console.log(`✓ pushed ${co.name} — ${(co.locations[0] || {}).city} → prod`);
  }

  // 2. Read from prod (source of truth). Full payloads are too big to fetch in one query
  //    (Postgres statement timeout), so list lightly then fetch each report's payload by id.
  const light = await (await fetch(`${SB}/rest/v1/reports?select=id,company_id,created_at&order=created_at.asc`, { headers: H })).json();
  if (!Array.isArray(light)) throw new Error("reports list: " + JSON.stringify(light));
  const pool = async (items, n, fn) => { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; };
  const reps = await pool(light, 5, async (lr) => {
    const j = await (await fetch(`${SB}/rest/v1/reports?id=eq.${lr.id}&select=id,company_id,payload,created_at`, { headers: H })).json();
    return Array.isArray(j) && j[0] ? j[0] : { id: lr.id, company_id: lr.company_id, payload: {}, created_at: lr.created_at };
  });
  const cos = await (await fetch(`${SB}/rest/v1/companies?select=id,payload`, { headers: H })).json();
  const coById = new Map(cos.map((c) => [c.id, c.payload]));

  const rows = reps.map((row) => {
    const co = coById.get(row.company_id) || {};
    const loc = (co.locations || []).find((l) => l.isPrimary) || (co.locations || [])[0] || {};
    return { id: row.id, company: co.name || "(unknown)", city: loc.city || "?", state: loc.state || "?", vertical: row.payload?.vertical || "HVAC", sc: scores(row.payload || {}), url: bareUrl(row.id) };
  });

  // 3. Rebuild PROD-REPORTS.md (grouped by company).
  const byCompany = new Map();
  for (const r of rows) { if (!byCompany.has(r.company)) byCompany.set(r.company, []); byCompany.get(r.company).push(r); }
  let md = `# AEO V3 — Live Prod Reports\n\nSingle source of truth for every report in prod + its no-login link (bare \`?report=<id>\`, public by id).\n`;
  md += `Regenerate after any push: \`SB_KEY=… node scripts/publish.mjs [reportId]\`.\n\n_${rows.length} reports · ${byCompany.size} companies._\n\n---\n\n`;
  for (const [name, rs] of [...byCompany.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `## ${name}\n\n`;
    for (const r of rs.sort((a, b) => a.city.localeCompare(b.city))) md += `- **${r.city}, ${r.state}** (${r.vertical}) — ${scoreNote(r.sc)}\n  ${r.url}\n`;
    md += `\n`;
  }
  fs.writeFileSync(path.join(ROOT, "PROD-REPORTS.md"), md);

  // 4. Merge into the :3100 tracker — key by report id (from reportUrl), PRESERVE manual
  //    fields (accountEmail, client, revenue…), update url + score note, append new reports.
  const tracker = JSON.parse(fs.readFileSync(TRACKER, "utf8"));
  fs.writeFileSync(TRACKER.replace(".json", `.backup-${Date.now()}.json`), JSON.stringify(tracker, null, 2));
  const idOf = (u) => (String(u || "").match(/report=(report_[a-z0-9_]+)/) || [])[1];
  const byId = new Map(tracker.rows.map((row) => [idOf(row.reportUrl), row]));
  const base = { status: "Generated", accountEmail: "", accessCode: "", firstName: "", lastName: "", revenue: "", industry: "HVAC", serviceArea: "", client: "" };
  for (const r of rows) {
    const note = `${r.vertical} · no-login link · ${scoreNote(r.sc)}`;
    const existing = byId.get(r.id);
    if (existing) { existing.reportUrl = r.url; existing.area = `${r.city} (${r.state})`; existing.company = r.company; existing.industry = r.vertical; existing.notes = note; }
    else tracker.rows.push({ ...base, company: r.company, area: `${r.city} (${r.state})`, industry: r.vertical, reportUrl: r.url, notes: note });
  }
  // Drop tracker rows whose report no longer exists in prod (e.g. deleted markets).
  const liveIds = new Set(rows.map((r) => r.id));
  tracker.rows = tracker.rows.filter((row) => { const id = idOf(row.reportUrl); return !id || liveIds.has(id); });
  fs.writeFileSync(TRACKER, JSON.stringify(tracker, null, 2));

  console.log(`✓ synced trackers from prod: ${rows.length} reports → PROD-REPORTS.md + :3100 (${tracker.rows.length} rows)`);
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
