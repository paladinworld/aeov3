import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { Company, Database, Report } from "./types";

// AEO_DATA_DIR lets a run use an ISOLATED datastore (e.g. the market study), so it never
// reads/writes the main company db.json. Defaults to ./data — nothing changes for normal use.
const dataDir = process.env.AEO_DATA_DIR || path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "db.json");

const emptyDb: Database = {
  companies: [],
  reports: []
};

type CompanyRow = {
  id: string;
  payload: Company;
  created_at: string;
};

type ReportRow = {
  id: string;
  company_id: string;
  payload: Report;
  created_at: string;
};

export async function readDb(): Promise<Database> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const [companiesResult, reportsResult] = await Promise.all([
      supabase.from("companies").select("id,payload,created_at").order("created_at", { ascending: false }),
      supabase.from("reports").select("id,company_id,payload,created_at").order("created_at", { ascending: false })
    ]);

    if (companiesResult.error) {
      throw new Error(`Supabase companies read failed: ${companiesResult.error.message}`);
    }
    if (reportsResult.error) {
      throw new Error(`Supabase reports read failed: ${reportsResult.error.message}`);
    }

    return {
      companies: ((companiesResult.data ?? []) as CompanyRow[]).map((row) => row.payload),
      reports: ((reportsResult.data ?? []) as ReportRow[]).map((row) => row.payload)
    };
  }

  try {
    const raw = await readFile(dbPath, "utf8");
    return JSON.parse(raw) as Database;
  } catch {
    await mkdir(dataDir, { recursive: true });
    await writeDb(emptyDb);
    return emptyDb;
  }
}

// Fetch ONLY the requested report + its company. The per-report payloads are large
// (multi-MB once citations are captured), so loading every report's payload via
// readDb() just to find one would blow the serverless function's time/memory budget.
export async function readReportById(id: string): Promise<{ report: Report; company: Company } | null> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const reportResult = await supabase.from("reports").select("payload,company_id").eq("id", id).maybeSingle();
    if (reportResult.error) throw new Error(`Supabase report read failed: ${reportResult.error.message}`);
    if (!reportResult.data) return null;
    const row = reportResult.data as ReportRow;
    const companyResult = await supabase.from("companies").select("payload").eq("id", row.company_id).maybeSingle();
    if (companyResult.error) throw new Error(`Supabase company read failed: ${companyResult.error.message}`);
    if (!companyResult.data) return null;
    return { report: row.payload, company: (companyResult.data as CompanyRow).payload };
  }

  // Local-file fallback (dev): the whole file is small and fast to read.
  const db = await readDb();
  const report = db.reports.find((item) => item.id === id);
  if (!report) return null;
  const company = db.companies.find((item) => item.id === report.companyId);
  if (!company) return null;
  return { report, company };
}

// Companies only — never load the (huge) report payloads just to list companies.
export async function readCompanies(): Promise<Company[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const result = await supabase.from("companies").select("id,payload,created_at").order("created_at", { ascending: false });
    if (result.error) throw new Error(`Supabase companies read failed: ${result.error.message}`);
    return ((result.data ?? []) as CompanyRow[]).map((row) => row.payload);
  }
  return (await readDb()).companies;
}

