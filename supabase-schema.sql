-- AI Visibility Tracker — Supabase schema
-- Paste into Supabase SQL Editor and Run.

-- Companies (one row per business; full company object stored as JSON)
create table if not exists companies (
  id          text primary key,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Reports (one row per audit run; full report object stored as JSON)
create table if not exists reports (
  id          text primary key,
  company_id  text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists reports_company_id_idx on reports (company_id);

-- Pilot signups (captured from the landing page)
create table if not exists signups (
  id            uuid primary key default gen_random_uuid(),
  business_name text,
  contact_name  text,
  email         text not null,
  phone         text,
  website       text,
  city          text,
  notes         text,
  status        text not null default 'new',   -- new | running | delivered
  created_at    timestamptz not null default now()
);

-- Lock the tables down. The app talks to Supabase only with the service-role
-- key (server-side), which bypasses RLS. With RLS enabled and no policies,
-- the public anon key can read/write nothing.
alter table companies enable row level security;
alter table reports   enable row level security;
alter table signups   enable row level security;
