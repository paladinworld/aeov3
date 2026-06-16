import { NextResponse } from "next/server";
import { summarizeReport } from "@/lib/scoring";
import { readReportById } from "@/lib/store";
import { accessEnabled, currentGrant, grantsReport, verifyGrant } from "@/lib/access";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // Gate: a shared report is only readable with a grant for this report (or "*" admin).
  // The grant comes from the access cookie OR a `?t=<signed token>` in the URL — the
  // latter lets a no-login share URL (`/?report=<id>&t=…`) work without a redirect/cookie.
  const grant = (await currentGrant()) ?? verifyGrant(new URL(request.url).searchParams.get("t"));
  if (accessEnabled() && !grantsReport(grant, id)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

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
