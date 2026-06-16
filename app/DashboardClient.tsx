"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { HVAC_SERVICES } from "@/lib/constants";
import { runCitations } from "@/lib/citations";
import OnboardingTour from "./OnboardingTour";
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
type SurfaceFilter = "all" | "gemini" | "google" | "chatgpt";
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
// Google Maps (local pack) is collected but EXCLUDED from the customer-facing
// report: it measures local-SEO/proximity ranking, not "do AI assistants
// recommend you" (AI visibility). The two scored surfaces are the AI answers —
// Google's Search-grounded answer (AI Overview / Gemini) and ChatGPT. The
// gemini_maps runs stay in the payload (reversible) but feed no score or display.
const customerSurfaces = ["gemini_search", "google_ai_overview", "chatgpt_search"] as const;

// When the data APIs answer 401 (gate is on and we have no valid cookie), send the
// visitor to the sign-in page, preserving which report they were trying to open.
function redirectToAccess() {
  if (typeof window === "undefined") return;
  const id = new URLSearchParams(window.location.search).get("report");
  window.location.href = "/access" + (id ? `?report=${encodeURIComponent(id)}` : "");
}

// No-login share URLs look like `/?report=<id>&t=<token>`. Forward that token on the
// read API calls so the report + dropdowns resolve without a cookie or redirect.
function withToken(path: string): string {
  if (typeof window === "undefined") return path;
  const t = new URLSearchParams(window.location.search).get("t");
  return t ? path + (path.includes("?") ? "&" : "?") + "t=" + encodeURIComponent(t) : path;
}
// The three customer-facing engines, each = its own AI answer surface. Google Gemini
// (Search-grounded) and Google AI Mode are distinct Google products; ChatGPT is its own
// engine. The Maps local pack is excluded — it's local SEO, not AI visibility.
const ENGINE_SURFACES = {
  gemini: ["gemini_search"],
  google: ["google_ai_overview"],
  chatgpt: ["chatgpt_search"]
} as const;
// Overall AI Visibility Score weighting (by importance, NOT raw run count, so winning one
// engine can't dominate). When an engine has no runs in a report (e.g. AI Mode not yet
// collected), it's dropped and the remaining weights are renormalized.
const ENGINE_WEIGHTS: Record<string, number> = { gemini: 0.4, google: 0.3, chatgpt: 0.3 };
// Display order + labels for every scored engine, used by toggles, by-platform bars,
// the leaderboard and the citation columns.
const ENGINES = [
  { key: "gemini" as const, label: "Google Gemini", surfaces: ENGINE_SURFACES.gemini },
  { key: "google" as const, label: "Google AI Mode", surfaces: ENGINE_SURFACES.google },
  { key: "chatgpt" as const, label: "ChatGPT", surfaces: ENGINE_SURFACES.chatgpt }
];
// Engines that actually have runs in this report (so Google AI Mode appears only where
// google_ai_overview data exists — no dead columns/toggles elsewhere).
function enginesPresent(payload: ReportPayload) {
  return ENGINES.filter((e) => payload.report.runs.some((r) => (e.surfaces as readonly string[]).includes(r.surface)));
}
function engineFilterOptions(payload: ReportPayload): Array<[SurfaceFilter, string]> {
  return [["all", "All"], ...enginesPresent(payload).map((e) => [e.key, e.label] as [SurfaceFilter, string])];
}
function surfacesForFilter(filter: SurfaceFilter): readonly string[] {
  if (filter === "gemini") return ENGINE_SURFACES.gemini;
  if (filter === "google") return ENGINE_SURFACES.google;
  if (filter === "chatgpt") return ENGINE_SURFACES.chatgpt;
  return customerSurfaces;
}

