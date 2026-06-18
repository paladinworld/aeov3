import { NextResponse } from "next/server";
import { z } from "zod";
import { generateHvacQueries } from "@/lib/query-generator";
import { id, readDb, readReportsLight, writeDb } from "@/lib/store";
import { Report } from "@/lib/types";
import { accessEnabled, brandScopeForReport, currentGrant, grantedReportIds, isAdmin, verifyGrant } from "@/lib/access";

const createReportSchema = z.object({
  companyId: z.string(),
  locationIds: z.array(z.string()).min(1),
  vertical: z.string().optional(),
  repeatRuns: z.number().int().min(1).max(10).default(3),
  queryLimit: z.number().int().min(1).max(50).optional()
});

export async function GET(request: Request) {
  // Scope: admin (or gate off) sees the full report list; a client grant sees ONLY
  // the reports it was granted, so the picker can't enumerate other clients. An
  // account may span several markets, so return all of them (one per service area).
  // Grant = access cookie OR `?t=<token>` (so no-login share URLs build the dropdowns).
  if (accessEnabled()) {
    const sp = new URL(request.url).searchParams;
    const grant = (await currentGrant()) ?? verifyGrant(sp.get("t"));
    const reportParam = sp.get("report");
    // Authorized by EITHER a grant (cookie/token) OR a self-authorizing `?report=<id>` link.
    if (!grant && !reportParam) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    if (!isAdmin(grant)) {
      // Visible reports = explicitly granted + the BRAND of any directly-linked report
      // (so an unlisted link resolves that account's other markets, nothing else).
      const allowed = new Set(grant ? grantedReportIds(grant) : []);
      if (reportParam) {
        allowed.add(reportParam);
        const { reportIds } = await brandScopeForReport(reportParam);
        for (const rid of reportIds) allowed.add(rid);
      }
      const light = await readReportsLight();
      return NextResponse.json(light.filter((r) => allowed.has(r.id)));
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
    vertical: parsed.vertical ?? "HVAC",
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
