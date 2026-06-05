import { NextResponse } from "next/server";
import { z } from "zod";
import { generateHvacQueries } from "@/lib/query-generator";
import { id, readDb, readReportById, readReportsLight, writeDb } from "@/lib/store";
import { Report } from "@/lib/types";
import { accessEnabled, currentGrant, isAdmin } from "@/lib/access";

const createReportSchema = z.object({
  companyId: z.string(),
  locationIds: z.array(z.string()).min(1),
  repeatRuns: z.number().int().min(1).max(10).default(3),
  queryLimit: z.number().int().min(1).max(50).optional()
});

export async function GET() {
  // Scope: admin (or gate off) sees the full report list; a client cookie sees ONLY
  // the single report it was granted, so the picker can't enumerate other clients.
  if (accessEnabled()) {
    const grant = await currentGrant();
    if (!grant) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    if (!isAdmin(grant)) {
      const found = await readReportById(grant.report);
      return NextResponse.json(
        found ? [{ id: found.report.id, companyId: found.report.companyId, status: found.report.status, createdAt: found.report.createdAt }] : []
      );
    }
  }
  // Lightweight list (id/company/status/createdAt only) extracted server-side — the
  // dashboard uses it just to pick/group reports, and loading every full payload here
  // hits Postgres's statement timeout. The full report is fetched per-id via [id].
  return NextResponse.json(await readReportsLight());
}

export async function POST(request: Request) {
  if (accessEnabled() && !isAdmin(await currentGrant())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = createReportSchema.parse(body);
  const db = await readDb();
  const company = db.companies.find((item) => item.id === parsed.companyId);

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const report: Report = {
    id: id("report"),
    companyId: company.id,
    locationIds: parsed.locationIds,
    repeatRuns: parsed.repeatRuns,
    queries: generateHvacQueries(company).slice(0, parsed.queryLimit ?? 40),
    runs: [],
    status: "draft",
    createdAt: new Date().toISOString()
  };

  db.reports.unshift(report);
  await writeDb(db);

  return NextResponse.json(report);
}
