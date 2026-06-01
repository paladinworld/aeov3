/**
 * Export the REAL data from Supabase to data/db.json.
 *
 * Run this on the machine that has the Supabase env (the other Mac, inside the
 * aeolist repo so @supabase/supabase-js is installed):
 *
 *   # make sure SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set
 *   set -a; source .env; set +a          # or .env.local — load your env
 *   node scripts/export-from-supabase.mjs
 *
 * It writes ./data/db.json with every company + report payload. Hand me that file.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "fs/promises";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const [companies, reports] = await Promise.all([
  supabase.from("companies").select("payload").order("created_at", { ascending: false }),
  supabase.from("reports").select("payload").order("created_at", { ascending: false })
]);

if (companies.error) throw new Error("companies: " + companies.error.message);
if (reports.error) throw new Error("reports: " + reports.error.message);

const db = {
  companies: (companies.data ?? []).map((row) => row.payload),
  reports: (reports.data ?? []).map((row) => row.payload)
};

await mkdir("data", { recursive: true });
await writeFile("data/db.json", JSON.stringify(db, null, 2));

const names = db.companies.map((c) => c.name).join(", ");
console.log(`Exported ${db.companies.length} companies (${names}) and ${db.reports.length} reports to data/db.json`);
