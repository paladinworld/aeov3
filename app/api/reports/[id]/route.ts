import { NextResponse } from "next/server";
import { summarizeReport } from "@/lib/scoring";
import { readReportById } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  // Fetch only this report (+ its company), not every report's full payload.
  const found = await readReportById(id);

  if (!found) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const { report, company } = found;

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
