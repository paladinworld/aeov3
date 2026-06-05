// Grant (or update) a sign-in pair for a shared report.
//
//   node scripts/grant-access.mjs <email> <code> <reportId|*> [expiresInDays]
//
// Examples:
//   node scripts/grant-access.mjs jane@acme.com R7K2QF report_mq15y3ih_y9p4hr   # client → one report
//   node scripts/grant-access.mjs you@netic.ai MASTER123 "*"                     # admin master code → everything
//
// The code is HMAC-hashed with ACCESS_SECRET (same as lib/access.ts) and stored in
// the report_access table; the plaintext code is never persisted. You then email the
// person their code + link (e.g. https://<site>/?report=<reportId>).
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const [, , email, code, reportId, expiresInDays] = process.argv;
if (!email || !code || !reportId) {
  console.error("usage: node scripts/grant-access.mjs <email> <code> <reportId|*> [expiresInDays]");
  process.exit(1);
}
if (!env.ACCESS_SECRET) { console.error("ACCESS_SECRET is not set in .env.local"); process.exit(1); }
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) { console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env.local"); process.exit(1); }

const codeHash = createHmac("sha256", env.ACCESS_SECRET).update("code:" + code.trim()).digest("hex");
const now = new Date();
const expiresAt = expiresInDays ? new Date(now.getTime() + Number(expiresInDays) * 86400 * 1000).toISOString() : null;

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const row = {
  email: email.trim().toLowerCase(),
  report_id: reportId,
  code_hash: codeHash,
  created_at: now.toISOString(),
  expires_at: expiresAt
};
const { error } = await sb.from("report_access").upsert(row, { onConflict: "email,report_id" });
if (error) { console.error("grant FAILED:", error.message); process.exit(1); }
console.log(`granted: ${row.email} → ${reportId === "*" ? "ALL reports (admin)" : reportId}${expiresAt ? ` (expires ${expiresAt.slice(0, 10)})` : ""}`);
