import { NextResponse } from "next/server";
import { z } from "zod";
import { enqueueAuditRun } from "@/lib/audit-jobs";
import { readDb, writeDb } from "@/lib/store";

const enqueueSchema = z.object({
  repeatRuns: z.number().int().min(1).max(10).optional(),
  concurrency: z.number().int().min(1).max(10).default(3)
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = enqueueSchema.parse(body);
  const db = await readDb();
  const report = db.reports.find((item) => item.id === id);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const company = db.companies.find((item) => item.id === report.companyId);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  report.status = "running";
  report.repeatRuns = parsed.repeatRuns ?? report.repeatRuns;
  report.runs = [];
  report.targetedSentiment = [];
  await writeDb(db);

  const auditRun = await enqueueAuditRun({
    company,
    report,
    repeatRuns: report.repeatRuns,
    concurrency: parsed.concurrency
  });

  return NextResponse.json({ auditRun, report });
}
