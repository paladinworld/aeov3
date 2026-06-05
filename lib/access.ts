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

export type Grant = { report: string; email: string; exp: number };

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
  return Boolean(grant && grant.report === ADMIN);
}

export function grantsReport(grant: Grant | null, reportId: string): boolean {
  return Boolean(grant && (grant.report === ADMIN || grant.report === reportId));
}

export const ACCESS_COOKIE = COOKIE_NAME;

export function newGrantCookie(report: string, email: string) {
  const exp = Date.now() + TTL_DAYS * 86400 * 1000;
  return {
    name: COOKIE_NAME,
    value: signGrant({ report, email: email.trim().toLowerCase(), exp }),
    options: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: TTL_DAYS * 86400 }
  };
}

// Validate an (email, code) pair against the report_access table.
// Returns the scope the pair unlocks ("*" for admin, or a specific report id),
// or null if no row matches. A pair matches when its row is for THIS report
// (a per-report client code) OR for "*" (the admin master code).
export async function findAccessScope(email: string, code: string, reportId?: string): Promise<string | null> {
  if (!accessEnabled()) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const wanted = [ADMIN, ...(reportId ? [reportId] : [])];
  const { data, error } = await supabase
    .from("report_access")
    .select("report_id,code_hash,expires_at")
    .eq("email", email.trim().toLowerCase())
    .in("report_id", wanted);
  if (error || !data) return null;
  const codeHash = hashCode(code);
  for (const row of data as Array<{ report_id: string; code_hash: string; expires_at: string | null }>) {
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) continue;
    if (eq(row.code_hash || "", codeHash)) return row.report_id;
  }
  return null;
}
