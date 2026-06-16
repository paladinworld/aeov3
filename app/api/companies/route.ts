import { NextResponse } from "next/server";
import { z } from "zod";
import { HVAC_SERVICES } from "@/lib/constants";
import { id, readCompanies, readDb, readReportById, writeDb } from "@/lib/store";
import { Company, Service } from "@/lib/types";
import { accessEnabled, currentGrant, grantedReportIds, isAdmin, verifyGrant } from "@/lib/access";

const locationSchema = z.object({
  label: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isPrimary: z.boolean()
});

const companySchema = z.object({
  name: z.string().min(1),
  website: z.string().min(1),
  googleBusinessProfileUrl: z.string().optional(),
  services: z.array(z.enum(HVAC_SERVICES as [Service, ...Service[]])).min(1),
  competitors: z.array(z.string()).default([]),
  locations: z.array(locationSchema).min(1)
});

export async function GET(request: Request) {
  // Scope: admin (or gate off) sees all companies; a client grant sees ONLY the
  // companies behind the reports it was granted — never the rest of the roster.
  // A client account can span several markets (e.g. 6 service areas), so return
  // all of them — that's what powers the service-area dropdown.
  // Grant = access cookie OR `?t=<token>` (so no-login share URLs resolve the account).
  if (accessEnabled()) {
    const grant = (await currentGrant()) ?? verifyGrant(new URL(request.url).searchParams.get("t"));
    if (!grant) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    if (!isAdmin(grant)) {
      const found = await Promise.all(grantedReportIds(grant).map((rid) => readReportById(rid)));
      const seen = new Set<string>();
      const companies = found
        .filter((f): f is { report: import("@/lib/types").Report; company: Company } => Boolean(f))
        .map((f) => f.company)
        .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
      return NextResponse.json(companies);
    }
  }
  // Only the companies table — not every report's full payload (which would time out).
  return NextResponse.json(await readCompanies());
}

export async function POST(request: Request) {
  if (accessEnabled() && !isAdmin(await currentGrant())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = companySchema.parse(body);
  const db = await readDb();
  const company: Company = {
    id: id("company"),
    ...parsed,
    locations: parsed.locations.map((location, index) => ({
      id: id("loc"),
      ...location,
      isPrimary: index === 0 ? true : location.isPrimary
    })),
    createdAt: new Date().toISOString()
  };

  db.companies.unshift(company);
  await writeDb(db);

  return NextResponse.json(company);
}
