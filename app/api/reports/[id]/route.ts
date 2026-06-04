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

  return NextResponse.json(
    {
      report,
      company,
      summary: summarizeReport(report)
    },
    {
      // Report payloads are large (multi-MB) and effectively immutable once complete.
      // Cache at the browser + Vercel edge so switching service areas / re-opening a
      // report is near-instant instead of re-fetching from Supabase every time.
      // stale-while-revalidate keeps it snappy even after a re-run updates the data.
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400"
      }
    }
  );
}
