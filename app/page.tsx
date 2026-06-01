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

const NAV: Record<View, string> = {
  home: "Overview",
  prompts: "Prompts",
  citations: "Citations",
  competitors: "Competitors",
  sentiment: "Sentiment",
  setup: "Setup"
};

const defaultServices: Service[] = ["AC repair", "Furnace repair", "Emergency HVAC", "Heat pump repair", "Maintenance/tune-up"];
const customerSurfaces = ["gemini_maps", "chatgpt_search"] as const;
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
  chevdown: "M6 9l6 6 6-6"
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

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId),
    [companies, selectedCompanyId]
  );

  const reportOptions = useMemo(() => buildCompanyReportOptions(companies, reports), [companies, reports]);

  const reportStats = useMemo(() => (activeReport ? buildReportStats(activeReport) : null), [activeReport]);

  async function refresh() {
    const [companyResponse, reportResponse] = await Promise.all([fetch("/api/companies"), fetch("/api/reports")]);
    const nextCompanies = (await companyResponse.json()) as Company[];
    const nextReports = (await reportResponse.json()) as Report[];
    setCompanies(nextCompanies);
    setReports(nextReports);
    const preferredReport = selectDefaultReport(nextReports, nextCompanies);
    setSelectedCompanyId((current) => current || preferredReport?.companyId || nextCompanies[0]?.id || "");
    if (!activeReport && preferredReport) {
      await loadReport(preferredReport.id);
    }
  }

  async function loadReport(reportId: string) {
    const response = await fetch(`/api/reports/${reportId}`);
    const payload = (await response.json()) as ReportPayload;
    if (!response.ok || !payload.report?.queries || !payload.company) {
      console.error("Invalid report payload", payload);
      return;
    }
    setActiveReport(payload);
    setSelectedCompanyId(payload.company.id);
  }

  async function switchReport(reportId: string) {
    if (!reportId || reportId === activeReport?.report.id) return;
    await loadReport(reportId);
    setView("home");
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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: dashboardStyles }} />
      <div className="aeo3">
        <div className="app">
          <aside className="side">
            <div className="brand">
              <img src="/netic/netic-wordmark-green.svg" alt="Netic" />
            </div>
            <div className="brand-sub">
              AI Visibility Tracker <span className="beta-pill">Beta</span>
            </div>

            <div className="acct">
              <label htmlFor="acct">Company</label>
              <div className="sel">
                <select id="acct" value={activeReport?.report.id ?? ""} onChange={(event) => switchReport(event.target.value)} disabled={!reportOptions.length}>
                  {!reportOptions.length ? <option value="">No reports yet</option> : null}
                  {reportOptions.map((option) => (
                    <option key={option.reportId} value={option.reportId}>
                      {option.companyName} — {option.location}
                    </option>
                  ))}
                </select>
                <Icon name="chevdown" size={14} />
              </div>
              <span className="loc">{primaryLocation(company) ?? "Create an account"}</span>
            </div>

            <NavGroup label="Overview">
              <Navi icon="home" active={view === "home"} count={total} onClick={() => setView("home")}>
                Home
              </Navi>
            </NavGroup>
            <NavGroup label="Visibility">
              <Navi icon="prompts" active={view === "prompts"} count={total} onClick={() => setView("prompts")}>
                Prompts
              </Navi>
              <Navi icon="citations" active={view === "citations"} onClick={() => setView("citations")}>
                Citations
              </Navi>
              <Navi icon="competitors" active={view === "competitors"} onClick={() => setView("competitors")}>
                Competitors
              </Navi>
              <Navi icon="sentiment" active={view === "sentiment"} onClick={() => setView("sentiment")}>
                Sentiment
              </Navi>
            </NavGroup>
            <NavGroup label="Configure">
              <Navi icon="setup" active={view === "setup"} onClick={() => setView("setup")}>
                Setup
              </Navi>
            </NavGroup>

            <div className="side-foot">
              <div className="av">{initials(company?.name ?? "Netic")}</div>
              <div>
                <div className="nm">{(company?.name ?? "Netic").split(",")[0]} ops</div>
                <div className="rl">operator</div>
              </div>
            </div>
          </aside>

          <section className="workspace">
            <header className="topbar">
              <div className="topbar-inner">
                <div className="crumb">
                  {company?.name ?? "HVAC account"} <Icon name="chevron" size={13} /> AI Visibility <Icon name="chevron" size={13} /> <b>{NAV[view]}</b>
                </div>
                <div className="top-actions">
                  <span className="last-run">{lastRun}</span>
                  {activeReport ? (
                    <div className="share-tools">
                      <button className="btn" onClick={copyShareLink}>
                        <Icon name={shareCopied ? "copy" : "share"} size={13} />
                        {shareCopied ? "Copied" : "Share report"}
                      </button>
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
              ) : !activeReport || !reportStats ? (
                <EmptyState onSetup={() => setView("setup")} />
              ) : view === "prompts" ? (
                <PromptsView payload={activeReport} stats={reportStats} />
              ) : view === "citations" ? (
                <CitationsView payload={activeReport} />
              ) : view === "competitors" ? (
                <CompetitorsView payload={activeReport} stats={reportStats} />
              ) : view === "sentiment" ? (
                <SentimentView payload={activeReport} stats={reportStats} />
              ) : (
                <OverviewView payload={activeReport} stats={reportStats} onNav={setView} />
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   Overview
   ──────────────────────────────────────────────────────────── */
function OverviewView({ payload, stats, onNav }: { payload: ReportPayload; stats: ReportStats; onNav: (view: View) => void }) {
  const [visFilter, setVisFilter] = useState<SurfaceFilter>("all");
  const [sovFilter, setSovFilter] = useState<SurfaceFilter>("all");
  const [citFilter, setCitFilter] = useState<SurfaceFilter>("all");

  const summary = payload.summary;
  const leaderboard = useMemo(() => buildLeaderboardData(payload), [payload]);
  const citationStats = useMemo(() => buildCitationStats(payload), [payload]);
  const citRank = useMemo(() => buildCitationStats(payload, citFilter), [payload, citFilter]);

  const targetMetrics = visibilityMetricsForName(payload, mentionShareRuns(payload.report.runs, "all"), payload.company.name, true);
  // targetMetrics.visibility is already the weighted score; use it directly so the gauge
  // equals this company's value in the Visibility score rank leaderboard.
  const score100 = Math.round(targetMetrics.visibility * 100);
  const gband = score100 >= 67 ? "High" : score100 >= 34 ? "Medium" : "Low";

  const surfaceShow = customerSurfaces
    .map((surface) => {
      const score = summary.surfaceScores.find((item) => item.surface === surface);
      return { surface, label: shortSurface(surface), rate: score?.mentionRate ?? 0 };
    });

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

  return (
    <div className="view-stack">
      <p className="page-note">
        {primaryLocation(payload.company)} visibility across {stats.totalQueries} HVAC prompts and {surfaceShow.length} AI search surfaces.
      </p>
      <p className="bench-note">
        Based on tracked high-intent prompts with multiple queries for accuracy. AI results can vary by platform, session, model, location, and timing. For reference only; not an exact view of what every consumer sees.
      </p>

      <div className="panel score-panel">
        <PanelHead title="AI visibility score" subtitle="How often AI recommends you, overall" />
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
            <p className="gauge-cap">Across {stats.totalQueries} tracked prompts</p>
          </div>
          <div className="score-platforms">
            <span className="sp-label">By platform</span>
            <div className="pf-list">
              {surfaceShow.map((surface) => (
                <div key={surface.surface} className="pf-row">
                  <div className="pf-name">{surface.label}</div>
                  <div className="pf-bar">
                    <div className={"platform-track " + band(surface.rate, 0.6, 0.3).toLowerCase()}>
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
          label="Share of voice"
          value={pct(sov)}
          helper={sovRank ? `${ordinal(sovRank)} of ${sovCount} in your market` : `of ${sovCount} in your market`}
          tooltip="When an AI answer names you or a competitor, how often it names you."
        />
        <MetricCard label="Citation rate" value={pct(citRate)} helper={`${brandCited.size}/${allCited.size} cited answers`} tooltip="Of the AI answers that cite sources, how often your site or brand is one of them." />
        <MetricCard label="Top-position rate" value={pct(summary.topThreeRate)} helper="ranked top 3" tooltip="How often you appear in the top 3 companies named in an AI answer." />
        <MetricCard label="First mention rate" value={pct(topOneRate)} helper="named first" tooltip="How often you are the first company named in an AI answer." />
      </section>

      <section className="dashboard-grid">
        <Leaderboard title="Visibility score rank" data={leaderboard} filter={visFilter} setFilter={setVisFilter} mode="vis" onMore={() => onNav("competitors")} moreLabel="See all competitors" />
        <Leaderboard title="Share of voice rank" data={leaderboard} filter={sovFilter} setFilter={setSovFilter} mode="sov" onMore={() => onNav("competitors")} moreLabel="See all competitors" />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <PanelHead
            title="Citation domain rank"
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
      if (cat !== "All" && normalizeCategory(row.query.category) !== cat) return false;
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
        <MetricCard label="Total prompts" value={String(stats.totalQueries)} helper={`${payload.report.runs.length} AI checks`} />
        <MetricCard label="You rank in" value={String(stats.mentionedQueries)} helper="prompts with a mention" />
        <MetricCard label="Missing" value={String(stats.missingQueries)} helper="not ranked anywhere" />
        <MetricCard label="#1 position %" value={pct(topOneRate)} helper="ranked #1" />
        <MetricCard label="Top competitor" value={topCompetitor ? topCompetitor.name : "—"} valueSm helper={topCompetitor ? pct(topCompetitor.visibilityRate) + " visibility" : ""} />
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
            <span>Best</span>
            <span>#1 competitor</span>
          </div>
          {visible.map((row) => (
            <div key={row.query.id} className={"prompt-record" + (expanded === row.query.id ? " open" : "")}>
              <button className="prompt-row" onClick={() => setExpanded(expanded === row.query.id ? "" : row.query.id)}>
                <span className="prompt-text">
                  <i className={"row-chev" + (expanded === row.query.id ? " open" : "")}>›</i>
                  <span className="label">{row.query.text}</span>
                  {row.hasInsight ? <b className="insight-marker">Insight</b> : null}
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
                <span className="cell-center">
                  <BestBadge rank={row.bestRank} />
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

function PromptDetails({ row }: { row: PromptRow }) {
  const citedSources = buildPromptCitationRows(row);
  const insightRuns = customerSurfaces.map((surface) => row.bySurface[surface]).filter((run): run is SurfaceRun => Boolean(run && run.missingInsight));

  return (
    <div className="prompt-details">
      {customerSurfaces.map((surface) => {
        const run = row.bySurface[surface];
        const rank = targetRank(run);
        return (
          <div key={surface} className="answer-card">
            <div className="answer-top">
              <Badge>{shortSurface(surface)}</Badge>
              <span>{rank ? `You rank #${rank}` : "You: not ranked"}</span>
            </div>
            <ol>
              {(run ? run.mentions : []).slice(0, 5).map((mention, index) => (
                <li key={index} className={mention.isTarget ? "you" : ""}>
                  {mention.companyName}
                </li>
              ))}
            </ol>
            <p className="answer-excerpt">{run ? truncate(run.rawAnswer, 240) : "No response saved yet."}</p>
          </div>
        );
      })}

      {insightRuns.length ? (
        <div className="answer-card full">
          <div className="answer-top">
            <Badge tone="others">Missing insight</Badge>
            <span>Why you were not recommended</span>
          </div>
          <div className="missing-list">
            {insightRuns.map((run) => (
              <div key={run.id} className="missing-row">
                <strong>{shortSurface(run.surface)}</strong>
                <p>{run.missingInsight?.answer}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="answer-card full">
        <div className="answer-top">
          <Badge>Cited sources</Badge>
          <span>Source citations</span>
        </div>
        {citedSources.length ? (
          <div className="pc-list">
            {citedSources.map((citation) => (
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
          <p className="muted">No cited sources were captured for this prompt.</p>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Citations
   ──────────────────────────────────────────────────────────── */
function CitationsView({ payload }: { payload: ReportPayload }) {
  const cit = useMemo(() => buildCitationStats(payload), [payload]);
  const [expanded, setExpanded] = useState(cit.domainDetails[0]?.domain ?? "");

  useEffect(() => {
    setExpanded(cit.domainDetails[0]?.domain ?? "");
  }, [cit]);

  return (
    <div className="view-stack">
      <p className="page-note">
        Citation stats use the sources AI cites as supporting authority. Platform sources are directories, review sites, trust profiles, and editorial lists; competitor sources are other HVAC company websites.
      </p>

      <section className="metric-grid four">
        <MetricCard label="Unique sources" value={String(cit.uniqueSources)} helper="real citation domains" />
        <MetricCard label="Total citations" value={String(cit.totalCitations)} helper="counted once per run" />
        <MetricCard label="Your citation share" value={pct(cit.ownedShare)} helper={`${cit.ownedCitations} owned citations`} />
        <MetricCard label="Platform source share" value={pct(cit.platformShare)} helper="directories, reviews, editorial" />
      </section>

      <section className="panel">
        <PanelHead title="Where AI gets its answers" subtitle="Citation volume by source type" />
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
        <PanelHead title="Top cited domains" subtitle="Expand a domain to see the exact cited pages" />
        <div className="src-table">
          <div className="src-head">
            <span>Domain</span>
            <span>Type</span>
            <span>Citations</span>
            <span>Share</span>
          </div>
          {cit.domainDetails.map((row) => {
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
        <Leaderboard title="Visibility score rank" data={leaderboard} filter={vf} setFilter={setVf} mode="vis" limit={10} />
        <Leaderboard title="Share of voice rank" data={leaderboard} filter={sf} setFilter={setSf} mode="sov" limit={10} />
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sentiment
   ──────────────────────────────────────────────────────────── */
function SentimentView({ payload, stats }: { payload: ReportPayload; stats: ReportStats }) {
  const s = useMemo(() => buildSentimentStats(payload, stats), [payload, stats]);
  const leftPct = Math.round((s.score + 1) * 50);

  return (
    <div className="view-stack">
      <section className="sentiment-hero">
        <span className="ov">Overall AI sentiment — {s.label}</span>
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
        <ThemePanel title="What AI says that's working" subtitle="Recurring positive themes in mentions" rows={s.working} positive />
        <ThemePanel title="What AI says that's hurting" subtitle="Recurring negative themes in AI language" rows={s.hurting} />
      </section>

      <section className="panel">
        <PanelHead title="Competitor language to beat" subtitle="Most repeated proof points from top competitors" />
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

function EmptyState({ onSetup }: { onSetup: () => void }) {
  return (
    <section className="panel empty-state">
      <h2>No report loaded</h2>
      <p>Create or select a company, generate a query set, then run the audit.</p>
      <button className="btn primary" type="button" onClick={onSetup}>
        Open setup
      </button>
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

function PanelHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className={right ? "controls-head" : "panel-head"}>
      <h2>{title}</h2>
      {subtitle ? <span className="sub">{subtitle}</span> : null}
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

function BestBadge({ rank }: { rank: number | null }) {
  return rank ? <span className={"rank-pill" + (rank === 1 ? " one" : "")}>#{rank}</span> : <span className="missing-pill">Missing</span>;
}

/* ── Leaderboard ── */
function Leaderboard({
  title,
  data,
  filter,
  setFilter,
  mode,
  limit = 5,
  onMore,
  moreLabel
}: {
  title: string;
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
        right={
          <div className="segmented">
            {(["all", "gemini", "chatgpt"] as const).map((option) => (
              <button key={option} className={filter === option ? "active" : ""} onClick={() => setFilter(option)}>
                {option === "all" ? "All" : option === "gemini" ? "Gemini" : "ChatGPT"}
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
        title="AI visibility score by prompt type"
        right={
          <div className="segmented">
            {(["all", "gemini", "chatgpt"] as const).map((option) => (
              <button key={option} className={filter === option ? "active" : ""} onClick={() => setFilter(option)}>
                {option === "all" ? "All" : option === "gemini" ? "Gemini" : "ChatGPT"}
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
      <path d={seg(1, 32)} stroke="var(--destructive)" strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d={seg(34, 65)} stroke="var(--warning)" strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d={seg(67, 99)} stroke="var(--success)" strokeWidth={sw} strokeLinecap="round" fill="none" />
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

const categoryOrder = ["Core Local Service", "Emergency Repair", "Trust & Reviews", "Price & Financing", "Replacement & Tune-Up"];

function buildReportStats(payload: ReportPayload): ReportStats {
  const promptRows: PromptRow[] = payload.report.queries.map((query) => {
    const runs = payload.report.runs.filter((run) => run.queryId === query.id);
    const bySurface = Object.fromEntries(customerSurfaces.map((surface) => [surface, runs.find((run) => run.surface === surface)])) as PromptRow["bySurface"];
    const customerRuns = runs.filter((run) => customerSurfaces.includes(run.surface as (typeof customerSurfaces)[number]));
    const ranks = customerRuns.map((run) => targetRank(run)).filter((rank): rank is number => typeof rank === "number");
    const competitors = runs
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
    const ca = categoryOrder.indexOf(normalizeCategory(a.query.category));
    const cb = categoryOrder.indexOf(normalizeCategory(b.query.category));
    if (ca !== cb) return ca - cb;
    return priorityValue(b.query.priority) - priorityValue(a.query.priority);
  });

  const categories = categoryOrder.filter((category) => promptRows.some((row) => normalizeCategory(row.query.category) === category));
  const categoryCoverage = categories.map((category) => {
    const rows = promptRows.filter((row) => normalizeCategory(row.query.category) === category);
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

function buildCategoryCoverage(payload: ReportPayload, surfaceFilter: SurfaceFilter) {
  const surfaces: readonly string[] = surfaceFilter === "gemini" ? ["gemini_maps"] : surfaceFilter === "chatgpt" ? ["chatgpt_search"] : customerSurfaces;
  const rows = payload.report.queries.map((query) => {
    const runs = payload.report.runs.filter((run) => run.queryId === query.id && surfaces.includes(run.surface));
    return { category: normalizeCategory(query.category), hasTarget: runs.some((run) => targetRank(run) !== null) };
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
      visibilityScore: visibilityMetricsForName(payload, runs, row.name, row.isTarget).visibility
    }));
  };
  return { all: make("all"), gemini: make("gemini"), chatgpt: make("chatgpt") };
}

function mentionShareRuns(runs: SurfaceRun[], filter: SurfaceFilter) {
  const surfaces = filter === "gemini" ? ["gemini_maps"] : filter === "chatgpt" ? ["chatgpt_search"] : customerSurfaces;
  return runs.filter((run) => surfaces.includes(run.surface as (typeof customerSurfaces)[number]));
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

function topOneRateOf(payload: ReportPayload) {
  const topOne = payload.report.runs.flatMap((run) => run.mentions.filter((mention) => mention.isTarget && mention.rank === 1));
  return payload.report.runs.length ? topOne.length / payload.report.runs.length : 0;
}

function buildCitationStats(payload: ReportPayload, surfaceFilter: SurfaceFilter = "all"): CitationStats {
  const ownedDomain = domainFromValue(payload.company.website);
  const domainRuns = new Map<string, Set<string>>();
  const urlRuns = new Map<string, Map<string, { title: string; url: string; runs: Set<string>; prompts: Set<string> }>>();

  const surfaces = surfaceFilter === "gemini" ? ["gemini_maps", "gemini_search"] : surfaceFilter === "chatgpt" ? ["chatgpt_search"] : null;
  const citationRuns = payload.report.runs.filter((item) => !item.rawAnswer.startsWith("Provider error:") && (!surfaces || surfaces.includes(item.surface)));

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
      const type = classifyCitationDomain(domain, ownedDomain);
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

function buildPromptCitationRows(row: PromptRow): PromptCitationRow[] {
  const citationMap = new Map<string, PromptCitationRow>();
  for (const run of row.runs) {
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

function buildSentimentStats(payload: ReportPayload, stats: ReportStats): SentimentStats {
  const targetContexts: MentionContext[] = payload.report.runs.flatMap((run) =>
    run.mentions.filter((mention) => mention.isTarget).map((mention) => ({ mention, answer: run.rawAnswer, surface: run.surface, companyName: payload.company.name }))
  );
  const targetScore = averageSentiment(targetContexts.map((context) => context.mention));
  const competitorContexts: MentionContext[] = payload.report.runs.flatMap((run) =>
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
function displayCitationDomain(citation: Citation) {
  const domain = domainFromValue(citation.domain || citation.url);
  if (domain && !isInfrastructureDomain(domain)) return domain;
  const titleDomain = domainFromValue(citation.title);
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

function classifyCitationDomain(domain: string, ownedDomain: string): SourceType {
  if (domain === ownedDomain) return "Owned";
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

function normalizeCategory(category: string) {
  if (category === "Core Local" || category === "Symptom Diagnosis" || category === "Property-Specific Needs") return "Core Local Service";
  if (category === "Replacement & Installation" || category === "Maintenance & Prevention") return "Replacement & Tune-Up";
  return category;
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
  if (surface === "gemini_maps" || surface === "gemini_search") return "Gemini";
  if (surface === "chatgpt_search") return "ChatGPT";
  return surface;
}

function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "N"
  );
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function formatRunDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

function selectDefaultReport(reports: Report[], companies: Company[]) {
  const hoffmannCompanies = companies.filter((company) => canonicalCompanyName(company.name).includes("hoffmannbrothers"));
  const hoffmannReports = reports.filter((report) => hoffmannCompanies.some((company) => company.id === report.companyId));
  const hoffmannReport = selectPreferredReport(hoffmannReports);
  if (hoffmannReport) return hoffmannReport;
  return selectPreferredReport(reports);
}

function selectPreferredReport(reports: Report[]) {
  return [...reports].sort((a, b) => {
    const aComplete = a.status === "complete" ? 1 : 0;
    const bComplete = b.status === "complete" ? 1 : 0;
    if (aComplete !== bComplete) return bComplete - aComplete;
    if (a.runs.length !== b.runs.length) return b.runs.length - a.runs.length;
    if (a.queries.length !== b.queries.length) return b.queries.length - a.queries.length;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
}
