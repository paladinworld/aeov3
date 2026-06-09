import { redirect } from "next/navigation";
import { accessEnabled, currentGrant, grantsReport, isAdmin } from "@/lib/access";
import Home from "./DashboardClient";

// Server-side gate: when the access gate is on, an unauthenticated visitor is
// redirected to /access BEFORE any dashboard HTML is sent — so the dashboard never
// flashes. A report link requires a grant for that report; the bare admin root (no
// ?report=) requires the master code. The client dashboard keeps its own 401->/access
// fallback for cookies that expire mid-session.
export default async function Page({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  const { report } = await searchParams;

  if (accessEnabled()) {
    const grant = await currentGrant();
    const ok = report ? grantsReport(grant, report) : isAdmin(grant);
    if (!ok) {
      redirect("/access" + (report ? `?report=${encodeURIComponent(report)}` : ""));
    }
  }

  return <Home />;
}
