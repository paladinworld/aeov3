"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { HVAC_SERVICES } from "@/lib/constants";
import {
  Citation,
  Company,
  CompanyMention,
  Location,
  Query,
  Report,
  Service,
  SurfaceRun,
  VisibilitySummary
} from "@/lib/types";
import { dashboardStyles } from "./styles-v3";

/* ──────────────────────────────────────────────────────────────
   Netic AI Visibility (AEO V3)
   Claude design, wired to the live aeolist backend.
   ──────────────────────────────────────────────────────────── */

type ReportPayload = {
  report: Report;
  company: Company;
  summary: VisibilitySummary;
};

type View = "home" | "prompts" | "citations" | "competitors" | "sentiment" | "setup";
type PromptFilter = "all" | "ranked" | "missing";
type SurfaceFilter = "all" | "gemini" | "chatgpt";
type PromptTypeFilter = "all" | "intention" | "informational";

const NAV: Record<View, string> = {
  home: "Overview",
  prompts: "Prompts",
  citations: "Citations",
  competitors: "Competitors",
  sentiment: "Sentiment",
  setup: "Setup"
};

const defaultServices: Service[] = ["AC repair", "Furnace repair", "Emergency HVAC", "Heat pump repair", "Maintenance/tune-up"];
const customerSurfaces = ["gemini_maps", "gemini_search", "chatgpt_search"] as const;
// Two customer-facing engines. "Google" pools the local pack (Maps) and AI Overview
// (Search) into a single score; ChatGPT is its own engine. Everything the customer
// sees (gauge, by-platform bars, leaderboard) is grouped by these two engines.
const ENGINE_SURFACES = {
  gemini: ["gemini_maps", "gemini_search"],
  chatgpt: ["chatgpt_search"]
} as const;
// Overall AI Visibility Score weighting. We blend the two engines by importance,
// NOT by raw run count, so a company that wins only one engine can't top the
// overall rank. Google (Maps local pack + AI Overviews) drives the majority of
// local home-service discovery today, so it carries more weight than ChatGPT.
const GEMINI_WEIGHT = 0.7;
const CHATGPT_WEIGHT = 0.3;
const INTENT_LABELS: Record<string, string> = {
  best: "Best of",
  near_me: "Near me",
  emergency: "Emergency",
  problem: "Problem",
  review: "Reviews",
  price: "Pricing",
  comparison: "Comparison"
};

/* ── Lucide icons ── */
const ICONS: Record<string, string> = {
  home: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  prompts: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  citations: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  sentiment: "M3 3v18h18M19 9l-5 5-4-4-3 3",
  competitors: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  setup: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
  copy: "M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 5L2 7",
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
  arrow: "M5 12h14M12 5l7 7-7 7",
  chevron: "M9 18l6-6-6-6",
  chevdown: "M6 9l6 6 6-6",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  menu: "M3 6h18M3 12h18M3 18h18",
  spark: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z",
  close: "M18 6L6 18M6 6l12 12",
  desktop: "M3 4h18v12H3zM8 20h8M12 16v4",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
};

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const path = ICONS[name] ?? "";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path.split("M").filter(Boolean).map((d, i) => (
        <path key={i} d={"M" + d} />
      ))}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   Root app
   ──────────────────────────────────────────────────────────── */
