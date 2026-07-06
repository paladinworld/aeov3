#!/usr/bin/env node
// Regenerate PROD-REPORTS.md — the single source of truth for every live prod report and
// its no-login share link. Run this after ANY push and the registry is current.
//
//   SB_KEY=<prod service_role> PROD_ACCESS_SECRET=<prod ACCESS_SECRET> node scripts/prod-registry.mjs
//
// Secrets come from env (never hardcoded / never written to .env.local). It reads every
// report + company from prod Supabase, mints a 365-day single-report token for each, and
// writes a markdown registry grouped by company.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.SB_KEY, SECRET = process.env.PROD_ACCESS_SECRET;
const SB = "https://ipmguqnjhrvjgqmzvtkk.supabase.co";
const PROD = "https://aisearch-neticlabs.vercel.app";
if (!KEY || !SECRET) { console.error("Set SB_KEY (prod service_role) + PROD_ACCESS_SECRET"); process.exit(1); }
const H = { apikey: KEY, Authorization: "Bearer " + KEY };

function mintLink(reportId) {
  const g = { reports: [reportId], email: "share-link", exp: Date.now() + 365 * 86400e3 };
  const b = Buffer.from(JSON.stringify(g)).toString("base64url");
  const tok = b + "." + crypto.createHmac("sha256", SECRET).update(b).digest("base64url");
  return `${PROD}/?report=${reportId}&t=${tok}`;
}

(async () => {
  const reps = await (await fetch(`${SB}/rest/v1/reports?select=id,company_id,created_at,status:payload->>status,vertical:payload->>vertical&order=created_at.asc`, { headers: H })).json();
  const cos = await (await fetch(`${SB}/rest/v1/companies?select=id,payload`, { headers: H })).json();
  const coById = new Map(cos.map((c) => [c.id, c.payload]));

  // group by company name (canonical-ish), each row a market
  const byCompany = new Map();
  for (const r of reps) {
    const co = coById.get(r.company_id) || {};
    const loc = (co.locations || []).find((l) => l.isPrimary) || (co.locations || [])[0] || {};
    const name = co.name || "(unknown)";
    if (!byCompany.has(name)) byCompany.set(name, []);
    byCompany.get(name).push({ market: `${loc.city || "?"}, ${loc.state || "?"}`, vertical: r.vertical || "HVAC", status: r.status || "?", id: r.id, url: mintLink(r.id) });
  }

  let md = `# AEO V3 — Live Prod Reports\n\n`;
  md += `Single source of truth for every report pushed to prod + its no-login share link.\n`;
  md += `Prod app: ${PROD} · Supabase \`ipmguqnjhrvjgqmzvtkk\`. Links are single-report scoped, valid 365 days.\n\n`;
  md += `**Regenerate:** \`SB_KEY=… PROD_ACCESS_SECRET=… node scripts/prod-registry.mjs\` (run after any push).\n\n`;
  md += `_${reps.length} reports across ${byCompany.size} companies._\n\n---\n\n`;
  for (const [name, rows] of [...byCompany.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `## ${name}\n\n`;
    for (const row of rows.sort((a, b) => a.market.localeCompare(b.market))) {
      md += `- **${row.market}** (${row.vertical})${row.status !== "complete" ? ` _[${row.status}]_` : ""}\n  ${row.url}\n`;
    }
    md += `\n`;
  }
  fs.writeFileSync(path.join(ROOT, "PROD-REPORTS.md"), md);
  console.log(`Wrote PROD-REPORTS.md — ${reps.length} reports, ${byCompany.size} companies.`);
})().catch((e) => { console.error(e); process.exit(1); });
