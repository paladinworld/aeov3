import { redirect } from "next/navigation";
import { accessEnabled, currentGrant, isAdmin, verifyGrant } from "@/lib/access";
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
    // A `?report=<id>` link is PUBLIC (self-authorizing by id) — render it regardless of any
    // cookie. Critically, an existing cookie scoped to OTHER reports must NOT shadow the link
    // (that bug redirected previously-"logged-in" browsers to /access). Only the bare admin
    // root (no ?report=) still requires the "*" grant.
    if (!report) {
      const grant = (await currentGrant()) ?? verifyGrant(t);
      if (!isAdmin(grant)) redirect("/access");
    }
  }

  return <Home />;
}
