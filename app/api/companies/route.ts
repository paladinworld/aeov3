import { NextResponse } from "next/server";
import { z } from "zod";
import { HVAC_SERVICES } from "@/lib/constants";
import { id, readCompanies, readDb, readReportById, writeDb } from "@/lib/store";
import { Company, Service } from "@/lib/types";
import { accessEnabled, currentGrant, isAdmin } from "@/lib/access";

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

export async function GET() {
  // Scope: admin (or gate off) sees all companies; a client cookie sees ONLY the
  // company behind the one report it was granted — never the rest of the roster.
  if (accessEnabled()) {
    const grant = await currentGrant();
    if (!grant) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    if (!isAdmin(grant)) {
      const found = await readReportById(grant.report);
      return NextResponse.json(found ? [found.company] : []);
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
