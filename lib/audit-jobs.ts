import { AuditCheckJob, AuditRun, Company, Report } from "./types";
import { getSupabaseAdmin, id } from "./store";

type AuditRunRow = {
  id: string;
  report_id: string;
  company_id: string;
  status: AuditRun["status"];
  repeat_runs: number;
  concurrency: number;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  options: Record<string, unknown>;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
};

type AuditCheckJobInsert = {
  id: string;
  audit_run_id: string;
  report_id: string;
  company_id: string;
  location_id: string;
  query_id: string;
  query_text: string;
  surface: string;
  run_number: number;
  status: AuditCheckJob["status"];
  attempts: number;
  max_attempts: number;
  created_at: string;
};

type EnqueueAuditParams = {
  company: Company;
  report: Report;
  repeatRuns?: number;
  concurrency?: number;
};

export async function enqueueAuditRun(params: EnqueueAuditParams): Promise<AuditRun> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error("Supabase is required for queued audit runs.");
  }

  const now = new Date().toISOString();
  const repeatRuns = params.repeatRuns ?? params.report.repeatRuns;
  const concurrency = params.concurrency ?? 3;
  const auditRunId = id("audit_run");
  const jobs = buildAuditCheckJobs({
    auditRunId,
    company: params.company,
    report: params.report,
    repeatRuns,
    now
  });

  const auditRunInsert = {
    id: auditRunId,
    report_id: params.report.id,
    company_id: params.company.id,
    status: "queued",
    repeat_runs: repeatRuns,
    concurrency,
    total_jobs: jobs.length,
    completed_jobs: 0,
    failed_jobs: 0,
    options: {
      version: 1,
      surfaces: Array.from(new Set(jobs.map((job) => job.surface)))
    },
    created_at: now,
    updated_at: now
  };

  const { data: auditRun, error: auditRunError } = await supabase
    .from("audit_runs")
    .insert(auditRunInsert)
    .select("id,report_id,company_id,status,repeat_runs,concurrency,total_jobs,completed_jobs,failed_jobs,options,error,created_at,started_at,completed_at")
    .single();

  if (auditRunError) {
    throw new Error(`Supabase audit run create failed: ${auditRunError.message}`);
  }

  if (jobs.length) {
    const { error: jobsError } = await supabase.from("audit_check_jobs").insert(jobs);
    if (jobsError) {
      throw new Error(`Supabase audit jobs create failed: ${jobsError.message}`);
    }
  }

  return mapAuditRun(auditRun as AuditRunRow);
}

export function buildAuditCheckJobs(params: {
  auditRunId: string;
  company: Company;
  report: Report;
  repeatRuns: number;
  now?: string;
}): AuditCheckJobInsert[] {
  const now = params.now ?? new Date().toISOString();
  const locationIds = new Set(params.report.locationIds);
  const locations = params.company.locations.filter((location) => locationIds.has(location.id));
  const jobs: AuditCheckJobInsert[] = [];

  for (const location of locations) {
    for (const query of params.report.queries) {
      for (const surface of query.surfaces) {
        for (let runNumber = 1; runNumber <= params.repeatRuns; runNumber += 1) {
          jobs.push({
            id: id("audit_job"),
            audit_run_id: params.auditRunId,
            report_id: params.report.id,
            company_id: params.company.id,
            location_id: location.id,
            query_id: query.id,
            query_text: query.text,
            surface,
            run_number: runNumber,
            status: "queued",
            attempts: 0,
            max_attempts: 2,
            created_at: now
          });
        }
      }
    }
  }

  return jobs;
}

function mapAuditRun(row: AuditRunRow): AuditRun {
  return {
    id: row.id,
    reportId: row.report_id,
    companyId: row.company_id,
    status: row.status,
    repeatRuns: row.repeat_runs,
    concurrency: row.concurrency,
    totalJobs: row.total_jobs,
    completedJobs: row.completed_jobs,
    failedJobs: row.failed_jobs,
    options: row.options ?? {},
    error: row.error ?? undefined,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined
  };
}