// Shared platform toggle (All / Google Gemini / Google AI Mode / ChatGPT). Pass the
// report payload so only engines with data show; or pass explicit `options`.
function EngineToggle({ payload, options, value, onChange }: { payload?: ReportPayload; options?: Array<[SurfaceFilter, string]>; value: SurfaceFilter; onChange: (next: SurfaceFilter) => void }) {
  const opts = options ?? (payload ? engineFilterOptions(payload) : ENGINES.map((e) => [e.key, e.label] as [SurfaceFilter, string]));
  return (
    <div className="segmented">
      {opts.map(([key, label]) => (
        <button key={key} className={value === key ? "active" : ""} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}

type IntentFilter = "all" | "primary" | "secondary";

// Labeled single-select dropdown (Platform / Type / Prompt Intent on the citations table).
// One value at a time; the menu marks the active option with a check and closes on outside click.
function FilterSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<readonly [T, string]>; onChange: (next: T) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const current = options.find(([key]) => key === value)?.[1] ?? "";
  return (
    <div className={"filter-select" + (open ? " open" : "")} ref={ref}>
      <button type="button" className="fs-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="fs-label">{label}</span>
        <span className="fs-value">{current}</span>
        <Icon name="chevdown" size={14} />
      </button>
      {open ? (
        <div className="fs-menu" role="listbox">
          {options.map(([key, lbl]) => (
            <button key={key} type="button" role="option" aria-selected={key === value} className={"fs-option" + (key === value ? " selected" : "")} onClick={() => { onChange(key); setOpen(false); }}>
              <span className="fs-check">{key === value ? <Icon name="check" size={15} /> : null}</span>
              {lbl}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

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
  check: "M20 6L9 17l-5-5",
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
  // Session cache of fetched report payloads — switching back to a market is instant,
  // and we prefetch the account's other markets so the first switch is instant too.
  const reportCache = useRef<Map<string, ReportPayload>>(new Map());
  // Onboarding tour — live for everyone: auto-runs once on first desktop visit, then the
  // help FAB stays (mobile shows the FAB only). ?tour=1 force-restarts it (for QA).
  const [tourOn, setTourOn] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).has("tour")) {
      localStorage.removeItem("netic_aivt_tour_done");
      localStorage.removeItem("netic_aivt_tour_step");
    }
  }, []);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLink, setShareLink] = useState("");
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

  // The active brand's reports form a (service area × vertical) matrix — each cell is one
  // report. The two sidebar dropdowns navigate it: Service Area picks the row, Vertical
  // picks the column, each loading a different report rather than filtering in place.
  const activeArea = primaryLocation(activeReport?.company) ?? "—";
  const activeVertical = activeReport?.report.vertical ?? "HVAC";

  const brandMatrix = useMemo(() => {
    const active = activeReport?.company;
    const empty = { areas: [] as string[], byKey: new Map<string, { reportId: string; status: Report["status"]; runs: number; createdAt: string }>() };
    if (!active) return empty;
    const brand = canonicalCompanyName(active.name);
    const byId = new Map(companies.map((item) => [item.id, item]));
    const activeId = activeReport?.report.id;
    const areas: string[] = [];
    const byKey = new Map<string, { reportId: string; status: Report["status"]; runs: number; createdAt: string }>();
    for (const report of reports) {
      const owner = byId.get(report.companyId);
      if (!owner || canonicalCompanyName(owner.name) !== brand) continue;
      const area = primaryLocation(owner) ?? "—";
      const vertical = report.vertical ?? "HVAC";
      if (!areas.includes(area)) areas.push(area);
      const key = area + "||" + vertical;
      const prev = byKey.get(key);
      if (prev && prev.reportId === activeId) continue; // active report already owns this cell
      const runs = (report as Report & { runCount?: number }).runCount ?? report.runs?.length ?? 0;
      const better =
        report.id === activeId ||
        !prev ||
        (report.status === "complete" && prev.status !== "complete") ||
        (report.status === prev.status && (runs > prev.runs || (runs === prev.runs && report.createdAt > prev.createdAt)));
      if (better) byKey.set(key, { reportId: report.id, status: report.status, runs, createdAt: report.createdAt });
    }
    return { areas, byKey };
  }, [activeReport?.company, activeReport?.report.id, companies, reports]);

  // Service areas — one row per market, pointing at the current vertical's report (falling
  // back to HVAC / whatever vertical that market has). The active market leads the list.
  const serviceAreaOptions = useMemo(() => {
    const { areas, byKey } = brandMatrix;
    const pick = (area: string) =>
      byKey.get(area + "||" + activeVertical)?.reportId ??
      byKey.get(area + "||HVAC")?.reportId ??
      [...byKey.entries()].find(([k]) => k.startsWith(area + "||"))?.[1].reportId;
    return areas
      .map((area) => ({ area, reportId: pick(area) }))
      .filter((o): o is { area: string; reportId: string } => Boolean(o.reportId))
      .sort((a, b) => {
        if (a.reportId === activeReport?.report.id) return -1;
        if (b.reportId === activeReport?.report.id) return 1;
        return a.area.localeCompare(b.area);
      });
  }, [brandMatrix, activeVertical, activeReport?.report.id]);

  // Verticals available in the CURRENT market; selecting one loads that report. HVAC leads.
  const verticalOptions = useMemo(() => {
    const opts: Array<{ vertical: string; reportId: string }> = [];
    for (const [key, cell] of brandMatrix.byKey.entries()) {
      const sep = key.indexOf("||");
      if (key.slice(0, sep) === activeArea) opts.push({ vertical: key.slice(sep + 2), reportId: cell.reportId });
    }
    return opts.sort((a, b) => (a.vertical === "HVAC" ? -1 : b.vertical === "HVAC" ? 1 : a.vertical.localeCompare(b.vertical)));
  }, [brandMatrix, activeArea]);

  // Prefetch the account's other markets into the cache (background, fire-and-forget) so
  // the first switch to any sibling is instant. Browsers cap concurrent fetches, so this
  // self-throttles. Skips anything already cached.
  useEffect(() => {
    const ids = new Set([...serviceAreaOptions.map((o) => o.reportId), ...verticalOptions.map((o) => o.reportId)]);
    for (const reportId of ids) {
      if (reportCache.current.has(reportId)) continue;
      fetch(withToken(`/api/reports/${reportId}`))
        .then((r) => (r.ok ? r.json() : null))
        .then((p: ReportPayload | null) => {
          if (p?.report?.queries && p.company) reportCache.current.set(reportId, p);
        })
        .catch(() => {});
    }
  }, [serviceAreaOptions, verticalOptions]);

  // Load a sibling report (different market or vertical) and sync the ?report= URL — shared
  // by both the Service Area and Vertical dropdowns.
  async function goToReport(reportId: string) {
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
    const [companyResponse, reportResponse] = await Promise.all([fetch(withToken("/api/companies")), fetch(withToken("/api/reports"))]);
    if (companyResponse.status === 401 || reportResponse.status === 401) {
      redirectToAccess();
      return;
    }
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
    const cached = reportCache.current.get(reportId);
    if (cached) {
      // Already fetched (or prefetched) this session — instant, no network, no spinner.
      setActiveReport(cached);
      setSelectedCompanyId(cached.company.id);
      return;
    }
    setLoadingReport(true);
    try {
      const response = await fetch(withToken(`/api/reports/${reportId}`));
      if (response.status === 401) {
        redirectToAccess();
        return;
      }
      const payload = (await response.json()) as ReportPayload;
      if (!response.ok || !payload.report?.queries || !payload.company) {
        console.error("Invalid report payload", payload);
        return;
      }
      reportCache.current.set(reportId, payload);
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

  // Pre-fetch a no-login magic view link when the Share menu opens, so Copy / Gmail are instant.
  async function fetchShareLink(reportId: string) {
    try {
      const res = await fetch(`/api/reports/${reportId}/share-link`);
      const data = (await res.json()) as { url?: string };
      if (data.url) setShareLink(data.url);
    } catch {}
  }

  function copyShareLink() {
    if (!activeReport) return;
    const url = shareLink || `${window.location.origin}/?report=${activeReport.report.id}`;
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
    const url = shareLink || `${window.location.origin}/?report=${activeReport.report.id}`;
    const subject = `AI visibility audit for ${activeReport.company.name}`;
    const body = `Here is the AI visibility audit for ${activeReport.company.name} — just open the link to view it (no sign-in needed):\n\n${url}`;
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
                  onChange={(event) => goToReport(event.target.value)}
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
              <label htmlFor="vertical">Vertical</label>
              <div className="sel">
                <select
                  id="vertical"
                  value={activeReport?.report.id ?? ""}
                  onChange={(event) => goToReport(event.target.value)}
                  disabled={verticalOptions.length <= 1}
                >
                  {verticalOptions.map((option) => (
                    <option key={option.reportId} value={option.reportId}>
                      {option.vertical}
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
              <Navi icon="prompts" active={view === "prompts"} count={total} onClick={() => goView("prompts")} dataTour="nav-prompts">
                Prompts
              </Navi>
              <Navi icon="citations" active={view === "citations"} onClick={() => goView("citations")} dataTour="nav-citations">
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
                        <button className="btn" onClick={() => { const opening = !shareMenuOpen; setShareMenuOpen(opening); if (opening) fetchShareLink(activeReport.report.id); }}>
                          <Icon name={shareCopied ? "copy" : "share"} size={13} />
                          {shareCopied ? "Copied" : "Share report"}
                          <Icon name="chevdown" size={12} />
                        </button>
                        {shareMenuOpen ? (
                          <div className="share-menu">
                            <button onClick={() => { copyShareLink(); setShareMenuOpen(false); }}>
                              <Icon name="copy" size={14} /> Copy view link
                            </button>
                            <button onClick={() => { openEmailDraft(); setShareMenuOpen(false); }}>
                              <Icon name="mail" size={14} /> Email via Gmail
                            </button>
                            <button onClick={downloadPdf}>
                              <Icon name="download" size={14} /> Download PDF
                            </button>
                          </div>
                        ) : null}
                      </div>
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
      {tourOn ? <OnboardingTour ready={!!activeReport} view={view} setView={(v) => setView(v as View)} /> : null}
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
  engineRates: { label: string; rate: number }[];
  sov: number;
  sovRank: number;
  sovCount: number;
  topRival?: string;
  topDirectories: string[];
  distinctOwned: number;
  weakestCategory?: { category: string; rate: number };
}): Advice {
  const { score100, gband, visRank, total, engineRates, sov, sovRank, sovCount, topRival, topDirectories, distinctOwned, weakestCategory } = input;
  const insights: Advice["insights"] = [];
  const improvements: Advice["improvements"] = [];
  const rankStr = visRank === 1 ? ` — #1 of ${total} in your market` : visRank > 0 && total > 0 ? ` (#${visRank} of ${total})` : "";
  // Per-engine visibility spread (all present engines, e.g. Gemini / AI Mode / ChatGPT).
  const ePcts = engineRates.map((e) => ({ label: e.label, pct: Math.round(e.rate * 100) }));
  const maxP = Math.max(0, ...ePcts.map((e) => e.pct));
  const minP = Math.min(...ePcts.map((e) => e.pct), maxP);
  // "Uneven" = a real gap: ≥10pts absolute, OR one engine ≥2× another with ≥4pt gap
  // (so 5% vs 15% reads as uneven, not "consistent").
  const imbalanced = ePcts.length > 1 && (maxP - minP >= 10 || (minP > 0 && maxP >= 2 * minP && maxP - minP >= 4));

  // ── Insights (left): the situation as we found it; always populated. ──
  insights.push({
    tone: gband === "High" ? "good" : gband === "Low" ? "warn" : "neutral",
    lead: `${gband === "High" ? "Strong" : gband === "Medium" ? "Moderate" : "Limited"} overall AI visibility (${score100}%)`,
    body: `AI recommends you ${gband === "High" ? "frequently" : gband === "Medium" ? "selectively" : "rarely"}${rankStr}.`
  });
  if (maxP > 0) {
    const body = ePcts.map((e) => `${e.pct}% ${e.label}`).join(" · ");
    // Tone reflects reality: a gap is a warning; "even" is only GOOD when overall visibility
    // is actually strong — even-but-low stays neutral (never green on a low score).
    insights.push(
      imbalanced
        ? { tone: "warn", lead: "Uneven across engines", body: `${body} — recommendation rates differ sharply.` }
        : gband === "High"
          ? { tone: "good", lead: "Consistently strong across engines", body }
          : { tone: gband === "Low" ? "warn" : "neutral", lead: "Even across engines, but low overall", body }
    );
  }
  if (sovCount > 0) {
    insights.push({
      tone: sov >= 0.1 ? "good" : sov >= 0.05 ? "neutral" : "warn",
      lead: `Share of voice ${pct(sov)}${sovRank > 0 ? ` (#${sovRank} of ${sovCount})` : ""}`,
      body: `Of every company mention AI makes in your market, this is the slice that names you.`
    });
  }

  // ── Improvements (right): the actions to take. ──
  if (imbalanced && ePcts.length) {
    const weak = ePcts.reduce((a, b) => (b.pct < a.pct ? b : a)).label;
    improvements.push({
      lead: `Close the ${weak} gap`,
      body: `${weak} recommends you far less than your strongest engine — it pulls from a different source mix.`,
      action: { text: "Compare citation sources for gaps vs competitors", nav: "citations" }
    });
  }

  // Who leads
  if (visRank > 1 && topRival) {
    improvements.push({
      lead: `${topRival} leads your market`,
      body: `The most-recommended company to displace.`,
      action: { text: "See the prompts and sources they win", nav: "prompts" }
    });
  }

  // Directories AI trusts most
  if (topDirectories.length) {
    improvements.push({
      lead: "Key directories AI trusts",
      body: `${topDirectories.join(", ")}.`,
      action: { text: "Evaluate which of these platforms you can build a presence on", nav: "citations" }
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
  // Headline score, by-platform, and competitor leaderboards run on PRIMARY (high-intent)
  // prompts only; the prompt breakdown + citations stay on all prompts (full `payload`).
  const primaryPayload = useMemo(() => primaryPayloadOf(payload), [payload]);
  const leaderboard = useMemo(() => buildLeaderboardData(primaryPayload), [primaryPayload]);
  const citationStats = useMemo(() => buildCitationStats(payload), [payload]);
  const citRank = useMemo(() => buildCitationStats(payload, citFilter), [payload, citFilter]);

  // Overall gauge = the 70/30 Gemini/ChatGPT blend (see blendedVisibilityForName),
  // computed on primary prompts — matches this company's value in the leaderboard.
  const score100 = Math.round(blendedVisibilityForName(primaryPayload, payload.company.name, true) * 100);
  // Official Visibility Score bands (backend): 30%+ High, 20–30% Medium, <20% Low.
  const gband = score100 >= 30 ? "High" : score100 >= 20 ? "Medium" : "Low";

  // By-platform uses the SAME composite Visibility Score as the leaderboard (one
  // definition everywhere), grouped by engine — only the engines present in this report,
  // on primary prompts so the bars match the gauge.
  const surfaceShow = enginesPresent(primaryPayload).map((engine) => ({
    surface: engine.key,
    label: engine.label,
    rate: visibilityMetricsForName(primaryPayload, mentionShareRuns(primaryPayload.report.runs, engine.key), payload.company.name, true).visibility
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
  const engineRates = surfaceShow.map((item) => ({ label: item.label, rate: item.rate }));
  const visRanked = [...lb].sort((a, b) => (b.visibilityScore ?? b.visibilityRate) - (a.visibilityScore ?? a.visibilityRate));
  const visRank = visRanked.findIndex((row) => row.isTarget) + 1;
  const topRival = visRanked.find((row) => !row.isTarget)?.name;
  const weakestCategory = [...stats.categoryCoverage].sort((a, b) => a.rate - b.rate)[0];
  const topDirectories = citationStats.domainRows.filter((row) => row.type === "Platform").slice(0, 3).map((row) => row.domain);
  const distinctOwned = new Set(
    citationStats.domainDetails.filter((domain) => domain.owned).flatMap((domain) => (domain.urls || []).map((url) => url.url))
  ).size;
  const advice = buildHomeAdvice({ score100, gband, visRank, total: lb.length, engineRates, sov, sovRank, sovCount, topRival, topDirectories, distinctOwned, weakestCategory });
  const VISIBLE_IMPROVEMENTS = 3;
  const canCollapse = advice.improvements.length > VISIBLE_IMPROVEMENTS;
  const shownImprovements = canCollapse && !advExpanded ? advice.improvements.slice(0, VISIBLE_IMPROVEMENTS) : advice.improvements;

  return (
    <div className="view-stack">
      <p className="page-note">
        {primaryLocation(payload.company)} visibility across {stats.totalQueries} HVAC prompts and {surfaceShow.length} AI engines ({surfaceShow.map((s) => s.label).join(", ")}).
      </p>
      <p className="bench-note">
        Directional reference only. AI results vary by each query, so this won&apos;t match exactly what every consumer sees.
      </p>

      {advice.insights.length || advice.improvements.length ? (
        <div className="panel key-insights" data-tour="insights">
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
              <span className="ins-sub">Actions</span>
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

      <div className="panel score-panel" data-tour="score">
        <PanelHead
          title="AI Visibility Score"
          subtitle="How often does AI recommend you overall?"
          tooltip="How visible your company is to AI — how often it recommends you, and how high up you appear, when people ask it for help choosing a provider. The overall score weights Google Gemini at 40%, Google AI Mode at 30%, and ChatGPT at 30% — Google surfaces make up 70% since Google drives most local home-service discovery today. Higher is better: 30%+ is High, 20–30% is Medium, under 20% is Low."
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
            <p className="gauge-cap">{primaryPayload.report.runs.length.toLocaleString()} queries run across {primaryPayload.report.queries.length} high-intent prompts</p>
            <p className="gauge-cap">{surfaceShow.length >= 3 ? "Weighted toward Google Gemini, then Google AI Mode and ChatGPT (40 / 30 / 30)." : "Weighted more toward Google Gemini than ChatGPT for the overall score."}</p>
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

      <section className="dashboard-grid" data-tour="leaderboard">
        <Leaderboard title="Visibility Score" subtitle="How visible are you in AI search overall?" data={leaderboard} filter={visFilter} setFilter={setVisFilter} mode="vis" limit={6} onMore={() => onNav("competitors")} moreLabel="See all competitors" />
        <Leaderboard title="Share of Voice" subtitle="When a brand gets mentioned, how often is it you?" data={leaderboard} filter={sovFilter} setFilter={setSovFilter} mode="sov" limit={6} onMore={() => onNav("competitors")} moreLabel="See all competitors" />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <PanelHead
            title="Citation Sources"
            subtitle="Which websites does AI rely on to answer?"
            right={
              <EngineToggle payload={payload} value={citFilter} onChange={setCitFilter} />
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
  const [cat, setCat] = useState("All");
  const [expanded, setExpanded] = useState("");

  // Per-engine rank columns — only the engines present in this report (Google AI Mode
  // appears only where AI Mode data exists). Grid widths set inline to match.
  const engines = useMemo(() => enginesPresent(payload), [payload]);
  const promptCols = `minmax(0,1fr) 106px${engines.map(() => " 60px").join("")} 112px`;

  const summary = payload.summary;
  const topOneRate = topOneRateOf(payload);
  // Top Competitor reflects PRIMARY (high-intent) prompts, matching the headline metrics.
  const primaryPayload = useMemo(() => primaryPayloadOf(payload), [payload]);
  const topCompetitor = useMemo(() => {
    const customerRuns = primaryPayload.report.runs.filter((r) => customerSurfaces.includes(r.surface as (typeof customerSurfaces)[number]));
    return buildMentionShareRows(primaryPayload, customerRuns).find((row) => !row.isTarget);
  }, [primaryPayload]);

  const visible = useMemo(() => {
    return stats.promptRows.filter((row) => cat === "All" || displayCategory(row.query) === cat);
  }, [cat, stats.promptRows]);

  // Auto-expand the first row ONCE, on initial load (the default "All" view). After that,
  // changing the category filter (or switching back to All) collapses everything so the
  // list is easy to scroll — it does not re-expand.
  const didAutoExpand = useRef(false);
  useEffect(() => {
    if (!didAutoExpand.current && visible.length) {
      setExpanded(visible[0].query.id);
      didAutoExpand.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  useEffect(() => {
    if (didAutoExpand.current) setExpanded("");
  }, [cat]);

  return (
    <div className="view-stack">
      <section className="metric-grid five">
        <MetricCard label="Total Prompts" value={String(stats.totalQueries)} helper={`${payload.report.runs.length} AI checks`} />
        <MetricCard label="You Rank In" value={String(stats.mentionedQueries)} helper="prompts with a mention" />
        <MetricCard label="Missing" value={String(stats.missingQueries)} helper="not ranked anywhere" />
        <MetricCard label="#1 Position %" value={pct(topOneRate)} helper="ranked #1" />
        <MetricCard label="Top Competitor" value={topCompetitor ? topCompetitor.name : "—"} valueSm helper={topCompetitor ? pct(topCompetitor.visibilityRate) + " visibility" : ""} />
      </section>

      <div data-tour="coverage"><CategoryCoveragePanel payload={payload} /></div>

      <section className="panel">
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
          <div className="prompt-head" style={{ gridTemplateColumns: promptCols }}>
            <span>Prompt</span>
            <span>Intent</span>
            {engines.map((engine) => (
              <span key={engine.key} className="cell-center">{engine.label}</span>
            ))}
            <span>#1 competitor</span>
          </div>
          {([
            { header: "Primary high-intent prompts", primary: true },
            { header: "Secondary prompts", primary: false }
          ] as const).map((tier) => {
            const tierRows = visible.filter((row) => isPrimaryCategory(row.query.category) === tier.primary);
            if (!tierRows.length) return null;
            return (
              <div key={tier.header} className="prompt-tier">
                <div className={"prompt-tier-head " + (tier.primary ? "primary" : "secondary")}>
                  <span className={"tier-tag " + (tier.primary ? "primary" : "secondary")}>{tier.primary ? "Primary" : "Secondary"}</span>
                  {tier.header}
                  <span className="tier-count">{tierRows.length}</span>
                </div>
                {tierRows.map((row, ridx) => (
                  <div key={row.query.id} className={"prompt-record" + (expanded === row.query.id ? " open" : "")} data-tour={tier.primary && ridx === 0 ? "prompt-row" : undefined}>
                    <button className="prompt-row" style={{ gridTemplateColumns: promptCols }} data-tour-expand={tier.primary && ridx === 0 ? "" : undefined} onClick={() => setExpanded(expanded === row.query.id ? "" : row.query.id)}>
                      <span className="prompt-text">
                        <i className={"row-chev" + (expanded === row.query.id ? " open" : "")}>›</i>
                        <span className="label">{row.query.text}</span>
                      </span>
                      <span>
                        <Badge>{INTENT_LABELS[row.query.intent] || row.query.intent}</Badge>
                      </span>
                      {engines.map((engine) => (
                        <span key={engine.key} className="cell-center">
                          <EngineRankCell runs={row.runs} surfaces={engine.surfaces} />
                        </span>
                      ))}
                      <span className="comp-name">{row.topCompetitor || "—"}</span>
                    </button>
                    {expanded === row.query.id ? <PromptDetails row={row} /> : null}
                  </div>
                ))}
              </div>
            );
          })}
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
  // Ordered Google Gemini → Google AI Mode → ChatGPT. Each panel shows that engine's AI
  // answer + the web pages it cited (Maps local pack is excluded from the report).
  { key: "gemini", responseSurfaces: ["gemini_search"], citeSurfaces: ["gemini_search"] },
  { key: "google", responseSurfaces: ["google_ai_overview"], citeSurfaces: ["google_ai_overview"] },
  { key: "chatgpt", responseSurfaces: ["chatgpt_search"], citeSurfaces: ["chatgpt_search"] }
] as const;

function PromptDetails({ row }: { row: PromptRow }) {
  // Only show a column for engines that actually answered this prompt.
  const platforms = PROMPT_PLATFORMS.filter((pf) => row.runs.some((r) => (pf.responseSurfaces as readonly string[]).includes(r.surface)));
  return (
    <div className="prompt-details" style={{ gridTemplateColumns: `repeat(${platforms.length || 1}, minmax(0, 1fr))` }}>
      {platforms.map((pf) => {
        const surfaces = pf.responseSurfaces as readonly string[];
        const { ranked, targetRank: consensusRank } = buildConsensus(row.runs, surfaces);
        const inTop5 = Boolean(consensusRank && consensusRank <= 5);
        const responseSurface = pf.responseSurfaces.find((surface) => row.bySurface[surface]) ?? pf.responseSurfaces[0];
        const run = row.bySurface[responseSurface];
        // Show the "why weren't you recommended" follow-up only when missing from the consensus top 5.
        const insightRun = row.runs.find((item) => surfaces.includes(item.surface) && item.missingInsight);
        const insight = !inTop5 && insightRun?.missingInsight ? parseInsight(insightRun.missingInsight.answer) : null;
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
                <span className="pcol-rank">{inTop5 ? `You rank #${consensusRank}` : "You: not ranked"}</span>
              </div>
              <ol>
                {ranked.slice(0, 5).map((company, index) => (
                  <li key={index} className={company.isTarget ? "you" : ""}>
                    {company.name}
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
  const [domType, setDomType] = useState<"all" | SourceType>("all");
  // Toggle now lives ONLY on the "Where AI Gets Its Answers" panel and affects only it.
  const [whereFilter, setWhereFilter] = useState<SurfaceFilter>("all");
  // Everything else (metrics, the domain table) is engine-agnostic; per-engine detail
  // lives in the side-by-side columns of the table below.
  const cit = useMemo(() => buildCitationStats(payload, "all"), [payload]);
  const whereStats = useMemo(() => buildCitationStats(payload, whereFilter), [payload, whereFilter]);

  // Top Cited Domains has its OWN platform toggle (All / Google Gemini / Google AI Mode /
  // ChatGPT), layered with the type toggle. The table shows ONE Citations + ONE Share
  // column, reflecting the selected platform.
  const [tableFilter, setTableFilter] = useState<SurfaceFilter>("all");
  const [intentFilter, setIntentFilter] = useState<IntentFilter>("all");
  const tablePayload = useMemo(() => payloadByIntent(payload, intentFilter), [payload, intentFilter]);
  const tableStats = useMemo(() => buildCitationStats(tablePayload, tableFilter), [tablePayload, tableFilter]);

  // Citation Rate: of the prompts whose answers cite any source, how many cite YOUR site.
  const citRate = useMemo(() => {
    const cited = new Set<string>();
    const owned = new Set<string>();
    cit.domainDetails.forEach((d) => (d.urls || []).forEach((u) => (u.prompts || []).forEach((p) => { cited.add(p); if (d.owned) owned.add(p); })));
    return { owned: owned.size, cited: cited.size, rate: cited.size ? owned.size / cited.size : 0 };
  }, [cit]);

  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "count", dir: "desc" });
  const onSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  const arrow = (key: string) => (sort.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : "");

  // Rows = the selected platform's cited domains, filtered by type, sorted.
  const rows = useMemo(() => {
    const base = domType === "all" ? tableStats.domainDetails : tableStats.domainDetails.filter((row) => row.type === domType);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sort.key === "domain") return a.domain.localeCompare(b.domain) * dir;
      // "citations" and "share" sort identically (share is monotonic in count).
      return (a.count - b.count) * dir || a.domain.localeCompare(b.domain);
    });
  }, [tableStats, domType, sort]);

  const [expanded, setExpanded] = useState("");
  // Auto-expand the first domain ONCE, on initial load (default "All"). Changing the type
  // filter (or switching back to All) collapses everything for easy scrolling — no re-expand.
  const didAutoExpand = useRef(false);
  useEffect(() => {
    if (!didAutoExpand.current && rows.length) {
      setExpanded(rows[0].domain);
      didAutoExpand.current = true;
    }
  }, [rows]);
  useEffect(() => {
    if (didAutoExpand.current) setExpanded("");
  }, [domType, tableFilter, intentFilter]);

  // Domain | Type | Citations | Share — single columns reflecting the selected platform.
  // Domain has a 150px floor so it never collapses into Type on narrow screens.
  const gridCols = `minmax(150px,1fr) 110px 90px 80px`;

  return (
    <div className="view-stack">
      <p className="page-note">
        Citation stats use the sources AI cites as supporting authority. Platform sources are directories, review sites, trust profiles, and editorial lists; competitor sources are other HVAC company websites.
      </p>

      <section className="metric-grid four">
        <MetricCard label="Unique Sources" value={String(cit.uniqueSources)} helper="real citation domains" />
        <MetricCard label="Total Citations" value={String(cit.totalCitations)} helper="counted once per run" />
        <MetricCard label="Citation Rate" value={pct(citRate.rate)} helper={`${citRate.owned}/${citRate.cited} cited answers`} tooltip="Of the prompts whose AI answers cite sources, how often your own website is one of them." />
        <MetricCard label="Platform Source Share" value={pct(cit.platformShare)} helper="directories, reviews, editorial" />
      </section>

      <section className="panel" data-tour="sources">
        <PanelHead
          title="Where AI Gets Its Answers"
          subtitle="Citation volume by source type"
          right={
            <EngineToggle payload={payload} value={whereFilter} onChange={setWhereFilter} />
          }
        />
        <div className="panel-body">
          <div className="coverage">
            {whereStats.typeRows.map((row) => (
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
          subtitle="Filter by platform, type, and prompt intent · click a column to sort · expand a domain for exact pages"
          right={
            <div className="cit-toggles">
              <FilterSelect label="Platform" value={tableFilter} options={engineFilterOptions(payload)} onChange={setTableFilter} />
              <FilterSelect
                label="Type"
                value={domType}
                options={[["all", "All"], ["Competitor", "Competitor"], ["Platform", "Platform"], ["Owned", "Owned"]] as const}
                onChange={setDomType}
              />
              <FilterSelect
                label="Prompt Intent"
                value={intentFilter}
                options={[["all", "All"], ["primary", "Primary high-intent"], ["secondary", "Secondary"]] as const}
                onChange={setIntentFilter}
              />
            </div>
          }
        />
        <div className="src-table">
          <div className="src-head" style={{ gridTemplateColumns: gridCols }}>
            <button type="button" className={"src-sort" + (sort.key === "domain" ? " is-active" : "")} onClick={() => onSort("domain")}>Domain{arrow("domain")}</button>
            <span>Type</span>
            <button type="button" className={"src-sort num" + (sort.key === "count" ? " is-active" : "")} onClick={() => onSort("count")}>Citations{arrow("count")}</button>
            <button type="button" className={"src-sort num" + (sort.key === "share" ? " is-active" : "")} onClick={() => onSort("share")}>Share{arrow("share")}</button>
          </div>
          {!rows.length ? (
            <p className="muted" style={{ padding: "12px 0" }}>
              No {domType === "all" ? "" : domType.toLowerCase() + " "}sources cited for this selection.
            </p>
          ) : null}
          {rows.map((row, dridx) => {
            const open = expanded === row.domain;
            return (
              <div key={row.domain} className="dom-group" data-tour={dridx === 0 ? "top-domains" : undefined}>
                <button className={"dom-row" + (open ? " expanded" : "")} style={{ gridTemplateColumns: gridCols }} data-tour-expand={dridx === 0 ? "" : undefined} onClick={() => setExpanded(open ? "" : row.domain)}>
                  <strong>
                    <i>{open ? "⌄" : "›"}</i>
                    <span className="dom-name">{row.domain}</span>
                  </strong>
                  <span>
                    <Badge tone={row.type}>{row.type}</Badge>
                  </span>
                  <span className="num">{row.count}</span>
                  <span className="num">{pct(row.share)}</span>
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
  // Leaderboards rank on PRIMARY (high-intent) prompts only — same basis as the home gauge.
  const primaryPayload = useMemo(() => primaryPayloadOf(payload), [payload]);
  const leaderboard = useMemo(() => buildLeaderboardData(primaryPayload), [primaryPayload]);

  // Top 10 cited sources + the prompts that cite each (competitive citation intel).
  const [cf, setCf] = useState<SurfaceFilter>("all");
  const [openDom, setOpenDom] = useState("");
  const isPrimaryText = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const q of payload.report.queries) m.set(q.text, isPrimaryCategory(q.category));
    return m;
  }, [payload]);
  const topCited = useMemo(() => {
    const cit = buildCitationStats(payload, cf);
    return [...cit.domainDetails]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((d) => {
        const prompts = Array.from(new Set((d.urls || []).flatMap((u) => u.prompts || []))).sort();
        return {
          domain: d.domain, type: d.type, owned: d.owned, count: d.count, promptTotal: prompts.length,
          primary: prompts.filter((p) => isPrimaryText.get(p)),
          secondary: prompts.filter((p) => !isPrimaryText.get(p))
        };
      });
  }, [payload, cf, isPrimaryText]);

  return (
    <div className="view-stack">
      <p className="page-note">
        How {payload.company.name.split(",")[0]} ranks against other HVAC companies in {primaryLocation(payload.company)}, across {primaryPayload.report.queries.length} high-intent prompts.
      </p>
      <p className="bench-note">Visibility Score and Share of Voice are based on the <strong>primary high-intent prompts</strong>. Ranked by how often each company is named across the AI platforms; switch a list to a single platform with the toggle.</p>

      <section className="dashboard-grid">
        <Leaderboard title="Visibility Score" subtitle="How visible are you in AI search overall?" data={leaderboard} filter={vf} setFilter={setVf} mode="vis" limit={10} />
        <Leaderboard title="Share of Voice" subtitle="When a brand gets mentioned, how often is it you?" data={leaderboard} filter={sf} setFilter={setSf} mode="sov" limit={10} />
      </section>

      <section className="panel">
        <PanelHead
          title="Top Citation Sources — by Prompt"
          subtitle="The 10 most-cited sources and the prompts that cite each (expand a row)"
          right={
            <EngineToggle payload={payload} value={cf} onChange={setCf} />
          }
        />
        <div className="src-head">
          <span>Source</span>
          <span>Type</span>
          <span>Citations</span>
          <span>Prompts</span>
        </div>
        {topCited.length ? (
          topCited.map((d) => {
            const open = openDom === d.domain;
            return (
              <div key={d.domain} className="dom-group">
                <button className={"dom-row" + (open ? " expanded" : "")} onClick={() => setOpenDom(open ? "" : d.domain)}>
                  <strong>
                    <i>{open ? "⌄" : "›"}</i>
                    {d.domain}
                    {d.owned ? <span className="tier-tag primary">You</span> : null}
                  </strong>
                  <span>
                    <Badge tone={d.type}>{d.type}</Badge>
                  </span>
                  <span>{d.count}</span>
                  <span>{d.promptTotal}</span>
                </button>
                {open ? (
                  <div className="cite-groups">
                    {([
                      { label: "Primary", cls: "primary", list: d.primary },
                      { label: "Secondary", cls: "secondary", list: d.secondary }
                    ] as const).map((g) =>
                      g.list.length ? (
                        <div key={g.label} className="cite-group">
                          <div className="cite-group-head">
                            <span className={"tier-tag " + g.cls}>{g.label}</span>
                            <span className="cite-group-count">{g.list.length}</span>
                          </div>
                          <div className="cite-prompts">
                            {g.list.map((p, i) => (
                              <span key={i} className="cite-prompt">{p}</span>
                            ))}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="muted" style={{ padding: "12px 20px" }}>No citations for this selection.</p>
        )}
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
          <EngineToggle payload={payload} value={sFilter} onChange={setSFilter} />
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
    <section className="panel empty-state brewing">
      <span className="es-icon"><Icon name="clock" size={20} /></span>
      <h2>Your report is brewing</h2>
      <p>The data may take a couple of minutes to load. Please check back shortly.</p>
      <span className="brew-bar" aria-hidden="true"><i /></span>
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

function Navi({ icon, active, count, onClick, children, dataTour }: { icon: string; active?: boolean; count?: number; onClick?: () => void; children: React.ReactNode; dataTour?: string }) {
  return (
    <button className={"navi" + (active ? " active" : "")} onClick={onClick} data-tour={dataTour}>
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

// Per-ENGINE cell: an engine pools surfaces (Gemini = Maps + Search) and is run
// multiple times. Show the company's BEST rank across all of that engine's
// surfaces and repeats — so the table agrees with the Coverage chart (which
// counts a prompt as covered if you appear at least once). The row expander
// shows the per-surface, per-run detail behind this single number.
// Consensus across an engine's repeat runs for ONE prompt: rank companies by how
// OFTEN they appear across the runs, then by average position. Both the rank column
// and the expanded panel read this same aggregate, so they can never disagree (no more
// "#3 in the column, gone when you click in" from a single lucky run). A company is
// counted once per run (its best position that run); absence in a run lowers its count.
function buildConsensus(runs: SurfaceRun[], surfaces: readonly string[]) {
  const hadRuns = runs.some((run) => surfaces.includes(run.surface));
  const live = runs.filter((run) => surfaces.includes(run.surface) && !run.rawAnswer.startsWith("Provider error:"));
  const groups = new Map<string, { name: string; isTarget: boolean; count: number; ranks: number[] }>();
  for (const run of live) {
    const seen = new Set<string>();
    for (const mention of run.mentions) {
      const key = mention.isTarget ? "__target" : canonicalCompanyName(mention.companyName);
      if (!key || seen.has(key)) continue; // each company counts once per run
      seen.add(key);
      const g = groups.get(key) ?? { name: mention.companyName, isTarget: Boolean(mention.isTarget), count: 0, ranks: [] };
      g.count += 1;
      g.ranks.push(mention.rank);
      if (!mention.isTarget && mention.companyName.length > g.name.length) g.name = mention.companyName;
      groups.set(key, g);
    }
  }
  const ranked = Array.from(groups.values())
    .map((g) => ({ name: g.name, isTarget: g.isTarget, count: g.count, avgRank: g.ranks.reduce((a, b) => a + b, 0) / g.ranks.length }))
    .sort((a, b) => b.count - a.count || a.avgRank - b.avgRank);
  const targetIndex = ranked.findIndex((r) => r.isTarget);
  return { ranked, hadRuns, liveRuns: live.length, targetRank: targetIndex >= 0 ? targetIndex + 1 : null };
}

// Per-ENGINE cell: show the company's CONSENSUS rank across the engine's repeat runs,
// or "Missing" if it's not in the consensus top 5 — the exact number the panel shows.
function EngineRankCell({ runs, surfaces }: { runs: SurfaceRun[]; surfaces: readonly string[] }) {
  const { targetRank: rank, hadRuns, liveRuns } = buildConsensus(runs, surfaces);
  if (!hadRuns) return <span className="dash">—</span>;
  if (!liveRuns) return <span className="error-pill">Error</span>;
  if (rank && rank <= 5) return <span className={"rank-pill" + (rank === 1 ? " one" : "")}>#{rank}</span>;
  return <span className="missing-pill">Missing</span>;
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
  // Always render exactly `limit` rows: when the target isn't in the top `limit`,
  // drop the last and append it so it's always shown (top limit-1 + you).
  const visible = pinned && targetRow ? [...rows.slice(0, Math.max(0, limit - 1)), targetRow] : top;
  const valOf = (row: MentionShareRow) => (mode === "sov" ? row.count / totalCount : scoreOf(row));
  const barOf = (row: MentionShareRow) => (mode === "sov" ? row.count / maxCount : scoreOf(row) / maxScore);
  const bandOf = (value: number) => (mode === "vis" ? band(value, 0.3, 0.2) : value >= 0.1 ? "High" : value >= 0.05 ? "Medium" : "Low");

  return (
    <div className="panel">
      <PanelHead
        title={title}
        subtitle={subtitle}
        right={
          <EngineToggle
            options={[["all", "All"], ...ENGINES.filter((e) => (data[e.key]?.length ?? 0) > 0).map((e) => [e.key, e.label] as [SurfaceFilter, string])]}
            value={filter}
            onChange={setFilter}
          />
        }
      />
      <div className="lb-list">
        {visible.map((row, index) => (
          // Rank = the company's TRUE position in the full sorted list, not its row
          // position — so a pinned "You" appended at the bottom shows e.g. #11, not #6.
          <div key={row.name + index} className={"lb-row" + (row.isTarget ? " you" : "")}>
            <span className="lb-rank">{rows.indexOf(row) + 1}</span>
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
        title="Coverage by Question Type"
        subtitle="Which kinds of questions do you show up for?"
        tooltip="The share of prompts in each category where you appear at least once. This is coverage (breadth of presence) — not the weighted Visibility Score, which also factors how often and how high up you're mentioned."
        right={<EngineToggle payload={payload} value={filter} onChange={setFilter} />}
      />
      <div className="cov-list">
        {coverage.map((row) => (
          <div key={row.category} className="coverage-row">
            <span className="cov-cat">
              <span className={"tier-tag " + (isPrimaryCategory(row.category) ? "primary" : "secondary")}>
                {isPrimaryCategory(row.category) ? "Primary" : "Secondary"}
              </span>
              <span className="cov-cat-name">{row.category}</span>
            </span>
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

// Prompt type = the locked CSV "Bucket" stored on each query (lib/query-generator.ts).
// Order matches the CSV; any bucket not present in a report is filtered out downstream.
const categoryOrder = ["Core General", "Repair & Maintenance", "Reviews & Price", "Product / Brand", "Consideration", "Symptom / Problem"];

function displayCategory(query: Query): string {
  return query.category;
}

// PRIMARY (high-intent) buckets drive the HEADLINE: Visibility Score, by-platform
// bars, top competitor and the competitor leaderboards. SECONDARY buckets still run
// and appear in the prompt breakdown, but don't move the headline number. Change the
// split by editing this set.
const PRIMARY_CATEGORIES = new Set(["Core General", "Repair & Maintenance", "Reviews & Price"]);
function isPrimaryCategory(category: string): boolean {
  return PRIMARY_CATEGORIES.has(category);
}
// A payload narrowed to primary prompts only (queries + their runs) — pass this to the
// score/leaderboard builders so they compute on high-intent prompts with the right denominators.
function primaryPayloadOf(payload: ReportPayload): ReportPayload {
  const primaryQueries = payload.report.queries.filter((q) => isPrimaryCategory(q.category));
  // Old reports (pre-lockdown taxonomy) have no primary buckets — fall back to all
  // prompts so their score/leaderboards still render instead of showing empty.
  if (!primaryQueries.length) return payload;
  const ids = new Set(primaryQueries.map((q) => q.id));
  return {
    ...payload,
    report: {
      ...payload.report,
      queries: primaryQueries,
      runs: payload.report.runs.filter((r) => ids.has(r.queryId))
    }
  };
}

// A payload narrowed by prompt intent for the citations table: primary (high-intent),
// secondary (everything else), or all. Mirrors primaryPayloadOf's empty-bucket fallback.
function payloadByIntent(payload: ReportPayload, intent: IntentFilter): ReportPayload {
  if (intent === "all") return payload;
  if (intent === "primary") return primaryPayloadOf(payload);
  const secondaryQueries = payload.report.queries.filter((q) => !isPrimaryCategory(q.category));
  if (!secondaryQueries.length) return payload;
  const ids = new Set(secondaryQueries.map((q) => q.id));
  return {
    ...payload,
    report: { ...payload.report, queries: secondaryQueries, runs: payload.report.runs.filter((r) => ids.has(r.queryId)) }
  };
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
  // Use the SAME engine→surface mapping as the leaderboards/cards: "Google" = both
  // Gemini surfaces (maps + search), not maps-only. Otherwise gemini_search coverage
  // counts toward "All" but neither engine tab, making All look ~100% while each
  // engine reads far lower (they can't sum to a union that drops a whole surface).
  const surfaces: readonly string[] = surfacesForFilter(surfaceFilter);
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
  return { all: make("all"), gemini: make("gemini"), google: make("google"), chatgpt: make("chatgpt") };
}

function mentionShareRuns(runs: SurfaceRun[], filter: SurfaceFilter) {
  const surfaces: readonly string[] =
    surfacesForFilter(filter);
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
// than pooling raw runs (which over-weights whichever engine more prompts hit).
// Weights: Google Gemini 40% / Google AI Mode 30% / ChatGPT 30%. Engines with no runs
// in this report are dropped and the remaining weights renormalized (so a report without
// AI Mode blends Gemini/ChatGPT at 0.40/0.30 → ~57%/43%, not dragged down by a 0 third).
function blendedVisibilityForName(payload: ReportPayload, name: string, isTarget: boolean): number {
  let weightSum = 0;
  let acc = 0;
  for (const engine of ENGINES) {
    const runs = mentionShareRuns(payload.report.runs, engine.key);
    if (!runs.length) continue;
    acc += visibilityMetricsForName(payload, runs, name, isTarget).visibility * ENGINE_WEIGHTS[engine.key];
    weightSum += ENGINE_WEIGHTS[engine.key];
  }
  return weightSum ? acc / weightSum : 0;
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

  const surfaces: readonly string[] = surfacesForFilter(surfaceFilter);
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

    for (const citation of runCitations(run)) {
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

// Per-engine domain citation counts, using the SAME distinct-run-per-domain counting
// as buildCitationStats so the side-by-side columns agree with the rest of the page.
// share = a domain's runs / that engine's total domain-runs.
function domainCitationCounts(payload: ReportPayload, surfaces: readonly string[]) {
  const domainRuns = new Map<string, Set<string>>();
  const runs = payload.report.runs.filter(
    (run) => !run.rawAnswer.startsWith("Provider error:") && surfaces.includes(run.surface)
  );
  for (const run of runs) {
    const domains = new Set<string>();
    for (const citation of runCitations(run)) {
      const domain = displayCitationDomain(citation);
      if (domain) domains.add(domain);
    }
    const runKey = `${run.queryId}:${run.runNumber}:${run.surface}`;
    for (const domain of domains) {
      if (!domainRuns.has(domain)) domainRuns.set(domain, new Set());
      domainRuns.get(domain)?.add(runKey);
    }
  }
  const total = Array.from(domainRuns.values()).reduce((sum, set) => sum + set.size, 0);
  const counts = new Map<string, number>();
  domainRuns.forEach((set, domain) => counts.set(domain, set.size));
  return { counts, total, hasRuns: runs.length > 0 };
}


function buildPromptCitationRows(row: PromptRow, surfaces?: readonly string[]): PromptCitationRow[] {
  const citationMap = new Map<string, PromptCitationRow>();
  for (const run of row.runs) {
    if (surfaces && !surfaces.includes(run.surface)) continue;
    const seenInRun = new Set<string>();
    for (const citation of runCitations(run)) {
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
  return Array.from(citationMap.values())
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, 5);
}

function buildSentimentStats(payload: ReportPayload, stats: ReportStats, surfaceFilter: SurfaceFilter = "all"): SentimentStats {
  const surfaces: readonly string[] = surfacesForFilter(surfaceFilter);
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
  // Band on the same rounded percentage the label shows, so a bar reading "20%"
  // (e.g. a raw 0.1996) gets the 20% color band, not the sub-20% one.
  const v = Math.round(value * 100);
  return v >= Math.round(hi * 100) ? "High" : v >= Math.round(md * 100) ? "Medium" : "Low";
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function shortSurface(surface: string) {
  if (surface === "gemini_maps" || surface === "gemini_search" || surface === "gemini") return "Google Gemini";
  if (surface === "chatgpt_search" || surface === "chatgpt") return "ChatGPT";
  return surface;
}

// What each engine bases its answer on — surfaced in the insight card so clients
// understand e.g. ChatGPT's "few reviews" reflects the open web, not Google reviews.
function surfaceSource(surface: string): { label: string; basis: string } {
  if (surface === "chatgpt_search") return { label: "ChatGPT", basis: "from open-web search & cited pages" };
  if (surface === "gemini_maps") return { label: "Google Gemini", basis: "from Google Maps & local reviews" };
  if (surface === "gemini_search") return { label: "Google Gemini", basis: "from Google web search" };
  if (surface === "google_ai_overview") return { label: "Google AI Mode", basis: "from Google AI Mode search" };
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
  // Works on both full reports and the lightweight list (no runs/queries fields) —
  // guard accordingly and fall back to status + recency.
  return [...reports].sort((a, b) => {
    const aComplete = a.status === "complete" ? 1 : 0;
    const bComplete = b.status === "complete" ? 1 : 0;
    if (aComplete !== bComplete) return bComplete - aComplete;
    const aRuns = a.runCount ?? a.runs?.length ?? 0;
    const bRuns = b.runCount ?? b.runs?.length ?? 0;
    if (aRuns !== bRuns) return bRuns - aRuns;
    const aQueries = a.queries?.length ?? 0;
    const bQueries = b.queries?.length ?? 0;
    if (aQueries !== bQueries) return bQueries - aQueries;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
}
