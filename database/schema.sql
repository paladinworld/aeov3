-- HVAC AI Visibility MVP schema
-- Run this in Supabase SQL Editor before enabling Supabase storage in the app.

create table if not exists public.companies (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id text primary key,
  company_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_runs (
  id text primary key,
  report_id text not null,
  company_id text not null,
  status text not null default 'queued',
  repeat_runs integer not null default 1,
  concurrency integer not null default 1,
  total_jobs integer not null default 0,
  completed_jobs integer not null default 0,
  failed_jobs integer not null default 0,
  options jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint audit_runs_status_check check (status in ('queued', 'running', 'complete', 'failed', 'canceled'))
);

create table if not exists public.audit_check_jobs (
  id text primary key,
  audit_run_id text not null references public.audit_runs(id) on delete cascade,
  report_id text not null,
  company_id text not null,
  location_id text not null,
  query_id text not null,
  query_text text not null,
  surface text not null,
  run_number integer not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 2,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint audit_check_jobs_status_check check (status in ('queued', 'running', 'complete', 'failed', 'canceled'))
);

create index if not exists reports_company_id_idx on public.reports(company_id);
create index if not exists companies_created_at_idx on public.companies(created_at desc);
create index if not exists reports_created_at_idx on public.reports(created_at desc);
create index if not exists audit_runs_report_id_idx on public.audit_runs(report_id);
create index if not exists audit_runs_status_idx on public.audit_runs(status, created_at);
create index if not exists audit_check_jobs_audit_run_id_idx on public.audit_check_jobs(audit_run_id);
create index if not exists audit_check_jobs_status_idx on public.audit_check_jobs(status, created_at);
create unique index if not exists audit_check_jobs_unique_check_idx
  on public.audit_check_jobs(audit_run_id, location_id, query_id, surface, run_number);

alter table public.companies enable row level security;
alter table public.reports enable row level security;
alter table public.audit_runs enable row level security;
alter table public.audit_check_jobs enable row level security;

-- No anon/user policies yet. The MVP server uses the service role key only from
-- trusted server routes. Supabase Auth + workspace-scoped RLS comes next.
