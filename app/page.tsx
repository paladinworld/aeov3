import { redirect } from "next/navigation";
import { accessEnabled, currentGrant, grantFromReport, grantsReport, isAdmin, verifyGrant } from "@/lib/access";
import Home from "./DashboardClient";

// Server-side gate: when the access gate is on, an unauthenticated visitor is
// redirected to /access BEFORE any dashboard HTML is sent — so the dashboard never
// flashes. The grant comes from the access cookie OR a `?t=<signed token>` in the URL,
// so a no-login share link (`/?report=<id>&t=…`) passes the gate without a redirect.
// A report link requires a grant for that report; the bare admin root requires "*".
// The client dashboard keeps its own 401->/access fallback for cookies that expire.
export default async function Page({ searchParams }: { searchParams: Promise<{ report?: string; t?: string }> }) {
  const { report, t } = await searchParams;

  if (accessEnabled()) {
    // A `?report=<id>` link is self-authorizing (no login): the report id itself grants
    // that report. The bare admin root (no ?report=) still requires the "*" admin grant.
    const grant = (await currentGrant()) ?? verifyGrant(t) ?? grantFromReport(report);
    const ok = report ? grantsReport(grant, report) : isAdmin(grant);
    if (!ok) {
      redirect("/access" + (report ? `?report=${encodeURIComponent(report)}` : ""));
    }
  }

  return <Home />;
}
