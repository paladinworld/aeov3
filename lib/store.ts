import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { Company, Database, Report } from "./types";

const dataDir = path.join(process.cwd(), "data");
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