export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [repeatRuns, setRepeatRuns] = useState(1);
  const [activeReport, setActiveReport] = useState<ReportPayload | null>(null);
  const [view, setView] = useState<View>("home");
  const [shareCopied, setShareCopied] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  // Navigate + close the mobile drawer in one go.
  const goView = (next: View) => {
    setView(next);
    setNavOpen(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId),
    [companies, selectedCompanyId]
  );

  // Single fixed company (the default account); the sidebar dropdown switches SERVICE AREA.
  const [selectedLocationId, setSelectedLocationId] = useState("");

  // Service areas for the active brand. Each area is its own report (per company×area),
  // so switching the dropdown loads a different report rather than filtering in place.
  const serviceAreaOptions = useMemo(() => {
    const active = activeReport?.company;
    if (!active) return [] as Array<{ reportId: string; area: string }>;
    const brand = canonicalCompanyName(active.name);
    const byId = new Map(companies.map((item) => [item.id, item]));
    const byArea = new Map<string, { reportId: string; area: string; status: Report["status"]; runs: number; createdAt: string }>();
    const activeId = activeReport?.report.id;
    for (const report of reports) {
      const owner = byId.get(report.companyId);
      if (!owner || canonicalCompanyName(owner.name) !== brand) continue;
      const area = primaryLocation(owner) ?? "—";
      const prev = byArea.get(area);
      if (prev && prev.reportId === activeId) continue; // active report already owns this area
      const runs = (report as Report & { runCount?: number }).runCount ?? report.runs?.length ?? 0;
      const isActive = report.id === activeId;
      const better =
        isActive ||
        !prev ||
        (report.status === "complete" && prev.status !== "complete") ||
        (report.status === prev.status && (runs > prev.runs || (runs === prev.runs && report.createdAt > prev.createdAt)));
      if (better) byArea.set(area, { reportId: report.id, area, status: report.status, runs, createdAt: report.createdAt });
    }
    return Array.from(byArea.values())
      .sort((a, b) => a.area.localeCompare(b.area))
      .map(({ reportId, area }) => ({ reportId, area }));
  }, [activeReport?.company, activeReport?.report.id, companies, reports]);

  async function switchServiceArea(reportId: string) {
    if (reportId === activeReport?.report.id) return;
    await loadReport(reportId);
    if (typeof window !== "undefined") {
      const next = new URL(window.location.href);
      next.searchParams.set("report", reportId);
      window.history.replaceState({}, "", next.toString());
    }
  }

  useEffect(() => {
    if (!activeReport) return;
    const locs = activeReport.company.locations;
    const primary = locs.find((location) => location.isPrimary) ?? locs[0];
    setSelectedLocationId(primary?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport?.report.id]);

  const viewPayload = useMemo(() => {
    if (!activeReport) return null;
    const locs = activeReport.company.locations;
    const filterLoc = locs.length > 1 && Boolean(selectedLocationId);
    // Drop provider-error runs (failed checks) so they aren't counted as "not recommended",
    // and narrow to the selected location when the company has more than one.
    const runs = activeReport.report.runs.filter(
      (run) => !run.rawAnswer.startsWith("Provider error:") && (!filterLoc || run.locationId === selectedLocationId)
    );
    if (runs.length === activeReport.report.runs.length) return activeReport;
    return {
      company: activeReport.company,
      report: { ...activeReport.report, runs, locationIds: filterLoc ? [selectedLocationId] : activeReport.report.locationIds },
      summary: recomputeSummaryForLocation(runs, activeReport.summary)
    };
  }, [activeReport, selectedLocationId]);

  const reportStats = useMemo(() => (viewPayload ? buildReportStats(viewPayload) : null), [viewPayload]);

  async function refresh() {
    const [companyResponse, reportResponse] = await Promise.all([fetch("/api/companies"), fetch("/api/reports")]);
    const nextCompanies = (await companyResponse.json()) as Company[];
    const nextReports = (await reportResponse.json()) as Report[];
    setCompanies(nextCompanies);
    setReports(nextReports);
    // A report loads ONLY when explicitly requested via ?report=<id> (per-client links).
    // With no report param we intentionally show a blank state — no demo default.
    const requestedId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("report") : null;
    const requested = requestedId ? nextReports.find((report) => report.id === requestedId) : null;
    setSelectedCompanyId((current) => current || requested?.companyId || nextCompanies[0]?.id || "");
    if (!activeReport && requested) {
      await loadReport(requested.id);
    }
  }

  async function loadReport(reportId: string) {
    setLoadingReport(true);
    try {
      const response = await fetch(`/api/reports/${reportId}`);
      const payload = (await response.json()) as ReportPayload;
      if (!response.ok || !payload.report?.queries || !payload.company) {
        console.error("Invalid report payload", payload);
        return;
      }
      setActiveReport(payload);
      setSelectedCompanyId(payload.company.id);
    } finally {
      setLoadingReport(false);
    }
  }

  async function createReport() {
    if (!selectedCompany) return;
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: selectedCompany.id,
        locationIds: selectedCompany.locations.map((location) => location.id),
        repeatRuns
      })
    });
    const report = (await response.json()) as Report;
    await refresh();
    await loadReport(report.id);
    setView("prompts");
  }

  function copyShareLink() {
    if (!activeReport) return;
    const url = `${window.location.origin}/share/${activeReport.report.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1500);
  }

  function downloadPdf() {
    setShareMenuOpen(false);
    setView("home"); // PDF captures the Overview metrics
    window.setTimeout(() => window.print(), 350);
  }

  function openEmailDraft() {
    if (!activeReport) return;
    const url = `${window.location.origin}/share/${activeReport.report.id}`;
    const subject = `AI visibility audit for ${activeReport.company.name}`;
    const body = `Here is the AI visibility audit for ${activeReport.company.name}:\n\n${url}`;
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
  }

  const total = reportStats?.totalQueries;
  const company = activeReport?.company;
  const lastRun = activeReport?.report.completedAt ? `Last run ${formatRunDate(activeReport.report.completedAt)}` : "No completed run";
  const accessLeft = activeReport?.report.completedAt ? accessDaysLeft(activeReport.report.completedAt) : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: dashboardStyles }} />
      <div className="aeo3">
        <div className="app">
          <div className={"nav-overlay" + (navOpen ? " show" : "")} onClick={() => setNavOpen(false)} />
          <aside className={"side" + (navOpen ? " open" : "")}>
            <div className="brand">
              <img src="/netic/netic-wordmark-green.svg" alt="Netic" />
            </div>
            <div className="brand-sub">
              AI Visibility Tracker <span className="beta-pill">Beta</span>
            </div>

            <div className="acct">
              <div className="acct-company">{company?.name ?? "—"}</div>
              <label htmlFor="loc">Service area</label>
              <div className="sel">
                <select
                  id="loc"
                  value={activeReport?.report.id ?? ""}
                  onChange={(event) => switchServiceArea(event.target.value)}
                  disabled={serviceAreaOptions.length <= 1}
                >
                  {serviceAreaOptions.map((option) => (
                    <option key={option.reportId} value={option.reportId}>
                      {option.area}
                    </option>
                  ))}
                </select>
                <Icon name="chevdown" size={14} />
              </div>
              {company?.headquarters?.label ? <div className="acct-hq">HQ · {company.headquarters.label}</div> : null}
            </div>

            <NavGroup label="Overview">
              <Navi icon="home" active={view === "home"} count={total} onClick={() => goView("home")}>
                Home
              </Navi>
            </NavGroup>
            <NavGroup label="Visibility">
              <Navi icon="prompts" active={view === "prompts"} count={total} onClick={() => goView("prompts")}>
                Prompts
              </Navi>
              <Navi icon="citations" active={view === "citations"} onClick={() => goView("citations")}>
                Citations
              </Navi>
              <Navi icon="competitors" active={view === "competitors"} onClick={() => goView("competitors")}>
                Competitors
              </Navi>
            </NavGroup>
          </aside>

          <section className="workspace">
            <header className="topbar">
              <div className="topbar-inner">
                <button className="nav-toggle" aria-label="Open menu" onClick={() => setNavOpen(true)}>
                  <Icon name="menu" size={18} />
                </button>
                <div className="top-actions">
                  <span className="last-run">
                    {lastRun}
                    {accessLeft !== null ? (
                      <span className={"access-left" + (accessLeft <= 0 ? " expired" : accessLeft <= 7 ? " soon" : "")}>
                        <Icon name="clock" size={11} />
                        {accessLeft > 0 ? `${accessLeft} ${accessLeft === 1 ? "day" : "days"} left for access` : "Access expired"}
                      </span>
                    ) : null}
                  </span>
                  {activeReport ? (
                    <div className="share-tools">
                      <div className="share-wrap">
                        <button className="btn" onClick={() => setShareMenuOpen((open) => !open)}>
                          <Icon name={shareCopied ? "copy" : "share"} size={13} />
                          {shareCopied ? "Copied" : "Share report"}
                          <Icon name="chevdown" size={12} />
                        </button>
                        {shareMenuOpen ? (
                          <div className="share-menu">
                            <button onClick={() => { copyShareLink(); setShareMenuOpen(false); }}>
                              <Icon name="copy" size={14} /> Copy link
                            </button>
                            <button onClick={downloadPdf}>
                              <Icon name="download" size={14} /> Download PDF
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <button className="btn" onClick={openEmailDraft}>
                        <Icon name="mail" size={13} />
                        Gmail
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            <div className="main">
              <div className="print-header">
                <img src="/netic/netic-wordmark-green.svg" alt="Netic" />
                <div className="ph-meta">
                  <strong>{company?.name ?? "Company"}</strong>
                  AI Visibility Report{activeReport?.report.completedAt ? ` · ${formatRunDate(activeReport.report.completedAt)}` : ""}
                </div>
              </div>
              {view === "setup" ? (
                <SetupView
                  companies={companies}
                  reports={reports}
                  selectedCompanyId={selectedCompanyId}
                  repeatRuns={repeatRuns}
                  selectedCompany={selectedCompany}
                  setSelectedCompanyId={setSelectedCompanyId}
                  setRepeatRuns={setRepeatRuns}
                  createReport={createReport}
                  loadReport={loadReport}
                  refresh={refresh}
                />
              ) : loadingReport ? (
                <LoadingState />
              ) : !viewPayload || !reportStats ? (
                <EmptyState />
              ) : view === "prompts" ? (
                <PromptsView payload={viewPayload} stats={reportStats} />
              ) : view === "citations" ? (
                <CitationsView payload={viewPayload} />
              ) : view === "competitors" ? (
                <CompetitorsView payload={viewPayload} stats={reportStats} />
              ) : (
                <OverviewView payload={viewPayload} stats={reportStats} onNav={setView} />
              )}
            </div>
          </section>
        </div>
      </div>
      {!bannerDismissed ? (
        <div className="mobile-banner" role="status">
          <Icon name="desktop" size={16} />
          <span>This dashboard is best viewed on a desktop. The mobile layout isn&rsquo;t fully optimized yet.</span>
          <button aria-label="Dismiss" onClick={() => setBannerDismissed(true)}>
            <Icon name="close" size={15} />
          </button>
        </div>
      ) : null}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   Overview
   ──────────────────────────────────────────────────────────── */
// Home advice: one Key Insights panel — Insights (the situation, always populated,
// left) and Improvements (each with a next-step action that deep-links to the
// relevant view, right). Defensive so thin data never breaks it.
type AdviceAction = { text: string; nav?: View };
type Advice = {
  insights: Array<{ lead: string; body: string; tone: "good" | "warn" | "neutral" }>;
  improvements: Array<{ lead: string; body: string; action: AdviceAction }>;
};

function buildHomeAdvice(input: {
  score100: number;
  gband: string;
  visRank: number;
  total: number;
  geminiRate: number;
  chatgptRate: number;
  sov: number;
  sovRank: number;
  sovCount: number;
  topRival?: string;
  topDirectories: string[];
  distinctOwned: number;
  weakestCategory?: { category: string; rate: number };
}): Advice {
  const { score100, gband, visRank, total, geminiRate, chatgptRate, sov, sovRank, sovCount, topRival, topDirectories, distinctOwned, weakestCategory } = input;
  const insights: Advice["insights"] = [];
  const improvements: Advice["improvements"] = [];
  const rankStr = visRank === 1 ? ` — #1 of ${total} in your market` : visRank > 0 && total > 0 ? ` (#${visRank} of ${total})` : "";
  const gi = Math.round(geminiRate * 100);
  const gp = Math.round(chatgptRate * 100);
  const imbalanced = Math.abs(gi - gp) >= 12;

  // ── Insights (left): the situation as we found it; always populated. ──
  insights.push({
    tone: gband === "High" ? "good" : gband === "Low" ? "warn" : "neutral",
    lead: `${gband === "High" ? "Strong" : gband === "Medium" ? "Moderate" : "Limited"} overall AI visibility (${score100}%)`,
    body: `AI recommends you ${gband === "High" ? "frequently" : gband === "Medium" ? "selectively" : "rarely"}${rankStr}.`
  });
  if (gi > 0 || gp > 0) {
    insights.push({
      tone: imbalanced ? "warn" : "good",
      lead: imbalanced ? "Coverage is uneven across engines" : "Consistent across engines",
      body: `${gi}% on Google and ${gp}% on ChatGPT.`
    });
  }
  if (sovCount > 0) {
    insights.push({
      tone: sov >= 0.15 ? "good" : "neutral",
      lead: `Share of voice ${pct(sov)}${sovRank > 0 ? ` (#${sovRank} of ${sovCount})` : ""}`,
      body: `Of every company mention AI makes in your market, this is the slice that names you.`
    });
  }

  // ── Improvements (right): the actions to take. ──
  if (imbalanced) {
    const weak = gp < gi ? "ChatGPT" : "Google";
    improvements.push({
      lead: `Close the ${weak} gap`,
      body: `${weak} pulls from a different source mix than the other engine.`,
      action: { text: "Compare citation sources for gaps vs competitors", nav: "citations" }
    });
  }

  // Who leads
  if (visRank > 1 && topRival) {
    improvements.push({
      lead: `${topRival} leads your market`,
      body: `The most-recommended company to displace.`,
      action: { text: "See the prompts and sources they win", nav: "competitors" }
    });
  }

  // Directories AI trusts most
  if (topDirectories.length) {
    improvements.push({
      lead: "Key directories AI trusts",
      body: `${topDirectories.join(", ")}.`,
      action: { text: "Make sure your profile is strong on each", nav: "citations" }
    });
  }

  // Thin owned content
  if (distinctOwned <= 1) {
    improvements.push({
      lead: "Only your homepage is cited",
      body: `AI has little of your own content to pull from.`,
      action: { text: "Add dedicated location and service pages" }
    });
  }

  // Weakest prompt category
  if (weakestCategory && weakestCategory.rate < 0.5) {
    improvements.push({
      lead: `Weakest for “${weakestCategory.category}” prompts`,
      body: `You appear in just ${pct(weakestCategory.rate)} of them.`,
      action: { text: "Create content targeting that stage", nav: "prompts" }
    });
  }

  // Fallback so the Improvements column is never empty.
  if (!improvements.length) {
    improvements.push({
      lead: gband === "High" ? "Defend your lead" : "Grow your visibility",
      body: gband === "High" ? "You're ahead — keep widening the gap on competitors." : `You're below the 30% High band.`,
      action: { text: "Find your weakest prompts and sources", nav: "prompts" }
    });
  }

  return { insights, improvements };
}

function OverviewView({ payload, stats, onNav }: { payload: ReportPayload; stats: ReportStats; onNav: (view: View) => void }) {
  const [visFilter, setVisFilter] = useState<SurfaceFilter>("all");
  const [sovFilter, setSovFilter] = useState<SurfaceFilter>("all");
  const [citFilter, setCitFilter] = useState<SurfaceFilter>("all");
  const [advExpanded, setAdvExpanded] = useState(false);

  const summary = payload.summary;
  const leaderboard = useMemo(() => buildLeaderboardData(payload), [payload]);
  const citationStats = useMemo(() => buildCitationStats(payload), [payload]);
  const citRank = useMemo(() => buildCitationStats(payload, citFilter), [payload, citFilter]);

  // Overall gauge = the 70/30 Gemini/ChatGPT blend (see blendedVisibilityForName),
  // so it matches this company's value in the Visibility score rank leaderboard.
  const score100 = Math.round(blendedVisibilityForName(payload, payload.company.name, true) * 100);
  // Official Visibility Score bands (backend): 30%+ High, 20–30% Medium, <20% Low.
  const gband = score100 >= 30 ? "High" : score100 >= 20 ? "Medium" : "Low";

  // By-platform uses the SAME composite Visibility Score as the leaderboard (one
  // definition everywhere), grouped into the two engines — Google (Maps + AI
  // Overview) and ChatGPT — so the bars match each engine's leaderboard tab.
  const surfaceShow = (["gemini", "chatgpt"] as const).map((engine) => ({
    surface: engine,
    label: engine === "gemini" ? "Google" : "ChatGPT",
    rate: visibilityMetricsForName(payload, mentionShareRuns(payload.report.runs, engine), payload.company.name, true).visibility
  }));

  // Share of voice
  const lb = leaderboard.all;
  const sovTotal = lb.reduce((sum, row) => sum + row.count, 0);
  const sovBrand = (lb.find((row) => row.isTarget) || { count: 0 }).count;
  const sov = sovTotal ? sovBrand / sovTotal : 0;
  const sovRank = lb.findIndex((row) => row.isTarget) + 1;
  const sovCount = lb.length;

  // Citation rate
  const allCited = new Set<string>();
  const brandCited = new Set<string>();
  citationStats.domainDetails.forEach((domain) =>
    (domain.urls || []).forEach((url) =>
      (url.prompts || []).forEach((prompt) => {
        allCited.add(prompt);
        if (domain.owned) brandCited.add(prompt);
      })
    )
  );
  const citRate = allCited.size ? brandCited.size / allCited.size : 0;

  const topOneRate = topOneRateOf(payload);
  const topDomains = citRank.domainRows.slice(0, 6);

  // Plain-language "what this means" summary (starting point — COO will expand the checklist).
  const geminiRate = surfaceShow.find((item) => item.surface === "gemini")?.rate ?? 0;
  const chatgptRate = surfaceShow.find((item) => item.surface === "chatgpt")?.rate ?? 0;
  const visRanked = [...lb].sort((a, b) => (b.visibilityScore ?? b.visibilityRate) - (a.visibilityScore ?? a.visibilityRate));
  const visRank = visRanked.findIndex((row) => row.isTarget) + 1;
  const topRival = visRanked.find((row) => !row.isTarget)?.name;
  const weakestCategory = [...stats.categoryCoverage].sort((a, b) => a.rate - b.rate)[0];
  const topDirectories = citationStats.domainRows.filter((row) => row.type === "Platform").slice(0, 3).map((row) => row.domain);
  const distinctOwned = new Set(
    citationStats.domainDetails.filter((domain) => domain.owned).flatMap((domain) => (domain.urls || []).map((url) => url.url))
  ).size;
  const advice = buildHomeAdvice({ score100, gband, visRank, total: lb.length, geminiRate, chatgptRate, sov, sovRank, sovCount, topRival, topDirectories, distinctOwned, weakestCategory });
  const VISIBLE_IMPROVEMENTS = 3;
  const canCollapse = advice.improvements.length > VISIBLE_IMPROVEMENTS;
  const shownImprovements = canCollapse && !advExpanded ? advice.improvements.slice(0, VISIBLE_IMPROVEMENTS) : advice.improvements;

  return (
    <div className="view-stack">
      <p className="page-note">
        {primaryLocation(payload.company)} visibility across {stats.totalQueries} HVAC prompts and {surfaceShow.length} AI engines (Google, ChatGPT).
      </p>
      <p className="bench-note">
        Directional reference only. AI results vary by each query, so this won&apos;t match exactly what every consumer sees.
      </p>

      {advice.insights.length || advice.improvements.length ? (
        <div className="panel key-insights">
          <div className="ki-head">
            <span className="ki-icon"><Icon name="spark" size={15} /></span>
            <h2>Key Insights &amp; Actions</h2>
          </div>
          <div className="insight-cols">
            <div className="ins-col">
              <span className="ins-sub">Insights</span>
              <ul className="ta-list">
                {advice.insights.map((item, index) => (
                  <li key={"i" + index} className={"ta-item " + item.tone}>
                    <span className="ta-dot" />
                    <span><strong>{item.lead}:</strong> {item.body}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="ins-col">
              <span className="ins-sub">Improvements</span>
              <ul className="ta-list">
                {shownImprovements.map((item, index) => (
                  <li key={"m" + index} className="ta-item warn">
                    <span className="ta-dot" />
                    <div className="ins-body">
                      <span><strong>{item.lead}:</strong> {item.body}</span>
                      {item.action.nav ? (
                        <button className="ins-action" onClick={() => onNav(item.action.nav!)}>
                          {item.action.text} <Icon name="arrow" size={12} />
                        </button>
                      ) : (
                        <span className="ins-action plain">{item.action.text}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {canCollapse ? (
                <button className="ins-more" onClick={() => setAdvExpanded((open) => !open)}>
                  {advExpanded ? "Show less" : `Show ${advice.improvements.length - VISIBLE_IMPROVEMENTS} more`}
                  <Icon name={advExpanded ? "chevron" : "chevdown"} size={13} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="panel score-panel">
        <PanelHead
          title="AI Visibility Score"
          subtitle="How often does AI recommend you overall?"
          tooltip="How visible your company is to AI — how often it recommends you, and how high up you appear, when people ask it for help choosing a provider. The overall score weights Gemini (Google) at 70% and ChatGPT at 30%, since Google drives most local home-service discovery today. Higher is better: 30%+ is High, 20–30% is Medium, under 20% is Low."
        />
        <div className="score-body">
          <div className="score-gauge">
            <div className="glegend">
              <span>
                <i className="lo" />
                Low
              </span>
              <span>
                <i className="md" />
                Medium
              </span>
              <span>
                <i className="hi" />
                High
              </span>
            </div>
            <div className="gauge-wrap">
              <Gauge value={score100} />
              <div className="gauge-center">
                <strong>{score100}%</strong>
                <span className={"gpill " + gband.toLowerCase()}>{gband}</span>
              </div>
            </div>
            <p className="gauge-cap">{payload.report.runs.length.toLocaleString()} queries run across {stats.totalQueries} tracked prompts</p>
          </div>
          <div className="score-platforms">
            <span className="sp-label">By platform</span>
            <div className="pf-list">
              {surfaceShow.map((surface) => (
                <div key={surface.surface} className="pf-row">
                  <div className="pf-name">{surface.label}</div>
                  <div className="pf-bar">
                    <div className={"platform-track " + band(surface.rate, 0.3, 0.2).toLowerCase()}>
                      <i style={{ width: pct(surface.rate) }} />
                    </div>
                    <b>{pct(surface.rate)}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="metric-grid four">
        <MetricCard
          label="Share of Voice"
          value={pct(sov)}
          helper={sovRank ? `${ordinal(sovRank)} of ${sovCount} in your market` : `of ${sovCount} in your market`}
          tooltip="When an AI answer names you or a competitor, how often it names you."
        />
        <MetricCard label="Citation Rate" value={pct(citRate)} helper={`${brandCited.size}/${allCited.size} cited answers`} tooltip="Of the AI answers that cite sources, how often your site or brand is one of them." />
        <MetricCard label="Top-Position Rate" value={pct(summary.topThreeRate)} helper="ranked top 3" tooltip="How often you appear in the top 3 companies named in an AI answer." />
        <MetricCard label="First Mention Rate" value={pct(topOneRate)} helper="named first" tooltip="How often you are the first company named in an AI answer." />
      </section>

      <section className="dashboard-grid">
        <Leaderboard title="Visibility Score" subtitle="How visible are you in AI search overall?" data={leaderboard} filter={visFilter} setFilter={setVisFilter} mode="vis" onMore={() => onNav("competitors")} moreLabel="See all competitors" />
        <Leaderboard title="Share of Voice" subtitle="When a brand gets mentioned, how often is it you?" data={leaderboard} filter={sovFilter} setFilter={setSovFilter} mode="sov" onMore={() => onNav("competitors")} moreLabel="See all competitors" />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <PanelHead
            title="Citation Sources"
            subtitle="Which websites does AI rely on to answer?"
            right={
              <div className="segmented">
                {(["all", "gemini", "chatgpt"] as const).map((option) => (
                  <button key={option} className={citFilter === option ? "active" : ""} onClick={() => setCitFilter(option)}>
                    {option === "all" ? "All" : option === "gemini" ? "Gemini" : "ChatGPT"}
                  </button>
                ))}
              </div>
            }
          />
          <div>
            {topDomains.length ? (
              topDomains.map((row) => (
                <div key={row.domain} className="rank-row">
                  <span className="lhs">
                    <b>{row.domain}</b>
                    <Badge tone={row.type}>{row.type}</Badge>
                  </span>
                  <strong>{row.count}</strong>
                </div>
              ))
            ) : (
              <p className="muted" style={{ padding: "16px 20px" }}>
                No citations captured for this platform.
              </p>
            )}
          </div>
          <button className="text-cta" onClick={() => onNav("citations")}>
            See all citations <Icon name="arrow" size={13} />
          </button>
        </div>

        <CategoryCoveragePanel payload={payload} onMore={() => onNav("prompts")} moreLabel="See all prompts" />
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Prompts
   ──────────────────────────────────────────────────────────── */
function PromptsView({ payload, stats }: { payload: ReportPayload; stats: ReportStats }) {
  const [filter, setFilter] = useState<PromptFilter>("all");
  const [cat, setCat] = useState("All");
  const [expanded, setExpanded] = useState("");

  const summary = payload.summary;
  const topOneRate = topOneRateOf(payload);
  const topCompetitor = stats.mentionShareRows.find((row) => !row.isTarget);

  const visible = useMemo(() => {
    return stats.promptRows.filter((row) => {
      if (cat !== "All" && displayCategory(row.query) !== cat) return false;
      if (filter === "ranked" && !row.hasTarget) return false;
      if (filter === "missing" && row.hasTarget) return false;
      return true;
    });
  }, [filter, cat, stats.promptRows]);

  useEffect(() => {
    if (!visible.length) return;
    if (!expanded || !visible.some((row) => row.query.id === expanded)) {
      setExpanded(visible[0].query.id);
    }
    // Key on `visible` only: re-running on `expanded` would instantly re-open a row the user just collapsed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <div className="view-stack">
      <section className="metric-grid five">
        <MetricCard label="Total Prompts" value={String(stats.totalQueries)} helper={`${payload.report.runs.length} AI checks`} />
        <MetricCard label="You Rank In" value={String(stats.mentionedQueries)} helper="prompts with a mention" />
        <MetricCard label="Missing" value={String(stats.missingQueries)} helper="not ranked anywhere" />
        <MetricCard label="#1 Position %" value={pct(topOneRate)} helper="ranked #1" />
        <MetricCard label="Top Competitor" value={topCompetitor ? topCompetitor.name : "—"} valueSm helper={topCompetitor ? pct(topCompetitor.visibilityRate) + " visibility" : ""} />
      </section>

      <CategoryCoveragePanel payload={payload} />

      <section className="panel">
        <div className="prompt-tools">
          <div className="segmented">
            {([["all", "All"], ["ranked", "Your rank"], ["missing", "Missing"]] as const).map(([key, label]) => (
              <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
          <span className="sort-note">Sorted by category, then priority</span>
        </div>

        <div className="intent-pills">
          <button className={cat === "All" ? "active" : ""} onClick={() => setCat("All")}>
            All <span>{stats.totalQueries}</span>
          </button>
          {stats.categoryCoverage.map((row) => (
            <button key={row.category} className={cat === row.category ? "active" : ""} onClick={() => setCat(row.category)}>
              {row.category} <span>{row.total}</span>
            </button>
          ))}
        </div>

        <div className="prompt-table">
          <div className="prompt-head">
            <span>Prompt</span>
            <span>Intent</span>
            <span>Gemini</span>
            <span>ChatGPT</span>
            <span>#1 competitor</span>
          </div>
          {visible.map((row) => (
            <div key={row.query.id} className={"prompt-record" + (expanded === row.query.id ? " open" : "")}>
              <button className="prompt-row" onClick={() => setExpanded(expanded === row.query.id ? "" : row.query.id)}>
                <span className="prompt-text">
                  <i className={"row-chev" + (expanded === row.query.id ? " open" : "")}>›</i>
                  <span className="label">{row.query.text}</span>
                </span>
                <span>
                  <Badge>{INTENT_LABELS[row.query.intent] || row.query.intent}</Badge>
                </span>
                <span className="cell-center">
                  <RankCell run={row.bySurface.gemini_maps} />
                </span>
                <span className="cell-center">
                  <RankCell run={row.bySurface.chatgpt_search} />
                </span>
                <span className="comp-name">{row.topCompetitor || "—"}</span>
              </button>
              {expanded === row.query.id ? <PromptDetails row={row} /> : null}
            </div>
          ))}
          {!visible.length ? (
            <p className="muted" style={{ padding: "20px" }}>
              No prompts match these filters.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

// One column per platform: response → why-not-recommended → cited sources.
// Grouping by platform makes each engine's story self-contained (and makes clear
// that, e.g., a ChatGPT "few reviews" note is about the open web, not Google reviews).
const PROMPT_PLATFORMS = [
  // Google = Maps (local pack) + AI Overview (Search). Show whichever response the
  // prompt actually triggered, preferring the local pack when both exist; research
  // prompts only run on AI Overview, so the response falls back to it.
  { key: "gemini", responseSurfaces: ["gemini_maps", "gemini_search"], citeSurfaces: ["gemini_maps", "gemini_search"] },
  { key: "chatgpt", responseSurfaces: ["chatgpt_search"], citeSurfaces: ["chatgpt_search"] }
] as const;

function PromptDetails({ row }: { row: PromptRow }) {
  return (
    <div className="prompt-details">
      {PROMPT_PLATFORMS.map((pf) => {
        const surfaces = pf.responseSurfaces as readonly string[];
        const responseSurface = pf.responseSurfaces.find((surface) => row.bySurface[surface]) ?? pf.responseSurfaces[0];
        const run = row.bySurface[responseSurface];
        const rank = targetRank(run);
        // Insight is only computed on run #1 — look across repeats/surfaces for the carrier.
        const insightRun = row.runs.find((item) => surfaces.includes(item.surface) && item.missingInsight);
        const insight = insightRun?.missingInsight ? parseInsight(insightRun.missingInsight.answer) : null;
        const citations = buildPromptCitationRows(row, pf.citeSurfaces);
        const src = surfaceSource(responseSurface);

        return (
          <div key={pf.key} className="platform-col">
            <div className="pcol-head">
              <span className={"isrc-badge isrc-" + responseSurface}>{src.label}</span>
            </div>

            <div className="pcol-block">
              <div className="pcol-h">
                <span>Response</span>
                <span className="pcol-rank">{rank ? `You rank #${rank}` : "You: not ranked"}</span>
              </div>
              <ol>
                {(run ? run.mentions : []).slice(0, 5).map((mention, index) => (
                  <li key={index} className={mention.isTarget ? "you" : ""}>
                    {mention.companyName}
                  </li>
                ))}
              </ol>
              <p className="answer-excerpt">{run ? truncate(run.rawAnswer, 220) : "No response saved yet."}</p>
            </div>

            {insight ? (
              <div className="pcol-block pcol-insight">
                <div className="pcol-h">
                  <span>
                    Why you weren&rsquo;t recommended
                    <i className="info-dot" tabIndex={0}>i<em>What the AI said when we asked it directly why it didn&rsquo;t recommend you.</em></i>
                  </span>
                </div>
                {insight.intro ? <p className="insight-intro">{renderRich(insight.intro)}</p> : null}
                {insight.bullets.length ? (
                  <ul className="insight-bullets">
                    {insight.bullets.map((bullet, index) => (
                      <li key={index}>{renderRich(bullet)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="pcol-block">
              <div className="pcol-h">
                <span>Cited sources</span>
              </div>
              {citations.length ? (
                <div className="pc-list">
                  {citations.map((citation) => (
                    <a key={citation.key} href={citation.url} target="_blank" rel="noreferrer" className="pc-row">
                      <span>{citation.title}</span>
                      <code>{citation.url}</code>
                      <small>
                        {citation.domain} · {citation.count}x cited
                      </small>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="muted">{pf.key === "gemini" ? "No web sources cited — Google answers from the local pack often cite none." : "No sources cited for this prompt."}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Citations
   ──────────────────────────────────────────────────────────── */
function CitationsView({ payload }: { payload: ReportPayload }) {
  const [cFilter, setCFilter] = useState<SurfaceFilter>("all");
  const [domType, setDomType] = useState<"all" | SourceType>("all");
  const cit = useMemo(() => buildCitationStats(payload, cFilter), [payload, cFilter]);
  const filteredDomains = useMemo(
    () => (domType === "all" ? cit.domainDetails : cit.domainDetails.filter((row) => row.type === domType)),
    [cit, domType]
  );
  const [expanded, setExpanded] = useState("");

  useEffect(() => {
    setExpanded(filteredDomains[0]?.domain ?? "");
  }, [filteredDomains]);

  return (
    <div className="view-stack">
      <p className="page-note">
        Citation stats use the sources AI cites as supporting authority. Platform sources are directories, review sites, trust profiles, and editorial lists; competitor sources are other HVAC company websites.
      </p>

      <div className="cit-controls">
        <div className="segmented">
          {([["all", "All"], ["gemini", "Google"], ["chatgpt", "ChatGPT"]] as const).map(([key, label]) => (
            <button key={key} className={cFilter === key ? "active" : ""} onClick={() => setCFilter(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="metric-grid four">
        <MetricCard label="Unique Sources" value={String(cit.uniqueSources)} helper="real citation domains" />
        <MetricCard label="Total Citations" value={String(cit.totalCitations)} helper="counted once per run" />
        <MetricCard label="Your Citation Share" value={pct(cit.ownedShare)} helper={`${cit.ownedCitations} owned citations`} />
        <MetricCard label="Platform Source Share" value={pct(cit.platformShare)} helper="directories, reviews, editorial" />
      </section>

      <section className="panel">
        <PanelHead title="Where AI Gets Its Answers" subtitle="Citation volume by source type" />
        <div className="panel-body">
          <div className="coverage">
            {cit.typeRows.map((row) => (
              <div key={row.type} className={"coverage-row citation-type-row " + row.type.toLowerCase()}>
                <span>{row.type}</span>
                <Track value={row.share} />
                <strong>
                  {row.count}
                  <small>{pct(row.share)}</small>
                </strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <PanelHead
          title="Top Cited Domains"
          subtitle="Expand a domain to see the exact cited pages"
          right={
            <div className="segmented">
              {([["all", "All"], ["Competitor", "Competitor"], ["Platform", "Platform"], ["Owned", "Owned"]] as const).map(([key, label]) => (
                <button key={key} className={domType === key ? "active" : ""} onClick={() => setDomType(key)}>
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <div className="src-table">
          <div className="src-head">
            <span>Domain</span>
            <span>Type</span>
            <span>Citations</span>
            <span>Share</span>
          </div>
          {!filteredDomains.length ? (
            <p className="muted" style={{ padding: "12px 0" }}>
              No {domType === "all" ? "" : domType.toLowerCase() + " "}sources cited for this selection.
            </p>
          ) : null}
          {filteredDomains.map((row) => {
            const open = expanded === row.domain;
            return (
              <div key={row.domain} className="dom-group">
                <button className={"dom-row" + (open ? " expanded" : "")} onClick={() => setExpanded(open ? "" : row.domain)}>
                  <strong>
                    <i>{open ? "⌄" : "›"}</i>
                    {row.domain}
                  </strong>
                  <span>
                    <Badge tone={row.type}>{row.type}</Badge>
                  </span>
                  <span>{row.count}</span>
                  <span>{pct(row.share)}</span>
                </button>
                {open ? (
                  <div className="url-list">
                    {row.urls.length ? (
                      row.urls.map((url) => (
                        <a key={url.key} href={url.url} target="_blank" rel="noreferrer" className="url-row">
                          <div className="u-main">
                            <strong>{url.title}</strong>
                            <code>{url.url}</code>
                            <p>{url.prompts.slice(0, 3).join(" · ")}</p>
                          </div>
                          <span>{url.count}x cited</span>
                          <span>{url.promptCount} prompts</span>
                        </a>
                      ))
                    ) : (
                      <p className="muted" style={{ padding: "8px 0" }}>
                        No exact URLs were captured for this domain.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Competitors
   ──────────────────────────────────────────────────────────── */
function CompetitorsView({ payload, stats }: { payload: ReportPayload; stats: ReportStats }) {
  const [vf, setVf] = useState<SurfaceFilter>("all");
  const [sf, setSf] = useState<SurfaceFilter>("all");
  const leaderboard = useMemo(() => buildLeaderboardData(payload), [payload]);

  return (
    <div className="view-stack">
      <p className="page-note">
        How {payload.company.name.split(",")[0]} ranks against other HVAC companies in {primaryLocation(payload.company)}, across {stats.totalQueries} tracked prompts.
      </p>
      <p className="bench-note">Ranked by how often each company is named across ChatGPT and Gemini. Switch a list to a single platform with the toggle.</p>

      <section className="dashboard-grid">
        <Leaderboard title="Visibility Score" subtitle="How visible are you in AI search overall?" data={leaderboard} filter={vf} setFilter={setVf} mode="vis" limit={10} />
        <Leaderboard title="Share of Voice" subtitle="When a brand gets mentioned, how often is it you?" data={leaderboard} filter={sf} setFilter={setSf} mode="sov" limit={10} />
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sentiment
   ──────────────────────────────────────────────────────────── */
function SentimentView({ payload, stats }: { payload: ReportPayload; stats: ReportStats }) {
  const [sFilter, setSFilter] = useState<SurfaceFilter>("all");
  const s = useMemo(() => buildSentimentStats(payload, stats, sFilter), [payload, stats, sFilter]);
  const leftPct = Math.round((s.score + 1) * 50);

  return (
    <div className="view-stack">
      <section className="sentiment-hero">
        <div className="sent-head">
          <span className="ov">Overall AI sentiment — {s.label}</span>
          <div className="segmented">
            {(["all", "gemini", "chatgpt"] as const).map((option) => (
              <button key={option} className={sFilter === option ? "active" : ""} onClick={() => setSFilter(option)}>
                {option === "all" ? "All" : option === "gemini" ? "Gemini" : "ChatGPT"}
              </button>
            ))}
          </div>
        </div>
        <strong className="sentiment-score">{signed(s.score)}</strong>
        <div className="sent-meter">
          <i style={{ left: `${leftPct}%` }}>{signed(s.score)}</i>
        </div>
        <div className="sent-scale">
          <span>Negative (−1)</span>
          <span>Neutral (0)</span>
          <span>Positive (+1)</span>
        </div>
      </section>

      <section className="dashboard-grid">
        <ThemePanel title="What AI Says That's Working" subtitle="Recurring positive themes in mentions" rows={s.working} positive />
        <ThemePanel title="What AI Says That's Hurting" subtitle="Recurring negative themes in AI language" rows={s.hurting} />
      </section>

      <section className="panel">
        <PanelHead title="Competitor Language to Beat" subtitle="Most repeated proof points from top competitors" />
        <div className="comp-quote-grid">
          {s.competitorThemes.map((competitor) => (
            <div key={competitor.name} className="comp-quote-card">
              <h3>{competitor.name}</h3>
              <span>{competitor.mentions} mentions</span>
              {competitor.themes.map((theme) => (
                <div key={theme.phrase} className="ct">
                  <span>{theme.phrase}</span>
                  <small>{theme.count}x</small>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ThemePanel({ title, subtitle, rows, positive }: { title: string; subtitle: string; rows: ThemeRow[]; positive?: boolean }) {
  return (
    <div className={"panel theme-panel " + (positive ? "positive" : "negative")}>
      <PanelHead title={title} subtitle={subtitle} />
      <div>
        {rows.length ? (
          rows.map((row) => (
            <div key={row.phrase} className="theme-block">
              <span className="theme-mark">{positive ? "✓" : "!"}</span>
              <em>{row.phrase}</em>
              <small>{row.count}x mentioned</small>
              <strong>{signed(row.score)}</strong>
            </div>
          ))
        ) : (
          <p className="muted" style={{ padding: "16px 20px" }}>
            Not enough direct AI language yet.
          </p>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Setup
   ──────────────────────────────────────────────────────────── */
function SetupView({
  companies,
  reports,
  selectedCompanyId,
  repeatRuns,
  selectedCompany,
  setSelectedCompanyId,
  setRepeatRuns,
  createReport,
  loadReport,
  refresh
}: {
  companies: Company[];
  reports: Report[];
  selectedCompanyId: string;
  repeatRuns: number;
  selectedCompany?: Company;
  setSelectedCompanyId: (value: string) => void;
  setRepeatRuns: (value: number) => void;
  createReport: () => Promise<void>;
  loadReport: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  return (
    <section className="setup-grid">
      <CompanyForm onCreated={refresh} />

      <div className="panel form-panel">
        <h2>Run report</h2>
        <div className="sub">Generate and run a tracked audit query set.</div>
        <label className="fld">
          Company
          <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)}>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          Repeat runs per query / platform
          <input type="number" min={1} max={10} value={repeatRuns} onChange={(event) => setRepeatRuns(Number(event.target.value))} />
        </label>
        {selectedCompany ? (
          <div className="muted-block">
            <strong>Locations in this account</strong>
            {selectedCompany.locations.map((location) => (
              <span key={location.id}>
                {location.label}
                {location.isPrimary ? " · primary" : ""}
              </span>
            ))}
          </div>
        ) : null}
        <button className="btn primary" type="button" disabled={!selectedCompany} onClick={createReport}>
          Generate query set
        </button>

        <div className="run-list">
          {reports.slice(0, 6).map((report) => (
            <button key={report.id} type="button" onClick={() => loadReport(report.id)}>
              <strong>{report.status}</strong>
              <span>
                {report.queries.length} queries · {new Date(report.createdAt).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompanyForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [services, setServices] = useState<Service[]>(defaultServices);

  const toggle = (service: Service) => setServices((current) => (current.includes(service) ? current.filter((item) => item !== service) : [...current, service]));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const city = String(form.get("city") || "");
    const state = String(form.get("state") || "");
    const locations: Omit<Location, "id">[] = [
      {
        label: `${city}, ${state}`,
        city,
        state,
        latitude: Number(form.get("latitude")) || undefined,
        longitude: Number(form.get("longitude")) || undefined,
        isPrimary: true
      }
    ];

    await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        website: form.get("website"),
        googleBusinessProfileUrl: form.get("gbp"),
        services,
        competitors: String(form.get("competitors") || "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        locations
      })
    });

    event.currentTarget.reset();
    setServices(defaultServices);
    await onCreated();
  }

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <h2>Create HVAC company</h2>
      <div className="sub">Manual inputs for the audit profile.</div>
      <label className="fld">
        Business name
        <input name="name" required defaultValue="AllTech Services, Inc." />
      </label>
      <label className="fld">
        Website
        <input name="website" required defaultValue="https://alltechservices.com" />
      </label>
      <label className="fld">
        Google Business Profile URL
        <input name="gbp" placeholder="https://maps.google.com/…" />
      </label>
      <div className="two-col">
        <label className="fld">
          Primary city
          <input name="city" required defaultValue="Sterling" />
        </label>
        <label className="fld">
          State
          <input name="state" required defaultValue="VA" />
        </label>
      </div>
      <div className="two-col">
        <label className="fld">
          Latitude
          <input name="latitude" placeholder="39.0067" />
        </label>
        <label className="fld">
          Longitude
          <input name="longitude" placeholder="-77.4286" />
        </label>
      </div>
      <fieldset>
        <legend>HVAC services</legend>
        <div className="checks">
          {HVAC_SERVICES.map((service) => (
            <label key={service} className="check">
              <input type="checkbox" checked={services.includes(service)} onChange={() => toggle(service)} />
              {service}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="fld">
        Known competitors
        <textarea name="competitors" defaultValue={"Cardinal Plumbing Heating & Air\nVernon The Heating & Cooling Specialist\nMeade's Heating and Air"} />
      </label>
      <button className="btn primary" type="submit" style={{ marginTop: "4px" }}>
        Save company
      </button>
    </form>
  );
}

function LoadingState() {
  return (
    <section className="panel loading-state">
      <span className="spinner" />
      <p>Loading report…</p>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="panel empty-state">
      <span className="es-icon"><Icon name="clock" size={20} /></span>
      <h2>Your report isn&apos;t ready yet</h2>
      <p>We&apos;re still putting your numbers together — this can take a couple of minutes. Please check back shortly.</p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Shared UI primitives
   ──────────────────────────────────────────────────────────── */
function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="nav-group">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Navi({ icon, active, count, onClick, children }: { icon: string; active?: boolean; count?: number; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button className={"navi" + (active ? " active" : "")} onClick={onClick}>
      <Icon name={icon} size={16} />
      <span>{children}</span>
      {typeof count === "number" ? <span className="count">{count}</span> : null}
    </button>
  );
}

function PanelHead({ title, subtitle, right, tooltip }: { title: string; subtitle?: string; right?: React.ReactNode; tooltip?: string }) {
  return (
    <div className={right ? "controls-head" : "panel-head"}>
      <div className="ph-title">
        <h2>
          {title}
          {tooltip ? (
            <i className="info-dot" tabIndex={0}>
              i<em>{tooltip}</em>
            </i>
          ) : null}
        </h2>
        {subtitle ? <span className="sub">{subtitle}</span> : null}
      </div>
      {right || null}
    </div>
  );
}

function MetricCard({ label, value, helper, status, tooltip, valueSm }: { label: string; value: string; helper?: string; status?: string; tooltip?: string; valueSm?: boolean }) {
  return (
    <div className="metric-card">
      <span className="metric-label">
        {label}
        {tooltip ? (
          <i className="info-dot" tabIndex={0}>
            i<em>{tooltip}</em>
          </i>
        ) : null}
      </span>
      <div className="metric-value">
        <strong className={valueSm ? "sm" : ""}>{value}</strong>
        {status ? <i className={"status-pill " + status.toLowerCase()}>{status}</i> : null}
      </div>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={"badge" + (tone ? " " + tone.toLowerCase() : "")}>{children}</span>;
}

function Track({ value, tone }: { value: number; tone?: string }) {
  return (
    <div className={"track" + (tone ? " " + tone.toLowerCase() : "")}>
      <i style={{ width: `${Math.max(2, Math.round(value * 100))}%` }} />
    </div>
  );
}

function RankCell({ run }: { run?: SurfaceRun }) {
  if (!run) return <span className="dash">—</span>;
  if (run.rawAnswer.startsWith("Provider error:")) return <span className="error-pill">Error</span>;
  const rank = targetRank(run);
  return rank ? <span className={"rank-pill" + (rank === 1 ? " one" : "")}>#{rank}</span> : <span className="missing-pill">Missing</span>;
}

/* ── Leaderboard ── */
function Leaderboard({
  title,
  subtitle,
  data,
  filter,
  setFilter,
  mode,
  limit = 5,
  onMore,
  moreLabel
}: {
  title: string;
  subtitle?: string;
  data: Record<SurfaceFilter, MentionShareRow[]>;
  filter: SurfaceFilter;
  setFilter: (filter: SurfaceFilter) => void;
  mode: "vis" | "sov";
  limit?: number;
  onMore?: () => void;
  moreLabel?: string;
}) {
  const scoreOf = (row: MentionShareRow) => row.visibilityScore ?? row.visibilityRate;
  // Visibility score ranks by the quality-weighted score; share of voice ranks by raw mention count.
  const rows = [...(data[filter] || [])].sort((a, b) =>
    mode === "vis" ? scoreOf(b) - scoreOf(a) || Number(b.isTarget) - Number(a.isTarget) : b.count - a.count || Number(b.isTarget) - Number(a.isTarget)
  );
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  const maxScore = Math.max(0.0001, ...rows.map(scoreOf));
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  const top = rows.slice(0, limit);
  const targetRow = rows.find((row) => row.isTarget);
  const pinned = Boolean(targetRow && !top.some((row) => row.isTarget));
  const visible = pinned && targetRow ? [...top, targetRow] : top;
  const valOf = (row: MentionShareRow) => (mode === "sov" ? row.count / totalCount : scoreOf(row));
  const barOf = (row: MentionShareRow) => (mode === "sov" ? row.count / maxCount : scoreOf(row) / maxScore);
  const bandOf = (value: number) => (mode === "vis" ? band(value, 0.3, 0.2) : value >= 0.15 ? "High" : value >= 0.08 ? "Medium" : "Low");

  return (
    <div className="panel">
      <PanelHead
        title={title}
        subtitle={subtitle}
        right={
          <div className="segmented">
            {(["all", "gemini", "chatgpt"] as const).map((option) => (
              <button key={option} className={filter === option ? "active" : ""} onClick={() => setFilter(option)}>
                {option === "all" ? "All" : option === "gemini" ? "Google" : "ChatGPT"}
              </button>
            ))}
          </div>
        }
      />
      <div className="lb-list">
        {visible.map((row, index) => (
          <div key={row.name + index} className={"lb-row" + (row.isTarget ? " you" : "")}>
            <div className="who">
              <strong>{row.name}</strong>
              <span>{row.isTarget ? "You" : "Competitor"}</span>
            </div>
            <Track value={barOf(row)} tone={bandOf(valOf(row))} />
            <b>{pct(valOf(row))}</b>
          </div>
        ))}
      </div>
      {onMore ? (
        <button className="text-cta" onClick={onMore}>
          {moreLabel} <Icon name="arrow" size={13} />
        </button>
      ) : null}
    </div>
  );
}

/* ── AI visibility score by prompt type (platform-toggleable) ── */
function CategoryCoveragePanel({ payload, onMore, moreLabel }: { payload: ReportPayload; onMore?: () => void; moreLabel?: string }) {
  const [filter, setFilter] = useState<SurfaceFilter>("all");
  const coverage = useMemo(() => buildCategoryCoverage(payload, filter), [payload, filter]);
  return (
    <div className="panel">
      <PanelHead
        title="Visibility by Question Type"
        subtitle="Which kinds of questions do you show up for?"
        right={
          <div className="segmented">
            {(["all", "gemini", "chatgpt"] as const).map((option) => (
              <button key={option} className={filter === option ? "active" : ""} onClick={() => setFilter(option)}>
                {option === "all" ? "All" : option === "gemini" ? "Google" : "ChatGPT"}
              </button>
            ))}
          </div>
        }
      />
      <div className="cov-list">
        {coverage.map((row) => (
          <div key={row.category} className="coverage-row">
            <span>{row.category}</span>
            <Track value={row.rate} tone={band(row.rate, 0.6, 0.34)} />
            <strong>
              {pct(row.rate)}
              <small>
                {row.mentioned}/{row.total}
              </small>
            </strong>
          </div>
        ))}
      </div>
      {onMore ? (
        <button className="text-cta" onClick={onMore}>
          {moreLabel} <Icon name="arrow" size={13} />
        </button>
      ) : null}
    </div>
  );
}

/* ── Semicircular visibility gauge ── */
function Gauge({ value }: { value: number }) {
  const cx = 100;
  const cy = 100;
  const r = 78;
  const sw = 16;
  const toRad = (v: number) => ((180 - v * 1.8) * Math.PI) / 180;
  const pt = (v: number, rad = r): [number, number] => {
    const a = toRad(v);
    return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)];
  };
  const seg = (a: number, b: number) => {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const aRad = toRad(value);
  const bc = pt(value, r - sw / 2 - 13);
  const tipP = pt(value, r - sw / 2 - 1);
  const tang = aRad + Math.PI / 2;
  const hw = 7;
  const b1: [number, number] = [bc[0] + hw * Math.cos(tang), bc[1] - hw * Math.sin(tang)];
  const b2: [number, number] = [bc[0] - hw * Math.cos(tang), bc[1] + hw * Math.sin(tang)];
  const ticks = [0, 25, 50, 75, 100];
  return (
    <svg className="gauge-svg" viewBox="-8 -4 216 126" role="img" aria-label={`Visibility score ${value} of 100`}>
      <path className="gtrack" d={seg(0, 100)} strokeWidth={sw} />
      <path d={seg(1, 19)} stroke="var(--destructive)" strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d={seg(21, 29)} stroke="var(--warning)" strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d={seg(31, 99)} stroke="var(--success)" strokeWidth={sw} strokeLinecap="round" fill="none" />
      {ticks.map((tick) => {
        const [tx, ty] = pt(tick, r + 16);
        return (
          <text key={tick} className="gtick" x={tx} y={ty + 3.5} textAnchor="middle">
            {tick}
          </text>
        );
      })}
      <polygon className="gneedle" points={`${tipP[0].toFixed(2)},${tipP[1].toFixed(2)} ${b1[0].toFixed(2)},${b1[1].toFixed(2)} ${b2[0].toFixed(2)},${b2[1].toFixed(2)}`} />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   Data layer — ported from the proven app/v2 implementation.
   ══════════════════════════════════════════════════════════════ */

type SourceType = "Competitor" | "Platform" | "Owned" | "Others";

type CitationDomainRow = {
  name: string;
  domain: string;
  type: SourceType;
  count: number;
  share: number;
  owned: boolean;
};

type CitationUrlRow = {
  key: string;
  title: string;
  url: string;
  domain: string;
  count: number;
  promptCount: number;
  prompts: string[];
};

type CitationDomainDetail = CitationDomainRow & { urls: CitationUrlRow[] };

type CitationStats = {
  uniqueSources: number;
  totalCitations: number;
  ownedCitations: number;
  ownedShare: number;
  platformShare: number;
  domainRows: CitationDomainRow[];
  domainDetails: CitationDomainDetail[];
  typeRows: Array<{ type: SourceType; count: number; share: number }>;
};

type PromptCitationRow = { key: string; title: string; url: string; domain: string; count: number };

type ThemeRow = { phrase: string; count: number; score: number; quotes: string[] };

type MentionContext = { mention: CompanyMention; answer: string; surface: string; companyName: string };

type SentimentStats = {
  score: number;
  label: string;
  working: ThemeRow[];
  hurting: ThemeRow[];
  competitorThemes: Array<{ name: string; mentions: number; themes: Array<{ phrase: string; count: number; quotes: string[] }> }>;
};

type PromptRow = {
  query: Query;
  runs: SurfaceRun[];
  bySurface: Partial<Record<(typeof customerSurfaces)[number], SurfaceRun>>;
  bestRank: number | null;
  hasTarget: boolean;
  hasInsight: boolean;
  topCompetitor: string | null;
};

type MentionShareRow = { name: string; count: number; visibilityRate: number; averageRank: number | null; isTarget: boolean; visibilityScore?: number };

type ReportStats = {
  totalQueries: number;
  mentionedQueries: number;
  missingQueries: number;
  surfaceCount: number;
  categories: string[];
  promptRows: PromptRow[];
  categoryCoverage: Array<{ category: string; total: number; mentioned: number; rate: number }>;
  mentionShareRows: MentionShareRow[];
};

type RadarMetrics = { visibility: number; promptMention: number; topPosition: number; topOne: number };

const categoryOrder = ["Core Local Service", "Emergency Repair", "Research"];

// Funnel-stage category derived from each prompt's intent (not query length or
// surface). Ready-to-hire intents keep a high-intent topical bucket; everyone in
// the consideration/research stage rolls into a single "Research" category.
function displayCategory(query: Query): string {
  switch (query.intent) {
    case "emergency":
      return "Emergency Repair";
    case "near_me":
    case "best":
      return "Core Local Service";
    default:
      // review, comparison, price, problem
      return "Research";
  }
}

function buildReportStats(payload: ReportPayload): ReportStats {
  const promptRows: PromptRow[] = payload.report.queries.map((query) => {
    const runs = payload.report.runs.filter((run) => run.queryId === query.id);
    // Show run #1 for each surface so the displayed answer/ranking matches the
    // "why not recommended" insight (which is only computed on run #1), instead
    // of an arbitrary repeat picked by array order.
    const bySurface = Object.fromEntries(
      customerSurfaces.map((surface) => {
        const surfaceRuns = runs.filter((run) => run.surface === surface);
        return [surface, surfaceRuns.find((run) => run.runNumber === 1) ?? surfaceRuns[0]];
      })
    ) as PromptRow["bySurface"];
    const customerRuns = runs.filter((run) => customerSurfaces.includes(run.surface as (typeof customerSurfaces)[number]));
    const ranks = customerRuns.map((run) => targetRank(run)).filter((rank): rank is number => typeof rank === "number");
    // Use the customer-facing surfaces (Gemini Maps + ChatGPT) shown in the cards,
    // not Gemini Search (citations-only) — so the "#1 competitor" is always visible below.
    const competitors = customerRuns
      .flatMap((run) => run.mentions)
      .filter((mention) => !mention.isTarget)
      .sort((a, b) => a.rank - b.rank);
    return {
      query,
      runs,
      bySurface,
      bestRank: ranks.length ? Math.min(...ranks) : null,
      hasTarget: ranks.length > 0,
      hasInsight: runs.some((run) => run.missingInsight),
      topCompetitor: competitors[0]?.companyName ?? null
    };
  });

  promptRows.sort((a, b) => {
    const ca = categoryOrder.indexOf(displayCategory(a.query));
    const cb = categoryOrder.indexOf(displayCategory(b.query));
    if (ca !== cb) return ca - cb;
    return priorityValue(b.query.priority) - priorityValue(a.query.priority);
  });

  const categories = categoryOrder.filter((category) => promptRows.some((row) => displayCategory(row.query) === category));
  const categoryCoverage = categories.map((category) => {
    const rows = promptRows.filter((row) => displayCategory(row.query) === category);
    const mentioned = rows.filter((row) => row.hasTarget).length;
    return { category, total: rows.length, mentioned, rate: rows.length ? mentioned / rows.length : 0 };
  });

  const customerRuns = payload.report.runs.filter((run) => customerSurfaces.includes(run.surface as (typeof customerSurfaces)[number]));
  const mentionShareRows = buildMentionShareRows(payload, customerRuns);
  const mentionedQueries = promptRows.filter((row) => row.hasTarget).length;

  return {
    totalQueries: promptRows.length,
    mentionedQueries,
    missingQueries: promptRows.length - mentionedQueries,
    surfaceCount: customerSurfaces.length,
    categories,
    promptRows,
    categoryCoverage,
    mentionShareRows
  };
}

function recomputeSummaryForLocation(runs: SurfaceRun[], base: VisibilitySummary): VisibilitySummary {
  const targetMentions = runs.flatMap((run) => run.mentions.filter((mention) => mention.isTarget));
  const topThree = targetMentions.filter((mention) => mention.rank <= 3).length;
  const surfaceScores = Array.from(new Set(runs.map((run) => run.surface))).map((surface) => {
    const sr = runs.filter((run) => run.surface === surface);
    const ms = sr.flatMap((run) => run.mentions.filter((mention) => mention.isTarget));
    return { surface, runs: sr.length, mentionRate: sr.length ? ms.length / sr.length : 0, averageRank: averageNumber(ms.map((mention) => mention.rank)) };
  });
  const groups = new Map<string, { name: string; count: number }>();
  runs.forEach((run) =>
    run.mentions
      .filter((mention) => !mention.isTarget)
      .forEach((mention) => {
        const key = canonicalCompanyName(mention.companyName);
        const group = groups.get(key) ?? { name: mention.companyName, count: 0 };
        group.count += 1;
        if (mention.companyName.length > group.name.length) group.name = mention.companyName;
        groups.set(key, group);
      })
  );
  const competitorCounts = Array.from(groups.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  return {
    ...base,
    totalRuns: runs.length,
    targetMentions: targetMentions.length,
    mentionRate: runs.length ? targetMentions.length / runs.length : 0,
    topThreeRate: runs.length ? topThree / runs.length : 0,
    averageRank: averageNumber(targetMentions.map((mention) => mention.rank)),
    competitorCounts,
    surfaceScores
  };
}

function buildCategoryCoverage(payload: ReportPayload, surfaceFilter: SurfaceFilter) {
  const surfaces: readonly string[] = surfaceFilter === "gemini" ? ["gemini_maps"] : surfaceFilter === "chatgpt" ? ["chatgpt_search"] : customerSurfaces;
  const rows = payload.report.queries.map((query) => {
    const runs = payload.report.runs.filter((run) => run.queryId === query.id && surfaces.includes(run.surface));
    return { category: displayCategory(query), hasTarget: runs.some((run) => targetRank(run) !== null) };
  });
  const categories = categoryOrder.filter((category) => rows.some((row) => row.category === category));
  return categories.map((category) => {
    const catRows = rows.filter((row) => row.category === category);
    const mentioned = catRows.filter((row) => row.hasTarget).length;
    return { category, total: catRows.length, mentioned, rate: catRows.length ? mentioned / catRows.length : 0 };
  });
}

function buildLeaderboardData(payload: ReportPayload): Record<SurfaceFilter, MentionShareRow[]> {
  // Each row carries BOTH metrics: `count` (mention share) and `visibilityScore`
  // (the gauge's quality-weighted score, which also rewards ranking near the top).
  const make = (filter: SurfaceFilter) => {
    const runs = mentionShareRuns(payload.report.runs, filter);
    return buildMentionShareRows(payload, runs).map((row) => ({
      ...row,
      // "all" ranks by the 70/30 engine blend; per-engine tabs rank by that engine alone.
      visibilityScore:
        filter === "all"
          ? blendedVisibilityForName(payload, row.name, row.isTarget)
          : visibilityMetricsForName(payload, runs, row.name, row.isTarget).visibility
    }));
  };
  return { all: make("all"), gemini: make("gemini"), chatgpt: make("chatgpt") };
}

function mentionShareRuns(runs: SurfaceRun[], filter: SurfaceFilter) {
  const surfaces: readonly string[] =
    filter === "gemini" ? ENGINE_SURFACES.gemini : filter === "chatgpt" ? ENGINE_SURFACES.chatgpt : customerSurfaces;
  return runs.filter((run) => surfaces.includes(run.surface));
}

function buildMentionShareRows(payload: ReportPayload, runs: SurfaceRun[]): MentionShareRow[] {
  const targetKey = canonicalCompanyName(payload.company.name);
  const groups = new Map<string, { name: string; count: number; ranks: number[]; isTarget: boolean }>();

  for (const run of runs) {
    const seenInRun = new Set<string>();
    for (const mention of run.mentions) {
      const mentionKey = canonicalCompanyName(mention.companyName);
      const isTarget = mention.isTarget || mentionKey === targetKey;
      const key = isTarget ? "__target" : mentionKey;
      if (!key || seenInRun.has(key)) continue;
      seenInRun.add(key);
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        existing.ranks.push(mention.rank);
        if (!isTarget && mention.companyName.length > existing.name.length) existing.name = mention.companyName;
        continue;
      }
      groups.set(key, { name: isTarget ? payload.company.name : mention.companyName, count: 1, ranks: [mention.rank], isTarget });
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      name: group.name,
      count: group.count,
      visibilityRate: runs.length ? group.count / runs.length : 0,
      averageRank: averageNumber(group.ranks),
      isTarget: group.isTarget
    }))
    .sort((a, b) => b.count - a.count || Number(b.isTarget) - Number(a.isTarget) || (a.averageRank ?? 99) - (b.averageRank ?? 99));
}

function weightedVisibilityScore(metrics: RadarMetrics) {
  return metrics.visibility * 0.5 + metrics.promptMention * 0.25 + metrics.topPosition * 0.15 + metrics.topOne * 0.1;
}

function visibilityMetricsForName(payload: ReportPayload, runs: SurfaceRun[], name: string, isTarget: boolean): RadarMetrics {
  const key = isTarget ? "__target" : canonicalCompanyName(name);
  const queryIds = new Set<string>();
  let mentions = 0;
  let topThree = 0;
  let topOne = 0;

  for (const run of runs) {
    const mention = run.mentions.find((item) => (isTarget ? item.isTarget : canonicalCompanyName(item.companyName) === key));
    if (!mention) continue;
    mentions += 1;
    queryIds.add(run.queryId);
    if (mention.rank <= 3) topThree += 1;
    if (mention.rank === 1) topOne += 1;
  }
  return {
    visibility: weightedVisibilityScore({
      visibility: runs.length ? mentions / runs.length : 0,
      promptMention: payload.report.queries.length ? queryIds.size / payload.report.queries.length : 0,
      topPosition: runs.length ? topThree / runs.length : 0,
      topOne: runs.length ? topOne / runs.length : 0
    }),
    promptMention: payload.report.queries.length ? queryIds.size / payload.report.queries.length : 0,
    topPosition: runs.length ? topThree / runs.length : 0,
    topOne: runs.length ? topOne / runs.length : 0
  };
}

// Overall score = weighted blend of each engine's own visibility score, rather
// than pooling raw runs (which over-weights ChatGPT because more prompts hit it).
// A ChatGPT-only company therefore caps at CHATGPT_WEIGHT of the overall score.
function blendedVisibilityForName(payload: ReportPayload, name: string, isTarget: boolean): number {
  const gemini = visibilityMetricsForName(payload, mentionShareRuns(payload.report.runs, "gemini"), name, isTarget).visibility;
  const chatgpt = visibilityMetricsForName(payload, mentionShareRuns(payload.report.runs, "chatgpt"), name, isTarget).visibility;
  return gemini * GEMINI_WEIGHT + chatgpt * CHATGPT_WEIGHT;
}

function topOneRateOf(payload: ReportPayload) {
  const topOne = payload.report.runs.flatMap((run) => run.mentions.filter((mention) => mention.isTarget && mention.rank === 1));
  return payload.report.runs.length ? topOne.length / payload.report.runs.length : 0;
}

// Split prompts by search intent. Local "ready to hire" prompts (e.g. "HVAC
// companies near me") use Maps grounding and Google shows a local pack, not an
// AI Overview — competitor sites dominate. Research/long-tail prompts get an AI
// Overview and cite a broader set of guides/directories. The Maps surface on a
// query is a clean proxy for that local-intent split.
function queryIntentClass(query: Query | undefined): Extract<PromptTypeFilter, "intention" | "informational"> {
  return query?.surfaces.includes("gemini_maps") ? "intention" : "informational";
}

function buildCitationStats(payload: ReportPayload, surfaceFilter: SurfaceFilter = "all", promptType: PromptTypeFilter = "all"): CitationStats {
  const ownedDomain = domainFromValue(payload.company.website);
  const domainRuns = new Map<string, Set<string>>();
  const urlRuns = new Map<string, Map<string, { title: string; url: string; runs: Set<string>; prompts: Set<string> }>>();

  const surfaces = surfaceFilter === "gemini" ? ["gemini_maps", "gemini_search"] : surfaceFilter === "chatgpt" ? ["chatgpt_search"] : null;
  const queryById = new Map(payload.report.queries.map((query) => [query.id, query]));
  const citationRuns = payload.report.runs.filter(
    (item) =>
      !item.rawAnswer.startsWith("Provider error:") &&
      (!surfaces || surfaces.includes(item.surface)) &&
      (promptType === "all" || queryIntentClass(queryById.get(item.queryId)) === promptType)
  );

  for (const run of citationRuns) {
    const domains = new Set<string>();
    const urlsSeenInRun = new Set<string>();
    const runKey = `${run.queryId}:${run.runNumber}:${run.surface}`;

    for (const mention of run.mentions) {
      for (const citation of mention.citations) {
        const domain = displayCitationDomain(citation);
        const url = citationUrl(citation);
        if (domain) domains.add(domain);
        if (!domain || !url || urlsSeenInRun.has(url)) continue;
        urlsSeenInRun.add(url);

        const byUrl = urlRuns.get(domain) ?? new Map<string, { title: string; url: string; runs: Set<string>; prompts: Set<string> }>();
        const existing = byUrl.get(url);
        if (existing) {
          existing.runs.add(runKey);
          existing.prompts.add(run.queryText);
          if (citation.title.length > existing.title.length && !looksLikeDomain(citation.title)) existing.title = citationTitle(citation, domain);
        } else {
          byUrl.set(url, { title: citationTitle(citation, domain), url, runs: new Set([runKey]), prompts: new Set([run.queryText]) });
        }
        urlRuns.set(domain, byUrl);
      }
    }

    for (const domain of domains) {
      if (!domainRuns.has(domain)) domainRuns.set(domain, new Set());
      domainRuns.get(domain)?.add(runKey);
    }
  }

  const totalCitations = Array.from(domainRuns.values()).reduce((sum, set) => sum + set.size, 0);
  const domainRows: CitationDomainRow[] = Array.from(domainRuns.entries())
    .map(([domain, runs]) => {
      const type = classifyCitationDomain(domain, ownedDomain, payload.report.domainTypes);
      const count = runs.size;
      return { name: domain, domain, type, count, share: totalCitations ? count / totalCitations : 0, owned: domain === ownedDomain };
    })
    .sort((a, b) => b.count - a.count);

  const domainDetails: CitationDomainDetail[] = domainRows.map((row) => {
    const rows = urlRuns.get(row.domain) ?? new Map<string, { title: string; url: string; runs: Set<string>; prompts: Set<string> }>();
    return {
      ...row,
      urls: Array.from(rows.entries())
        .map(([url, value]) => ({ key: url, title: value.title, url: value.url, domain: row.domain, count: value.runs.size, promptCount: value.prompts.size, prompts: Array.from(value.prompts).sort() }))
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    };
  });

  const ownedCitations = domainRows.filter((row) => row.owned).reduce((sum, row) => sum + row.count, 0);
  const platformCitations = domainRows.filter((row) => row.type === "Platform").reduce((sum, row) => sum + row.count, 0);
  const typeMap = new Map<SourceType, number>();
  for (const row of domainRows) typeMap.set(row.type, (typeMap.get(row.type) ?? 0) + row.count);

  return {
    uniqueSources: domainRows.length,
    totalCitations,
    ownedCitations,
    ownedShare: totalCitations ? ownedCitations / totalCitations : 0,
    platformShare: totalCitations ? platformCitations / totalCitations : 0,
    domainRows,
    domainDetails,
    typeRows: Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, count, share: totalCitations ? count / totalCitations : 0 }))
      .sort((a, b) => b.count - a.count)
  };
}

function buildPromptCitationRows(row: PromptRow, surfaces?: readonly string[]): PromptCitationRow[] {
  const citationMap = new Map<string, PromptCitationRow>();
  for (const run of row.runs) {
    if (surfaces && !surfaces.includes(run.surface)) continue;
    const seenInRun = new Set<string>();
    for (const mention of run.mentions) {
      for (const citation of mention.citations) {
        const domain = displayCitationDomain(citation);
        const url = citationUrl(citation);
        if (!domain || !url || seenInRun.has(url)) continue;
        seenInRun.add(url);
        const existing = citationMap.get(url);
        if (existing) {
          existing.count += 1;
          if (citation.title.length > existing.title.length && !looksLikeDomain(citation.title)) existing.title = citation.title;
          continue;
        }
        citationMap.set(url, { key: url, title: citationTitle(citation, domain), url, domain, count: 1 });
      }
    }
  }
  return Array.from(citationMap.values())
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, 5);
}

function buildSentimentStats(payload: ReportPayload, stats: ReportStats, surfaceFilter: SurfaceFilter = "all"): SentimentStats {
  const surfaces: readonly string[] | null = surfaceFilter === "gemini" ? ["gemini_maps", "gemini_search"] : surfaceFilter === "chatgpt" ? ["chatgpt_search"] : null;
  const runs = surfaces ? payload.report.runs.filter((run) => surfaces.includes(run.surface)) : payload.report.runs;
  const targetContexts: MentionContext[] = runs.flatMap((run) =>
    run.mentions.filter((mention) => mention.isTarget).map((mention) => ({ mention, answer: run.rawAnswer, surface: run.surface, companyName: payload.company.name }))
  );
  const targetScore = averageSentiment(targetContexts.map((context) => context.mention));
  const competitorContexts: MentionContext[] = runs.flatMap((run) =>
    run.mentions.filter((mention) => !mention.isTarget).map((mention) => ({ mention, answer: run.rawAnswer, surface: run.surface, companyName: payload.company.name }))
  );

  const working = phraseRows(targetContexts, positiveThemeMap(), "positive");
  const hurting = phraseRows(targetContexts, negativeThemeMap(), "negative")
    .sort((a, b) => b.count - a.count || Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 6);

  const topCompetitors = payload.summary.competitorCounts.slice(0, 3).map((row) => row.name);
  const competitorThemes = topCompetitors.map((name) => {
    const contexts = competitorContexts.filter((context) => canonicalCompanyName(context.mention.companyName) === canonicalCompanyName(name));
    return {
      name,
      mentions: contexts.length,
      themes: phraseRows(contexts, positiveThemeMap(), "positive").slice(0, 4).map((row) => ({ phrase: row.phrase, count: row.count, quotes: row.quotes }))
    };
  });

  const label = targetScore >= 0.35 ? "Positive" : targetScore <= -0.2 ? "Negative" : targetScore > 0 ? "Mildly positive" : "Neutral";

  return { score: targetScore, label, working, hurting, competitorThemes };
}

function phraseRows(contexts: MentionContext[], themeMap: Array<{ phrase: string; patterns: RegExp[]; score: number }>, fallbackSentiment: "positive" | "negative"): ThemeRow[] {
  const rows = new Map<string, { count: number; score: number; quotes: string[] }>();
  for (const theme of themeMap) {
    const matching = contexts.filter((context) => textForTheme(context).some((text) => theme.patterns.some((pattern) => pattern.test(text))));
    if (!matching.length) continue;
    rows.set(theme.phrase, { count: matching.length, score: theme.score, quotes: uniqueStrings(matching.flatMap((context) => quoteSnippets(context, theme.patterns))).slice(0, 3) });
  }
  if (!rows.size && contexts.length && fallbackSentiment === "positive") {
    rows.set("mentioned as a recommended provider", {
      count: contexts.length,
      score: 0.5,
      quotes: uniqueStrings(contexts.flatMap((context) => quoteSnippets(context, [/recommend/gi, /provider/gi, /company/gi]))).slice(0, 3)
    });
  }
  return Array.from(rows.entries())
    .map(([phrase, row]) => ({ phrase, count: row.count, score: row.score, quotes: row.quotes }))
    .sort((a, b) => b.count - a.count || Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 6);
}

function textForTheme(context: MentionContext) {
  return [`${context.mention.companyName} ${context.mention.summary}`, context.answer];
}

function quoteSnippets(context: MentionContext, patterns: RegExp[]) {
  const sentences = context.answer
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.filter((sentence) => patterns.some((pattern) => pattern.test(sentence))).map((sentence) => clampWords(sentence, 24));
}

function clampWords(value: string, limit: number) {
  const words = value.replace(/^[-*#\d.\s]+/, "").split(/\s+/).filter(Boolean);
  return words.length > limit ? `${words.slice(0, limit).join(" ")}...` : words.join(" ");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function positiveThemeMap() {
  return [
    { phrase: "strong local reputation", patterns: [/reputation/gi, /well[- ]known/gi, /established/gi], score: 0.82 },
    { phrase: "high review volume", patterns: [/review/gi, /rating/gi, /rated/gi], score: 0.78 },
    { phrase: "emergency availability", patterns: [/24\/7/gi, /emergency/gi, /same[- ]day/gi], score: 0.74 },
    { phrase: "broad home services", patterns: [/plumbing/gi, /electric/gi, /comprehensive/gi], score: 0.68 },
    { phrase: "professional technicians", patterns: [/professional/gi, /certified/gi, /licensed/gi, /technician/gi], score: 0.72 },
    { phrase: "financing or value options", patterns: [/financ/gi, /coupon/gi, /discount/gi, /value/gi], score: 0.56 }
  ];
}

function negativeThemeMap() {
  return [
    { phrase: "weaker review footprint", patterns: [/fewer reviews/gi, /review footprint/gi, /limited reviews/gi], score: -0.5 },
    { phrase: "limited service area", patterns: [/limited service area/gi, /service area/gi], score: -0.44 },
    { phrase: "premium pricing", patterns: [/premium/gi, /expensive/gi, /pricing/gi], score: -0.32 },
    { phrase: "not always top ranked", patterns: [/not ranked/gi, /missing/gi, /not mentioned/gi], score: -0.58 }
  ];
}

function averageSentiment(mentions: CompanyMention[]) {
  if (!mentions.length) return 0;
  const values = mentions.map((mention) => (mention.sentiment === "positive" ? 0.65 : mention.sentiment === "negative" ? -0.65 : 0.1));
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/* ── citation domain classification ── */
// Manually-maintained domain aliases: sites that redirect to / are the same
// business as a primary domain, so AI citations to them count as that company's
// own site (merged + classified as Owned).
const DOMAIN_ALIASES: Record<string, string> = {
  "callalltech.com": "alltechservicesinc.com" // AllTech — callalltech.com redirects to their site
};
function aliasDomain(domain: string) {
  return domain ? DOMAIN_ALIASES[domain] ?? domain : domain;
}

function displayCitationDomain(citation: Citation) {
  const domain = aliasDomain(domainFromValue(citation.domain || citation.url));
  if (domain && !isInfrastructureDomain(domain)) return domain;
  const titleDomain = aliasDomain(domainFromValue(citation.title));
  return titleDomain && looksLikeDomain(titleDomain) && !isInfrastructureDomain(titleDomain) ? titleDomain : "";
}

function citationUrl(citation: Citation) {
  const domain = domainFromValue(citation.url);
  if (!domain || isInfrastructureDomain(domain)) return "";
  return citation.url || `https://${domain}`;
}

function citationTitle(citation: Citation, domain: string) {
  const title = citation.title.trim();
  if (!title || looksLikeDomain(domainFromValue(title))) return domain;
  return title.length > 96 ? `${title.slice(0, 95)}...` : title;
}

function domainFromValue(value: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
  }
}

function looksLikeDomain(value: string) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value);
}

function isInfrastructureDomain(domain: string) {
  return ["vertexaisearch.cloud.google.com", "google-maps-place", "maps.google.com", "google.com"].includes(domain);
}

function classifyCitationDomain(domain: string, ownedDomain: string, types?: Record<string, string>): SourceType {
  if (domain === ownedDomain) return "Owned";
  // Prefer the audit-time classification (learned + AI), keyed by normalized domain.
  const kind = types?.[domain.toLowerCase().replace(/^www\./, "")];
  if (kind === "platform") return "Platform";
  if (kind === "contractor") return "Competitor";
  if (kind === "manufacturer" || kind === "other") return "Others";
  // Legacy fallback for reports created before domain typing existed.
  if (isOtherCitationDomain(domain)) return "Others";
  if (isPlatformDomain(domain)) return "Platform";
  return "Competitor";
}

function isPlatformDomain(domain: string) {
  return (
    [
      "angi.com",
      "bbb.org",
      "bestpickreports.com",
      "consumeraffairs.com",
      "diamondcertified.org",
      "bobvila.com",
      "consumerreports.org",
      "expertise.com",
      "facebook.com",
      "forbes.com",
      "google.com",
      "homeadvisor.com",
      "houzz.com",
      "mapquest.com",
      "maps.google.com",
      "nextdoor.com",
      "quora.com",
      "reddit.com",
      "thisoldhouse.com",
      "thumbtack.com",
      "todayshomeowner.com",
      "tomsguide.com",
      "yelp.com",
      "youtube.com"
    ].includes(domain) ||
    domain.endsWith(".gov") ||
    domain.endsWith(".edu")
  );
}

function isOtherCitationDomain(domain: string) {
  return [
    "americanstandardair.com",
    "aprilaire.com",
    "bryant.com",
    "carrier.com",
    "daikincomfort.com",
    "energystar.gov",
    "goodmanmfg.com",
    "lennox.com",
    "mitsubishicomfort.com",
    "navieninc.com",
    "rheem.com",
    "ruud.com",
    "trane.com",
    "york.com",
    "company-site.com"
  ].includes(domain);
}

function canonicalCompanyName(name: string) {
  const stopwords = new Set(["air", "and", "the", "hvac", "heat", "heating", "cooling", "conditioning", "plumbing", "electric", "electrical", "services", "service", "company", "home", "homes", "inc", "llc"]);
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3 && !stopwords.has(token));
  return tokens.join("") || name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* ── formatting ── */
function targetRank(run?: SurfaceRun) {
  return run?.mentions.find((mention) => mention.isTarget)?.rank ?? null;
}

function averageNumber(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function priorityValue(priority: Query["priority"]) {
  return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

function primaryLocation(company?: Company) {
  return company?.locations.find((location) => location.isPrimary)?.label ?? company?.locations[0]?.label;
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function signed(value: number) {
  const rounded = value.toFixed(2);
  return value > 0 ? `+${rounded}` : rounded;
}

function band(value: number, hi: number, md: number) {
  return value >= hi ? "High" : value >= md ? "Medium" : "Low";
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function shortSurface(surface: string) {
  if (surface === "gemini_maps" || surface === "gemini_search" || surface === "gemini") return "Google";
  if (surface === "chatgpt_search" || surface === "chatgpt") return "ChatGPT";
  return surface;
}

// What each engine bases its answer on — surfaced in the insight card so clients
// understand e.g. ChatGPT's "few reviews" reflects the open web, not Google reviews.
function surfaceSource(surface: string): { label: string; basis: string } {
  if (surface === "chatgpt_search") return { label: "ChatGPT", basis: "from open-web search & cited pages" };
  if (surface === "gemini_maps") return { label: "Google", basis: "from Google Maps & local reviews" };
  if (surface === "gemini_search") return { label: "Google", basis: "from Google web search" };
  return { label: shortSurface(surface), basis: "" };
}

// The provider answers come back as a short intro line plus dash/asterisk bullets
// (ChatGPT uses "- ", Gemini uses "*   **label:** …"). Split them into a lead
// sentence + clean bullet list so the panel reads well instead of as a wall of text.
function parseInsight(raw: string): { intro: string; bullets: string[] } {
  const text = (raw || "").trim();
  if (!text) return { intro: "", bullets: [] };
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const intro: string[] = [];
  const bullets: string[] = [];
  for (const line of lines) {
    const match = line.match(/^[*\-•]\s+(.*)$/);
    if (match) {
      bullets.push(match[1].trim());
    } else if (bullets.length === 0) {
      intro.push(line);
    } else {
      bullets[bullets.length - 1] += " " + line;
    }
  }
  // No bullets detected — treat the whole thing as one paragraph.
  if (!bullets.length) return { intro: intro.join(" "), bullets: [] };
  return { intro: intro.join(" "), bullets };
}

// Render inline **bold** markdown segments (used for Gemini's "**label:**" lead-ins).
function renderRich(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((segment, index) => {
    const bold = segment.match(/^\*\*([^*]+)\*\*$/);
    return bold ? <strong key={index}>{bold[1]}</strong> : <span key={index}>{segment}</span>;
  });
}


function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function formatRunDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Snapshot access window: report stays viewable for ACCESS_WINDOW_DAYS after the run.
const ACCESS_WINDOW_DAYS = 30;
function accessDaysLeft(completedAt: string, windowDays = ACCESS_WINDOW_DAYS) {
  const expiresAt = new Date(completedAt).getTime() + windowDays * 86_400_000;
  return Math.ceil((expiresAt - Date.now()) / 86_400_000);
}

/* ── account/report selection ── */
type CompanyReportOption = { companyId: string; companyName: string; location: string; reportId: string; status: Report["status"]; createdAt: string };

function buildCompanyReportOptions(companies: Company[], reports: Report[]): CompanyReportOption[] {
  return companies
    .map((company) => {
      const companyReports = reports.filter((report) => report.companyId === company.id);
      const report = selectPreferredReport(companyReports);
      if (!report) return null;
      return { companyId: company.id, companyName: company.name, location: primaryLocation(company) ?? "No location", reportId: report.id, status: report.status, createdAt: report.createdAt };
    })
    .filter((option): option is CompanyReportOption => Boolean(option))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function selectPreferredReport(reports: Report[]) {
  return [...reports].sort((a, b) => {
    const aComplete = a.status === "complete" ? 1 : 0;
    const bComplete = b.status === "complete" ? 1 : 0;
    if (aComplete !== bComplete) return bComplete - aComplete;
    const aRuns = a.runCount ?? a.runs.length;
    const bRuns = b.runCount ?? b.runs.length;
    if (aRuns !== bRuns) return bRuns - aRuns;
    if (a.queries.length !== b.queries.length) return b.queries.length - a.queries.length;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
}
