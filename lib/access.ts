import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin, readCompanies, readReportsLight } from "./store";

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
// Lowercased before hashing so access codes are case-insensitive ("NETIC" == "netic").
export function hashCode(code: string): string {
  return createHmac("sha256", secret()).update("code:" + code.trim().toLowerCase()).digest("hex");
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

// ── Unlisted-link access (no login) ────────────────────────────────────────
// A bare `/?report=<id>` link is itself the credential: the (unguessable) report id
// grants read access to exactly that report — no email/code, no token, no redirect.
// First-time visitors still get the onboarding tour (it's client/localStorage-driven).
// The roster stays private: a link only unlocks its OWN brand (see brandScopeForReport),
// never the full list of audited companies.
export function grantFromReport(reportId?: string | null): Grant | null {
  if (!reportId) return null;
  return { reports: [reportId], email: "link", exp: Date.now() + 365 * 86400 * 1000 };
}

// Canonical brand key — MUST match DashboardClient.canonicalCompanyName so the server's
// scope and the client's area/vertical dropdown group companies identically.
const BRAND_STOPWORDS = new Set(["air", "and", "the", "hvac", "heat", "heating", "cooling", "conditioning", "plumbing", "electric", "electrical", "services", "service", "company", "home", "homes", "inc", "llc",
  "pest", "control", "exterminating", "exterminators", "exterminator", "termite", "termites", "tree", "trees", "arborist", "lawn", "landscape", "landscapes", "landscaping", "grounds", "garden", "gardens", "care", "expert", "experts", "pros", "group"]);
function brandKey(name: string): string {
  const tokens = (name || "").toLowerCase().split(/[^a-z0-9]+/g).filter((t) => t.length >= 3 && !BRAND_STOPWORDS.has(t));
  return tokens.join("") || (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// The report + company ids that share a directly-linked report's BRAND. An unlisted
// link to ONE market thus resolves that account's OTHER markets (dropdowns work) while
// exposing nothing about any other brand. Uses lightweight reads (no full payloads).
export async function brandScopeForReport(reportId?: string | null): Promise<{ reportIds: string[]; companyIds: string[] }> {
  if (!reportId) return { reportIds: [], companyIds: [] };
  const [companies, reports] = await Promise.all([readCompanies(), readReportsLight()]);
  const seed = reports.find((r) => r.id === reportId);
  const seedCo = seed && companies.find((c) => c.id === seed.companyId);
  if (!seed || !seedCo) return { reportIds: [reportId], companyIds: seed ? [seed.companyId] : [] };
  const brand = brandKey(seedCo.name);
  const companyIds = companies.filter((c) => brandKey(c.name) === brand).map((c) => c.id);
  const coSet = new Set(companyIds);
  const reportIds = reports.filter((r) => coSet.has(r.companyId)).map((r) => r.id);
  return { reportIds, companyIds };
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
