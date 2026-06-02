import fs from "node:fs";

const SB_TOKEN = process.env.SB_TOKEN;
const REF = process.env.REF;
const url = `https://${REF}.supabase.co`;

// Pull the service_role key from the Management API (so it's never hard-coded).
const keysRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
  headers: { Authorization: `Bearer ${SB_TOKEN}` }
});
const keys = await keysRes.json();
const serviceKey = keys.find((k) => k.name === "service_role").api_key;

const db = JSON.parse(fs.readFileSync("data/db.json", "utf8"));
const now = new Date().toISOString();
const companies = db.companies.map((c) => ({ id: c.id, payload: c, created_at: c.createdAt, updated_at: now }));
const reports = db.reports.map((r) => ({ id: r.id, company_id: r.companyId, payload: r, created_at: r.createdAt, updated_at: now }));

async function upsert(table, rows) {
  // chunk to keep request bodies modest (reports carry hundreds of runs each)
  const size = 25;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(chunk)
    });
    if (!res.ok) {
      console.log(`${table} chunk ${i}-${i + chunk.length} FAILED ${res.status}:`, await res.text());
      return;
    }
  }
  console.log(`${table}: upserted ${rows.length}`);
}

await upsert("companies", companies);
await upsert("reports", reports);

for (const t of ["companies", "reports", "signups"]) {
  const r = await fetch(`${url}/rest/v1/${t}?select=id`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: "count=exact", Range: "0-0" }
  });
  console.log(`${t} count:`, r.headers.get("content-range"));
}
