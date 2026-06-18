import { NextResponse } from "next/server";
import { z } from "zod";
import { id, readCompanies, readDb, readReportById, writeDb } from "@/lib/store";
import { Company } from "@/lib/types";
import { accessEnabled, brandScopeForReport, currentGrant, grantedReportIds, isAdmin, verifyGrant } from "@/lib/access";

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
  // Any non-empty service label — a vertical (Tree Care, Pest Control…) brings its own list.
  services: z.array(z.string().min(1)).min(1),
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
    const sp = new URL(request.url).searchParams;
    const grant = (await currentGrant()) ?? verifyGrant(sp.get("t"));
    const reportParam = sp.get("report");
    if (!grant && !reportParam) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    if (!isAdmin(grant)) {
      const companyIds = new Set<string>();
      if (grant) {
        const found = await Promise.all(grantedReportIds(grant).map((rid) => readReportById(rid)));
        for (const f of found) if (f) companyIds.add(f.company.id);
      }
      // + the brand of a directly-linked report (unlisted-link → that account's markets only)
      if (reportParam) {
        const { companyIds: brandCos } = await brandScopeForReport(reportParam);
        for (const cid of brandCos) companyIds.add(cid);
      }
      const all = await readCompanies();
      return NextResponse.json(all.filter((c) => companyIds.has(c.id)));
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
