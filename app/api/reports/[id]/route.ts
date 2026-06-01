import { NextResponse } from "next/server";
import { summarizeReport } from "@/lib/scoring";
import { readDb } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await readDb();
  const report = db.reports.find((item) => item.id === id);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const company = db.companies.find((item) => item.id === report.companyId);

  return NextResponse.json({
    report,
    company,
    summary: summarizeReport(report)
  });
}
