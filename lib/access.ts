import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "./store";

// ── Shared-link access gate ────────────────────────────────────────────────
// A client opens /?report=<id>; an unauthenticated visitor is bounced to /access
// where they enter an (email, access code) pair we provisioned. A valid pair sets
// a signed, httpOnly cookie scoped to exactly the report they're allowed to see
// (or "*" for the admin master code). All data APIs check + scope on this cookie.
//
// The gate is ACTIVE only when ACCESS_SECRET is set. With it unset the app behaves
// exactly as before (open) — so production turns the gate on by setting the env var,
// and local/dev stays open unless you set it. NEVER hardcode the secret.

const COOKIE_NAME = "aeo_access";
const TTL_DAYS = 30;
const ADMIN = "*";

// A grant covers a SET of reports: `reports` is the canonical form (a list of
// report ids, or ["*"] for the admin master scope). The legacy single-`report`
// field is still read so older cookies / magic tokens keep working.
export type Grant = { reports?: string[]; report?: string; email: string; exp: number };

// Normalize either grant shape to the list of report ids it unlocks.
function reportsOf(grant: Grant | null): string[] {
  if (!grant) return [];
  if (Array.isArray(grant.reports)) return grant.reports;
  return grant.report ? [grant.report] : [];
}

export function accessEnabled(): boolean {
  return Boolean(process.env.ACCESS_SECRET);
}

function secret(): string {
  const s = process.env.ACCESS_SECRET;
  if (!s) throw new Error("ACCESS_SECRET is not set");
  return s;
}

// HMAC the access code so plaintext codes are never stored in Supabase.
export function hashCode(code: string): string {
  return createHmac("sha256", secret()).update("code:" + code.trim()).digest("hex");
}

function eq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function signGrant(grant: Grant): string {
  const body = Buffer.from(JSON.stringify(grant)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyGrant(token?: string | null): Grant | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  if (!eq(sig, expected)) return null;
  try {
    const grant = JSON.parse(Buffer.from(body, "base64url").toString()) as Grant;
    if (!grant.exp || grant.exp < Date.now()) return null;
    return grant;
  } catch {
    return null;
  }
}

// Read + verify the current visitor's grant from the request cookies.
export async function currentGrant(): Promise<Grant | null> {
  if (!accessEnabled()) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return verifyGrant(token);
}

export function isAdmin(grant: Grant | null): boolean {
  return reportsOf(grant).includes(ADMIN);
}

export function grantsReport(grant: Grant | null, reportId: string): boolean {
  const r = reportsOf(grant);
  return r.includes(ADMIN) || r.includes(reportId);
}

// The concrete report ids a (non-admin) grant unlocks. Admin grants return ["*"];
// callers gate on isAdmin() before using this for a per-account report list.
export function grantedReportIds(grant: Grant | null): string[] {
  return reportsOf(grant);
}

export const ACCESS_COOKIE = COOKIE_NAME;

export function newGrantCookie(reports: string[], email: string) {
  const exp = Date.now() + TTL_DAYS * 86400 * 1000;
  return {
    name: COOKIE_NAME,
    value: signGrant({ reports, email: email.trim().toLowerCase(), exp }),
    options: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: TTL_DAYS * 86400 }
  };
}

// Validate an (email, code) pair against the report_access table and return
// EVERY report the pair unlocks — so a client whose account spans several
// markets gets one cookie that covers all of them (the service-area dropdown
// then works). Returns ["*"] for the admin master code, a list of report ids
// for a client code, or null if nothing matches. When a specific report is
// requested, the pair must cover it (else null) so a code can't be replayed
// against a report it wasn't issued for.
export async function findGrantedReports(email: string, code: string, reportId?: string): Promise<string[] | null> {
  if (!accessEnabled()) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("report_access")
    .select("report_id,code_hash,expires_at")
    .eq("email", email.trim().toLowerCase());
  if (error || !data) return null;
  const codeHash = hashCode(code);
  const granted: string[] = [];
  for (const row of data as Array<{ report_id: string; code_hash: string; expires_at: string | null }>) {
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) continue;
    if (eq(row.code_hash || "", codeHash)) granted.push(row.report_id);
  }
  if (!granted.length) return null;
  if (granted.includes(ADMIN)) return [ADMIN];
  // Guard: a per-report code can only open the report(s) it was issued for.
  if (reportId && !granted.includes(reportId)) return null;
  return granted;
}
