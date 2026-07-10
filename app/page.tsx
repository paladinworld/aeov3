import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { accessEnabled, currentGrant, isAdmin, verifyGrant } from "@/lib/access";
import { readReportMeta } from "@/lib/store";
import Home from "./DashboardClient";
import MarketReport from "./MarketReport";

const META_DESCRIPTION =
  "Find out your visibility in Google Gemini, ChatGPT, Google AI Chat against local competitors. The first AI visibility tool built for home service companies.";

// Per-report meta: a shared report link (`/?report=<id>`) gets the title
// "AI Search Report | <Company Name>" so link previews / browser tabs name the company.
// Bare root falls back to a generic title; a db read failure degrades to the fallback too.
export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ report?: string; t?: string }>;
}): Promise<Metadata> {
  const { report } = await searchParams;
  let title = "AI Search Report";
  if (report) {
    try {
      const found = await readReportMeta(report);
      if (found?.companyName) title = `AI Search Report | ${found.companyName}`;
    } catch {
      /* fall back to the generic title */
    }
  }
  return {
    title,
    description: META_DESCRIPTION,
    openGraph: { title, description: META_DESCRIPTION },
    twitter: { card: "summary", title, description: META_DESCRIPTION }
  };
}

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

  // Market-level reports (no target company) get a dedicated view — leaderboard + SEO columns
  // — instead of the target-company dashboard.
  if (report) {
    try {
      const found = await readReportMeta(report);
      if (found?.market) return <MarketReport reportId={report} token={t ?? null} />;
    } catch {
      /* fall through to the standard dashboard */
    }
  }

  return <Home />;
}
