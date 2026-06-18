import { NextResponse } from "next/server";
import { summarizeReport } from "@/lib/scoring";
import { readReportById } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // Public by id: a report is readable by its own (unguessable) id, so the bare
  // /?report=<id> share link works with NO login. There is intentionally no auth gate here —
  // a cookie/token scoped to OTHER reports must never block a valid id (that was the bug that
  // redirected previously-"logged-in" browsers to /access). Missing reports 404 below.

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
      // Gated data must NOT be shared-cached (a public edge cache would serve one
      // client's report to anyone). Keep it private to the authenticated browser only.
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
}