// Lightweight report list — extract only id/company/status/createdAt from each row's
// JSONB, never the full payload. Loading all payloads (tens of MB) hits Postgres's
// statement timeout. status is pulled server-side via payload->>status.
export type ReportSummary = { id: string; companyId: string; status: Report["status"]; createdAt: string; vertical?: string; market?: boolean };
// Pass `ids` to restrict to a known set — the JSONB detoast then runs only on those rows,
// not all ~N reports. A report-link open only needs its own brand's handful, so filtering
// in the query (not in JS after loading everything) is what keeps it fast under concurrency.
export async function readReportsLight(ids?: string[]): Promise<ReportSummary[]> {
  if (ids && ids.length === 0) return [];
  const supabase = getSupabaseAdmin();
  if (supabase) {
    let query = supabase
      .from("reports")
      .select("id,company_id,created_at,status:payload->>status,vertical:payload->>vertical,market:payload->>market");
    if (ids) query = query.in("id", ids);
    const result = await query.order("created_at", { ascending: false });
    if (result.error) throw new Error(`Supabase reports read failed: ${result.error.message}`);
    return ((result.data ?? []) as Array<{ id: string; company_id: string; created_at: string; status: string | null; vertical: string | null; market: string | null }>).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      status: (row.status as Report["status"]) ?? "complete",
      createdAt: row.created_at,
      vertical: row.vertical ?? "HVAC",
      market: row.market === "true"
    }));
  }
  const idSet = ids ? new Set(ids) : null;
  return (await readDb()).reports.filter((report) => !idSet || idSet.has(report.id)).map((report) => ({
    id: report.id,
    companyId: report.companyId,
    status: report.status,
    createdAt: report.createdAt,
    vertical: report.vertical ?? "HVAC",
    market: Boolean(report.market)
  }));
}

// Report id -> company id map, from REAL columns only (id, company_id). No payload->>
// extraction, so Postgres never detoasts the (multi-MB) JSONB payloads. Safe to call on
// every report-link open, even under concurrency — unlike readReportsLight, which detoasts
// every row and 500s when several requests pile up. Use this whenever you only need the
// report<->company graph (e.g. brandScopeForReport), not per-report status/vertical/market.
export async function readReportRefs(): Promise<Array<{ id: string; companyId: string }>> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const result = await supabase.from("reports").select("id,company_id").order("created_at", { ascending: false });
    if (result.error) throw new Error(`Supabase report refs read failed: ${result.error.message}`);
    return ((result.data ?? []) as Array<{ id: string; company_id: string }>).map((row) => ({ id: row.id, companyId: row.company_id }));
  }
  return (await readDb()).reports.map((report) => ({ id: report.id, companyId: report.companyId }));
}

// The two scalars the /?report= landing page needs (company name for <title>, market flag
// to pick the view) — WITHOUT transferring the report's multi-MB payload to the app. Postgres
// extracts the scalar server-side (payload->>market detoasts one row internally but sends only
// the value). readReportById here pulled the whole payload just to read a boolean, which is the
// per-request cost that balloons to ~7s+ when several report links are opened at once.
export async function readReportMeta(id: string): Promise<{ market: boolean; companyId: string; companyName: string } | null> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const r = await supabase.from("reports").select("company_id,market:payload->>market").eq("id", id).maybeSingle();
    if (r.error) throw new Error(`Supabase report meta read failed: ${r.error.message}`);
    if (!r.data) return null;
    const row = r.data as { company_id: string; market: string | null };
    const c = await supabase.from("companies").select("name:payload->>name").eq("id", row.company_id).maybeSingle();
    if (c.error) throw new Error(`Supabase company name read failed: ${c.error.message}`);
    return { market: row.market === "true", companyId: row.company_id, companyName: (c.data as { name: string | null } | null)?.name ?? "" };
  }
  const db = await readDb();
  const rep = db.reports.find((item) => item.id === id);
  if (!rep) return null;
  const co = db.companies.find((item) => item.id === rep.companyId);
  return { market: Boolean(rep.market), companyId: rep.companyId, companyName: co?.name ?? "" };
}

export async function writeDb(db: Database) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const companies = db.companies.map((company) => ({
      id: company.id,
      payload: company,
      created_at: company.createdAt,
      updated_at: new Date().toISOString()
    }));
    const reports = db.reports.map((report) => ({
      id: report.id,
      company_id: report.companyId,
      payload: report,
      created_at: report.createdAt,
      updated_at: new Date().toISOString()
    }));

    if (companies.length) {
      const { error } = await supabase.from("companies").upsert(companies);
      if (error) throw new Error(`Supabase companies write failed: ${error.message}`);
    }

    if (reports.length) {
      const { error } = await supabase.from("reports").upsert(reports);
      if (error) throw new Error(`Supabase reports write failed: ${error.message}`);
    }

    return;
  }

  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

export function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
