import { NextResponse } from "next/server";
import { z } from "zod";
import { generateHvacQueries } from "@/lib/query-generator";
import { id, readDb, writeDb } from "@/lib/store";
import { Report } from "@/lib/types";

const createReportSchema = z.object({
  companyId: z.string(),
  locationIds: z.array(z.string()).min(1),
  repeatRuns: z.number().int().min(1).max(10).default(3),
  queryLimit: z.number().int().min(1).max(50).optional()
});

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.reports);
}

export async function POST(request: Request) {
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
    queries: generateHvacQueries(company).slice(0, parsed.queryLimit ?? 36),
    runs: [],
    status: "draft",
    createdAt: new Date().toISOString()
  };

  db.reports.unshift(report);
  await writeDb(db);

  return NextResponse.json(report);
}
