"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { HVAC_SERVICES, SURFACE_LABELS } from "@/lib/constants";
import { Citation, Company, CompanyMention, Location, Query, Report, Service, SurfaceRun, TargetedSentimentRun, VisibilitySummary } from "@/lib/types";
import { v2Styles } from "./styles";

type ReportPayload = {
  report: Report;
  company: Company;
  summary: VisibilitySummary;
};

type View = "home" | "prompts" | "citations" | "sentiment" | "setup";
type PromptFilter = "all" | "ranked" | "missing";
type MentionShareSurfaceFilter = "all" | "gemini" | "chatgpt";
type MetricStatus = "High" | "Medium" | "Low" | "NA";

const defaultServices: Service[] = ["AC repair", "Furnace repair", "Emergency HVAC"];
const customerSurfaces = ["gemini_maps", "chatgpt_search"] as const;
const targetedSentimentPromptTemplate = "You are helping a homeowner choose an HVAC company in {location}. Based on publicly available information, what are the strongest reasons to consider {company}, and what concerns or gaps should a homeowner know before choosing them?";

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [repeatRuns, setRepeatRuns] = useState(1);
  const [activeReport, setActiveReport] = useState<ReportPayload | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [view, setView] = useState<View>("home");
  const [search, setSearch] = useState("");
  const [promptFilter, setPromptFilter] = useState<PromptFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [expandedQueryId, setExpandedQueryId] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId),
    [companies, selectedCompanyId]
  );

  const reportOptions = useMemo(
    () => buildCompanyReportOptions(companies, reports),
    [companies, reports]
  );

  const reportStats = useMemo(() => {
    if (!activeReport) return null;
    return buildReportStats(activeReport);
  }, [activeReport]);

  const visibleRows = useMemo(() => {
    if (!reportStats) return [];
    const query = search.trim().toLowerCase();

    return reportStats.promptRows.filter((row) => {
      if (query && !row.query.text.toLowerCase().includes(query)) return false;
      if (categoryFilter !== "All" && normalizeCategory(row.query.category) !== categoryFilter) return false;
      if (promptFilter === "ranked" && !row.hasTarget) return false;
      if (promptFilter === "missing" && row.hasTarget) return false;
      return true;
    });
  }, [categoryFilter, promptFilter, reportStats, search]);

  useEffect(() => {
    if (view !== "prompts" || !visibleRows.length) return;
    const expandedStillVisible = visibleRows.some((row) => row.query.id === expandedQueryId);
    if (!expandedQueryId || !expandedStillVisible) {
      setExpandedQueryId(visibleRows[0].query.id);
    }
  }, [expandedQueryId, view, visibleRows]);

  async function switchReport(reportId: string) {
    if (!reportId || reportId === activeReport?.report.id) return;
    setSearch("");
    setPromptFilter("all");
    setCategoryFilter("All");
    setExpandedQueryId("");
    await loadReport(reportId);
  }

  async function refresh() {
    const [companyResponse, reportResponse] = await Promise.all([
      fetch("/api/companies"),
      fetch("/api/reports")
    ]);
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

  async function runReport() {
    if (!activeReport) return;
    setIsRunning(true);
    try {
      const response = await fetch(`/api/reports/${activeReport.report.id}/run`, {
        method: "POST"
      });
      const report = (await response.json()) as Report;
      await loadReport(report.id);
      await refresh();
    } finally {
      setIsRunning(false);
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

  async function copyShareLink() {
    if (!activeReport) return;
    const url = `${window.location.origin}/share/${activeReport.report.id}`;
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1600);
  }

  function openEmailDraft() {
    if (!activeReport) return;
    const url = `${window.location.origin}/share/${activeReport.report.id}`;
    const subject = `AI visibility audit for ${activeReport.company.name}`;
    const body = `Here is the AI visibility audit for ${activeReport.company.name}:\n\n${url}`;
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
    <style dangerouslySetInnerHTML={{ __html: v2Styles }} />
    <main className="app-shell aeo-v2">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-lockup">
          <img className="netic-logo" src="/netic/netic-wordmark-green.svg" alt="Netic" />
          <span className="brand-subline">AI Visibility Insights</span>
          </div>
          <span className="beta-pill">Beta</span>
        </div>

        <AccountSwitcher
          activeReportId={activeReport?.report.id ?? ""}
          companyName={activeReport?.company.name ?? selectedCompany?.name ?? "No company"}
          location={primaryLocation(activeReport?.company ?? selectedCompany) ?? "Create an account"}
          options={reportOptions}
          onChange={switchReport}
        />

        <NavGroup label="Overview">
          <NavButton active={view === "home"} count={reportStats?.promptRows.length} onClick={() => setView("home")}>
            Home
          </NavButton>
        </NavGroup>

        <NavGroup label="Visibility">
          <NavButton active={view === "prompts"} count={reportStats?.promptRows.length} onClick={() => setView("prompts")}>
            Prompts
          </NavButton>
          <NavButton active={view === "citations"} onClick={() => setView("citations")}>Citations</NavButton>
          <NavButton disabled badge="Soon">Competitors</NavButton>
          <NavButton active={view === "sentiment"} onClick={() => setView("sentiment")}>Sentiment</NavButton>
        </NavGroup>
      </aside>

      <section className="workspace">
        <header className="workspace-top">
          <div className="topbar-inner">
          <div>
            <p className="crumb">
              {activeReport?.company.name ?? "HVAC account"} <span>/</span> AI Visibility <span>/</span>{" "}
              <strong>{viewTitle(view)}</strong>
            </p>
          </div>
          <div className="top-actions">
            <span className="last-run">{activeReport?.report.completedAt ? `Last run ${timeAgo(activeReport.report.completedAt)}` : "No completed run"}</span>
            {activeReport ? (
              <div className="share-toolbar">
                <a href={`/share/${activeReport.report.id}`} target="_blank" rel="noreferrer">Share report</a>
                <button type="button" onClick={copyShareLink}>{shareCopied ? "Copied" : "Copy link"}</button>
                <button type="button" onClick={openEmailDraft}>Gmail</button>
              </div>
            ) : null}
          </div>
          </div>
        </header>


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
        ) : view === "citations" ? (
          <CitationsView payload={activeReport} stats={reportStats} />
        ) : view === "sentiment" ? (
          <SentimentView payload={activeReport} stats={reportStats} />
        ) : view === "prompts" ? (
          <PromptsView
            payload={activeReport}
            stats={reportStats}
            visibleRows={visibleRows}
            search={search}
            promptFilter={promptFilter}
            categoryFilter={categoryFilter}
            expandedQueryId={expandedQueryId}
            setSearch={setSearch}
            setPromptFilter={setPromptFilter}
            setCategoryFilter={setCategoryFilter}
            setExpandedQueryId={setExpandedQueryId}
          />
        ) : (
          <OverviewView payload={activeReport} stats={reportStats} onViewPrompts={() => setView("prompts")} onViewCitations={() => setView("citations")} />
        )}
      </section>
    </main>
    </>
  );
}

function OverviewView({ payload, stats, onViewPrompts, onViewCitations }: { payload: ReportPayload; stats: ReportStats; onViewPrompts: () => void; onViewCitations: () => void }) {
  const [visibilitySurfaceFilter, setVisibilitySurfaceFilter] = useState<MentionShareSurfaceFilter>("all");
  const [promptMentionSurfaceFilter, setPromptMentionSurfaceFilter] = useState<MentionShareSurfaceFilter>("all");
  const summary = payload.summary;
  const targetVisibilityMetrics = visibilityMetricsForName(payload, mentionShareRuns(payload.report.runs, "all"), payload.company.name, true);
  const visibilityScore = weightedVisibilityScore(targetVisibilityMetrics);
  const citationStats = buildCitationStats(payload);
  const promptMentionRate = stats.totalQueries ? stats.mentionedQueries / stats.totalQueries : 0;
  const topOneMentions = payload.report.runs.flatMap((run) => run.mentions.filter((mention) => mention.isTarget && mention.rank === 1));
  const topOneRate = payload.report.runs.length ? topOneMentions.length / payload.report.runs.length : 0;
  const visibilityRuns = visibilityScoreRuns(payload.report.runs, visibilitySurfaceFilter);
  const promptMentionRuns = mentionShareRuns(payload.report.runs, promptMentionSurfaceFilter);
  const mentionShareRows = buildMentionShareRows(payload, visibilityRuns);
  const promptMentionRows = buildPromptMentionRows(payload, promptMentionRuns);
  const radarRows = buildVisibilityRadarRows(payload);
  return (
    <div className="view-stack">
      <p className="page-note">
        {primaryLocation(payload.company)} visibility across {payload.report.queries.length} HVAC prompts and{" "}
        {stats.surfaceCount} AI platforms.
      </p>
      <p className="benchmark-note">
        Based on tracked high-intent prompts with multiple queries for accuracy. AI results can vary by platform, session, model, location, and timing.
        <br />For reference only; not an exact view of what every consumer sees.
      </p>

      <section className="metric-grid five">
        <MetricCard label="Visibility score" value={percent(visibilityScore)} tone="rust" status={visibilityScoreBand(visibilityScore)} tooltip="Weighted score based on how often your company appears, how many tracked prompts mention you, and how often you rank near the top." />
        <MetricCard label="Prompts mentioning you" value={percent(promptMentionRate)} helper={`${stats.mentionedQueries}/${stats.totalQueries} (${stats.missingQueries} missing)`} status={promptMentionBand(promptMentionRate)} />
        <MetricCard label="Top-position rate" value={percent(summary.topThreeRate)} tone="rust" helper="ranked top 3" status={topPositionBand(summary.topThreeRate)} />
        <MetricCard label="#1 position %" value={percent(topOneRate)} tone="gold" helper="ranked #1" status={topOneBand(topOneRate)} />
        <SurfaceMetricCard summary={summary} />
      </section>

      <section className="dashboard-grid">
        <VisibilityRadar rows={radarRows} />
        <div className="panel chart-panel wide-panel">
          <PanelHeader title="Category coverage" subtitle="Where you appear by prompt category" />
          <div className="coverage-list">
            {stats.categoryCoverage.map((row) => (
              <div key={row.category} className="coverage-row">
                <span>{row.category}</span>
                <div className="track">
                  <i style={{ width: `${Math.round(row.rate * 100)}%` }} />
                </div>
                <strong>{percent(row.rate)}</strong>
              </div>
            ))}
          </div>
        </div>

        <MentionShareList rows={mentionShareRows} filter={visibilitySurfaceFilter} onFilterChange={setVisibilitySurfaceFilter} />
        <PromptMentionList rows={promptMentionRows} filter={promptMentionSurfaceFilter} onFilterChange={setPromptMentionSurfaceFilter} />
        <TopPromptWins stats={stats} onViewPrompts={onViewPrompts} />
        <TopList title="Citation domains" rows={citationStats.domainRows.slice(0, 10)} ctaLabel="See all citations ->" onCta={onViewCitations} />
      </section>
    </div>
  );
}

function PromptsView({
  payload,
  stats,
  visibleRows,
  search,
  promptFilter,
  categoryFilter,
  expandedQueryId,
  setSearch,
  setPromptFilter,
  setCategoryFilter,
  setExpandedQueryId
}: {
  payload: ReportPayload;
  stats: ReportStats;
  visibleRows: PromptRow[];
  search: string;
  promptFilter: PromptFilter;
  categoryFilter: string;
  expandedQueryId: string;
  setSearch: (value: string) => void;
  setPromptFilter: (value: PromptFilter) => void;
  setCategoryFilter: (value: string) => void;
  setExpandedQueryId: (value: string) => void;
}) {
  const topCompetitor = stats.mentionShareRows.find((row) => !row.isTarget);
  const topOneMentions = payload.report.runs.flatMap((run) => run.mentions.filter((mention) => mention.isTarget && mention.rank === 1));
  const topOneRate = payload.report.runs.length ? topOneMentions.length / payload.report.runs.length : 0;

  return (
    <div className="view-stack">
      <section className="metric-grid five">
        <MetricCard label="Total prompts" value={String(stats.totalQueries)} helper={`${payload.report.runs.length} AI checks`} />
        <MetricCard label="You rank in" value={String(stats.mentionedQueries)} tone="green" helper="prompts with a mention" />
        <MetricCard label="Missing" value={String(stats.missingQueries)} tone="rust" helper="not ranked anywhere" />
        <MetricCard label="#1 position %" value={percent(topOneRate)} helper="ranked #1" />
        <MetricCard label="Top competitor" value={topCompetitor?.name ?? "-"} helper={topCompetitor ? percent(topCompetitor.visibilityRate) + " visibility" : "Run checks"} compact />
      </section>

      <section className="panel prompt-panel">
        <div className="prompt-tools">
          <label className="search-field">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search prompts..." />
          </label>
          <div className="segmented">
            <button className={promptFilter === "all" ? "active" : ""} type="button" onClick={() => setPromptFilter("all")}>All</button>
            <button className={promptFilter === "ranked" ? "active" : ""} type="button" onClick={() => setPromptFilter("ranked")}>Your rank</button>
            <button className={promptFilter === "missing" ? "active" : ""} type="button" onClick={() => setPromptFilter("missing")}>Missing</button>
          </div>
          <span className="sort-note">Sorted by category, then priority</span>
        </div>

        <div className="intent-pills">
          <button className={categoryFilter === "All" ? "active" : ""} type="button" onClick={() => setCategoryFilter("All")}>
            All <span>{stats.totalQueries}</span>
          </button>
          {stats.categoryCoverage.map((row) => (
            <button
              key={row.category}
              className={categoryFilter === row.category ? "active" : ""}
              type="button"
              onClick={() => setCategoryFilter(row.category)}
            >
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
          {visibleRows.map((row) => (
            <div key={row.query.id} className="prompt-record">
              <button
                className="prompt-row"
                type="button"
                onClick={() => setExpandedQueryId(expandedQueryId === row.query.id ? "" : row.query.id)}
              >
                <span className="prompt-text"><i className={"row-chevron " + (expandedQueryId === row.query.id ? "open" : "")}>›</i>{row.query.text}{row.hasInsight ? <b className="insight-marker">Insight</b> : null}</span>
                <span><Badge>{normalizeCategory(row.query.category)}</Badge></span>
                <RankCell run={row.bySurface.gemini_maps} />
                <RankCell run={row.bySurface.chatgpt_search} />
                <span><BestBadge rank={row.bestRank} /></span>
                <span className="competitor-name">{row.topCompetitor ?? "-"}</span>
              </button>
              {expandedQueryId === row.query.id ? <PromptDetails row={row} /> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PromptDetails({ row }: { row: PromptRow }) {
  const citationRows = buildPromptCitationRows(row);
  const insightRuns = row.runs.filter((run) => run.missingInsight);

  return (
    <div className="prompt-details">
      {customerSurfaces.map((surface) => {
        const run = row.bySurface[surface];
        return (
          <div key={surface} className="answer-card">
            <div className="answer-top">
              <Badge>{shortSurface(surface)}</Badge>
              <span>{run?.mentions.some((mention) => mention.isTarget) ? `You rank #${targetRank(run)}` : "You: not ranked"}</span>
            </div>
            {run?.rawAnswer.startsWith("Provider error:") ? (
              <p className="error-text">{run.rawAnswer}</p>
            ) : (
              <>
                <ol>
                  {(run?.mentions ?? []).slice(0, 5).map((mention) => (
                    <li key={`${mention.companyName}-${mention.rank}`}>
                      <span>{mention.companyName}</span>
                    </li>
                  ))}
                </ol>
                <p className="answer-excerpt">{run?.rawAnswer ? truncate(run.rawAnswer, 220) : "No response saved yet."}</p>
              </>
            )}
          </div>
        );
      })}
      {insightRuns.length ? (
        <div className="answer-card prompt-insights-card">
          <div className="answer-top">
            <Badge>Missing insight</Badge>
            <span>Why you were not recommended</span>
          </div>
          <div className="missing-insight-list">
            {insightRuns.map((run) => (
              <div key={run.id} className="missing-insight-row">
                <strong>{shortSurface(run.surface)}</strong>
                <p>{run.missingInsight?.answer}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="answer-card prompt-citations-card">
        <div className="answer-top">
          <Badge>Cited sources</Badge>
          <span>Source citations</span>
        </div>
        {citationRows.length ? (
          <div className="prompt-citation-list">
            {citationRows.map((citation) => (
              <a key={citation.key} href={citation.url} target="_blank" rel="noreferrer" className="prompt-citation-row">
                <span>{citation.title}</span>
                <code>{citation.url}</code>
                <small>{citation.domain} · {citation.count}x cited</small>
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

function CitationsView({ payload }: { payload: ReportPayload; stats: ReportStats }) {
  const citationStats = buildCitationStats(payload, "gemini_search");
  const [expandedDomain, setExpandedDomain] = useState(citationStats.domainDetails[0]?.domain ?? "");

  useEffect(() => {
    setExpandedDomain(citationStats.domainDetails[0]?.domain ?? "");
  }, [payload.report.id]);

  return (
    <div className="view-stack">
      <p className="page-note">
        Citation stats use the sources AI cites as supporting authority.
        Platform sources are directories, review sites, trust profiles, and editorial lists; competitor sources are other HVAC company websites.
      </p>

      <section className="metric-grid four">
        <MetricCard label="Unique sources" value={String(citationStats.uniqueSources)} helper="real citation domains" />
        <MetricCard label="Total citations" value={String(citationStats.totalCitations)} helper="counted once per run" />
        <MetricCard label="Your citation share" value={percent(citationStats.ownedShare)} tone="rust" helper={`${citationStats.ownedCitations} owned citations`} />
        <MetricCard label="Platform source share" value={percent(citationStats.platformShare)} helper="directories, reviews, editorial" />
      </section>

      <section className="panel chart-panel">
        <PanelHeader title="Where AI gets its answers" subtitle="Citation volume by source type" />
        <div className="coverage-list">
          {citationStats.typeRows.map((row) => (
            <div key={row.type} className={`coverage-row citation-type-row ${row.type.toLowerCase()}`}>
              <span>{row.type}</span>
              <div className="track">
                <i style={{ width: `${Math.round(row.share * 100)}%` }} />
              </div>
              <strong><b>{row.count}</b><small>{percent(row.share)}</small></strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel data-panel citation-detail-panel">
        <PanelHeader title="Top cited domains" subtitle="Expand a domain to see the exact cited pages" />
        <div className="source-table citation-domain-table">
          <div className="source-head citation-source-head">
            <span>Domain</span>
            <span>Type</span>
            <span>Citations</span>
            <span>Share</span>
          </div>
          {citationStats.domainDetails.map((row) => {
            const expanded = expandedDomain === row.domain;
            return (
              <div key={row.domain} className="citation-domain-group">
                <button className={"source-row citation-domain-row " + (expanded ? "expanded" : "")} type="button" onClick={() => setExpandedDomain(expanded ? "" : row.domain)}>
                  <strong><i>{expanded ? "⌄" : "›"}</i>{row.domain}</strong>
                  <span><Badge tone={row.type}>{row.type}</Badge></span>
                  <span>{row.count}</span>
                  <span>{percent(row.share)}</span>
                </button>
                {expanded ? (
                  <div className="citation-url-list">
                    {row.urls.length ? row.urls.map((urlRow) => (
                      <a key={urlRow.key} href={urlRow.url} target="_blank" rel="noreferrer" className="citation-url-row">
                        <div>
                          <strong>{urlRow.title}</strong>
                          <code>{urlRow.url}</code>
                        </div>
                        <span>{urlRow.count}x cited</span>
                        <small>{urlRow.promptCount} prompts</small>
                        <p>{urlRow.prompts.slice(0, 3).join(" · ")}</p>
                      </a>
                    )) : <p className="muted">No exact URLs were captured for this domain.</p>}
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

function SentimentView({ payload, stats }: { payload: ReportPayload; stats: ReportStats }) {
  const sentimentStats = buildSentimentStats(payload, stats);

  return (
    <div className="view-stack">
      <section className="sentiment-hero">
        <div>
          <span>Overall AI sentiment — {sentimentStats.label}</span>
          <strong className="sentiment-score">{signed(sentimentStats.score)}</strong>
          <div className="sentiment-meter">
            <i style={{ left: `${Math.round((sentimentStats.score + 1) * 50)}%` }}>{signed(sentimentStats.score)}</i>
          </div>
          <div className="sentiment-scale">
            <span>Negative (-1)</span>
            <span>Neutral (0)</span>
            <span>Positive (+1)</span>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <ThemePanel title="What AI says that's working" subtitle="Recurring positive themes in mentions" rows={sentimentStats.working} positive />
        <ThemePanel title="What AI says that's hurting" subtitle="Recurring negative themes in AI language" rows={sentimentStats.hurting} />
      </section>

      <section className="panel data-panel">
        <PanelHeader title="Competitor language to beat" subtitle="Most repeated proof points from top competitors" />
        <div className="competitor-quote-grid">
          {sentimentStats.competitorThemes.map((competitor) => (
            <div key={competitor.name} className="competitor-quote-card">
              <h3>{competitor.name}</h3>
              <span>{competitor.mentions} mentions</span>
              {competitor.themes.map((theme) => (
                <p key={theme.phrase}>“{theme.phrase}” <small>{theme.count}x</small></p>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TargetedSentimentPanel({
  company,
  location,
  rows
}: {
  company: Company;
  location?: Location;
  rows: TargetedSentimentRun[];
}) {
  const locationLabel = location?.label ?? "the local market";
  const prompt = rows[0]?.prompt ?? targetedSentimentPromptTemplate
    .replace("{location}", locationLabel)
    .replace("{company}", company.name);

  return (
    <section className="panel targeted-sentiment-panel">
      <PanelHeader title="What AI says about your company" subtitle="Prompt used for future AI perception checks" />
      <div className="targeted-prompt-box">
        <span>Prompt we run</span>
        <p>{prompt}</p>
      </div>
      {rows.length ? (
        <div className="targeted-sentiment-list">
          {rows.map((row) => (
            <div key={row.id} className="targeted-sentiment-row">
              <div>
                <h3><i className={surfaceToneClass(row.surface)} />{shortSurface(row.surface)}</h3>
                <span>{row.summary} · {row.sentiment}</span>
              </div>
              <blockquote>{cleanAiSnippet(row.rawAnswer)}</blockquote>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted targeted-empty">Not collected for this existing report. Future runs will capture this once per platform and keep it separate from ranking visibility.</p>
      )}
    </section>
  );
}

function PlatformQuotePanel({ rows }: { rows: PlatformQuoteRow[] }) {
  return (
    <section className="panel platform-quotes-panel">
      <PanelHeader title="What each AI actually says" subtitle="Representative snippet from each platform responses" />
      {rows.length ? (
        <div className="platform-quote-list">
          {rows.map((row) => (
            <div key={row.surface} className="platform-quote-row">
              <div className="platform-quote-meta">
                <h3><i className={surfaceToneClass(row.surface)} />{shortSurface(row.surface)}</h3>
                <span>{row.mentions} {row.mentions === 1 ? "mention" : "mentions"} · {row.tone}</span>
                <strong>{signed(row.score)}</strong>
              </div>
              <div className="platform-quote-snippets">
                {row.quotes.map((quote) => (
                  <blockquote key={quote}>{quote}</blockquote>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No direct target-company language captured yet.</p>
      )}
    </section>
  );
}

function ThemePanel({
  title,
  subtitle,
  rows,
  positive
}: {
  title: string;
  subtitle: string;
  rows: ThemeRow[];
  positive?: boolean;
}) {
  return (
    <div className={`panel theme-panel ${positive ? "positive" : "negative"}`}>
      <PanelHeader title={title} subtitle={subtitle} />
      {rows.length ? (
        rows.map((row) => (
          <div key={row.phrase} className="theme-block">
            <div className="theme-row">
              <span>{positive ? "✓" : "!"}</span>
              <em>{row.phrase}</em>
              <small>{row.count}x mentioned</small>
              <strong>{signed(row.score)}</strong>
            </div>
          </div>
        ))
      ) : (
        <p className="muted">Not enough direct AI language yet.</p>
      )}
    </div>
  );
}

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

      <div className="panel">
        <PanelHeader title="Run report" subtitle="Manual MVP report creation" />
        <label>
          Company
          <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)}>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Repeat runs per query/platform
          <input
            type="number"
            min={1}
            max={10}
            value={repeatRuns}
            onChange={(event) => setRepeatRuns(Number(event.target.value))}
          />
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
        <button className="primary" type="button" disabled={!selectedCompany} onClick={createReport}>
          Generate Query Set
        </button>

        <div className="report-list">
          {reports.slice(0, 8).map((report) => (
            <button key={report.id} type="button" onClick={() => loadReport(report.id)}>
              <strong>{report.status}</strong>
              <span>{report.queries.length} queries · {new Date(report.createdAt).toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompanyForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [services, setServices] = useState<Service[]>(defaultServices);
  const [additionalLocations, setAdditionalLocations] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const primaryCity = String(form.get("city") || "");
    const primaryState = String(form.get("state") || "");
    const locations: Omit<Location, "id">[] = [
      {
        label: `${primaryCity}, ${primaryState}`,
        city: primaryCity,
        state: primaryState,
        latitude: Number(form.get("latitude")) || undefined,
        longitude: Number(form.get("longitude")) || undefined,
        isPrimary: true
      },
      ...parseAdditionalLocations(additionalLocations)
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
    setAdditionalLocations("");
    setServices(defaultServices);
    await onCreated();
  }

  return (
    <form className="panel" onSubmit={submit}>
      <PanelHeader title="Create HVAC company" subtitle="Manual inputs for the MVP" />
      <label>
        Business name
        <input name="name" required placeholder="ABC Heating & Air" />
      </label>
      <label>
        Website
        <input name="website" required placeholder="https://examplehvac.com" />
      </label>
      <label>
        Google Business Profile URL
        <input name="gbp" placeholder="https://maps.google.com/..." />
      </label>
      <div className="two-col">
        <label>
          Primary city
          <input name="city" required placeholder="San Jose" />
        </label>
        <label>
          State
          <input name="state" required placeholder="CA" />
        </label>
      </div>
      <div className="two-col">
        <label>
          Latitude
          <input name="latitude" placeholder="37.3382" />
        </label>
        <label>
          Longitude
          <input name="longitude" placeholder="-121.8863" />
        </label>
      </div>
      <fieldset>
        <legend>HVAC services</legend>
        <div className="checks">
          {HVAC_SERVICES.map((service) => (
            <label key={service} className="check">
              <input
                type="checkbox"
                checked={services.includes(service)}
                onChange={(event) =>
                  setServices((current) =>
                    event.target.checked ? [...current, service] : current.filter((item) => item !== service)
                  )
                }
              />
              {service}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Additional locations
        <textarea
          value={additionalLocations}
          onChange={(event) => setAdditionalLocations(event.target.value)}
          placeholder={"Santa Clara, CA\nCampbell, CA"}
        />
      </label>
      <label>
        Known competitors
        <textarea name="competitors" placeholder={"Service Champions\nFuse HVAC"} />
      </label>
      <button className="primary" type="submit">
        Save Company
      </button>
    </form>
  );
}

function EmptyState({ onSetup }: { onSetup: () => void }) {
  return (
    <section className="panel empty-state">
      <h2>No report loaded</h2>
      <p>Create or select a company, generate a query set, then run the audit.</p>
      <button className="primary" type="button" onClick={onSetup}>
        Open setup
      </button>
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
  compact,
  status,
  tooltip
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "green" | "rust" | "gold";
  compact?: boolean;
  status?: MetricStatus;
  tooltip?: string;
}) {
  return (
    <div className={`metric-card ${tone ?? ""} ${compact ? "compact" : ""}`}>
      <span className="metric-label">
        {label}
        {tooltip ? (
          <i className="info-dot" tabIndex={0}>
            i
            <em>{tooltip}</em>
          </i>
        ) : null}
      </span>
      <div className="metric-value-row">
        <strong>{value}</strong>
        {status ? <i className={`status-pill ${status.toLowerCase()}`}>{status}</i> : null}
      </div>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function SurfaceMetricCard({ summary }: { summary: VisibilitySummary }) {
  const rows = summary.surfaceScores.filter((score) => customerSurfaces.includes(score.surface as (typeof customerSurfaces)[number]));

  return (
    <div className="metric-card surface-metric-card">
      <span>Where you show up</span>
      <div className="surface-mini-list">
        {rows.map((score) => (
          <div key={score.surface} className="surface-mini-row">
            <span>{shortSurface(score.surface)}</span>
            <strong>{percent(score.mentionRate)}</strong>
            <div className="track small">
              <i style={{ width: `${Math.round(score.mentionRate * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function visibilityScoreBand(value: number): MetricStatus {
  if (value >= 0.3) return "High";
  if (value >= 0.2) return "Medium";
  return "Low";
}

function promptMentionBand(value: number): MetricStatus {
  if (value > 0.4) return "High";
  if (value >= 0.2) return "Medium";
  return "Low";
}

function topPositionBand(value: number): MetricStatus {
  if (value > 0.2) return "High";
  if (value >= 0.1) return "Medium";
  return "Low";
}

function topOneBand(value: number): MetricStatus {
  if (value > 0.1) return "High";
  if (value >= 0.05) return "Medium";
  return "Low";
}

function positionBand(value: number | null): MetricStatus {
  if (!value) return "NA";
  if (value <= 2) return "High";
  if (value <= 2.5) return "Medium";
  return "Low";
}

function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  );
}

function TopList({
  title,
  rows,
  ctaLabel,
  onCta
}: {
  title: string;
  rows: Array<{ name: string; count: number; type?: SourceType }>;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="panel">
      <PanelHeader title={title} />
      {rows.length ? (
        <>
          {rows.slice(0, 10).map((row) => (
            <div key={row.name} className="rank-row">
              <span>
                <b>{row.name}</b>
                {row.type ? <Badge tone={row.type}>{row.type}</Badge> : null}
              </span>
              <strong>{row.count}</strong>
            </div>
          ))}
          {ctaLabel && onCta ? <button className="text-cta" type="button" onClick={onCta}>{ctaLabel}</button> : null}
        </>
      ) : (
        <p className="muted">Run checks to populate this section.</p>
      )}
    </div>
  );
}

function MentionShareList({
  rows,
  filter,
  onFilterChange
}: {
  rows: MentionShareRow[];
  filter: MentionShareSurfaceFilter;
  onFilterChange: (filter: MentionShareSurfaceFilter) => void;
}) {
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  const topRows = rows.slice(0, 10);
  const targetRow = rows.find((row) => row.isTarget);
  const shouldPinTarget = Boolean(targetRow && !topRows.some((row) => row.isTarget));
  const visibleRows = shouldPinTarget && targetRow ? [...topRows, targetRow] : topRows;

  return (
    <div className="panel">
      <div className="panel-title controls-title">
        <h2>Visibility Score Leaderboard</h2>
        <div className="segmented compact-segmented">
          <button className={filter === "all" ? "active" : ""} type="button" onClick={() => onFilterChange("all")}>All</button>
          <button className={filter === "gemini" ? "active" : ""} type="button" onClick={() => onFilterChange("gemini")}>Gemini</button>
          <button className={filter === "chatgpt" ? "active" : ""} type="button" onClick={() => onFilterChange("chatgpt")}>ChatGPT</button>
        </div>
      </div>
      {visibleRows.length ? (
        <div className="mention-share-list">
          {visibleRows.map((row) => (
            <div key={row.name + (row.isTarget ? "-target" : "-competitor")} className={"mention-share-row " + (row.isTarget ? "you" : "")}>
              {shouldPinTarget && row.isTarget ? <small className="your-position">Your position</small> : null}
              <div>
                <strong>{row.name}</strong>
                <span>{row.isTarget ? "You" : "Competitor"}</span>
              </div>
              <div className={`mention-bar ${visibilityScoreBand(row.visibilityRate).toLowerCase()}`}>
                <i style={{ width: String(Math.max(4, Math.round((row.count / maxCount) * 100))) + "%" }} />
              </div>
              <b>{percent(row.visibilityRate)}</b>
              <small>{row.count} checks</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Run checks to populate this section.</p>
      )}
    </div>
  );
}

function PromptMentionList({
  rows,
  filter,
  onFilterChange
}: {
  rows: MentionShareRow[];
  filter: MentionShareSurfaceFilter;
  onFilterChange: (filter: MentionShareSurfaceFilter) => void;
}) {
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  const topRows = rows.slice(0, 10);
  const targetRow = rows.find((row) => row.isTarget);
  const shouldPinTarget = Boolean(targetRow && !topRows.some((row) => row.isTarget));
  const visibleRows = shouldPinTarget && targetRow ? [...topRows, targetRow] : topRows;

  return (
    <div className="panel">
      <div className="panel-title controls-title">
        <h2>Prompt mention leaderboard</h2>
        <div className="segmented compact-segmented">
          <button className={filter === "all" ? "active" : ""} type="button" onClick={() => onFilterChange("all")}>All</button>
          <button className={filter === "gemini" ? "active" : ""} type="button" onClick={() => onFilterChange("gemini")}>Gemini</button>
          <button className={filter === "chatgpt" ? "active" : ""} type="button" onClick={() => onFilterChange("chatgpt")}>ChatGPT</button>
        </div>
      </div>
      {visibleRows.length ? (
        <div className="mention-share-list">
          {visibleRows.map((row) => (
            <div key={row.name + (row.isTarget ? "-target-prompts" : "-competitor-prompts")} className={"mention-share-row " + (row.isTarget ? "you" : "")}>
              {shouldPinTarget && row.isTarget ? <small className="your-position">Your position</small> : null}
              <div>
                <strong>{row.name}</strong>
                <span>{row.isTarget ? "You" : "Competitor"}</span>
              </div>
              <div className={`mention-bar ${promptMentionBand(row.visibilityRate).toLowerCase()}`}>
                <i style={{ width: String(Math.max(4, Math.round((row.count / maxCount) * 100))) + "%" }} />
              </div>
              <b>{percent(row.visibilityRate)}</b>
              <small>{row.count} prompts</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Run checks to populate this section.</p>
      )}
    </div>
  );
}

function priorityValue(priority: Query["priority"]) {
  return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

function TopPromptWins({ stats, onViewPrompts }: { stats: ReportStats; onViewPrompts: () => void }) {
  const rows = stats.promptRows
    .filter((row) => row.hasTarget && row.bestRank)
    .map((row) => ({ ...row, platformCount: row.runs.filter((run) => customerSurfaces.includes(run.surface as (typeof customerSurfaces)[number]) && Boolean(targetRank(run))).length }))
    .sort((a, b) => (a.bestRank ?? 99) - (b.bestRank ?? 99) || b.platformCount - a.platformCount || priorityValue(b.query.priority) - priorityValue(a.query.priority))
    .slice(0, 5);

  return (
    <div className="panel top-prompts-panel wide-panel">
      <PanelHeader title="Prompts where you rank" subtitle="Your top 5 wins" />
      {rows.length ? (
        <>
          <div className="top-prompt-table">
            <div className="top-prompt-head">
              <span>Prompt</span>
              <span>Best rank</span>
              <span>Platforms</span>
            </div>
            {rows.map((row) => (
              <div key={row.query.id} className="top-prompt-row">
                <span className="top-prompt-text"><b>{row.query.text}</b><Badge>{normalizeCategory(row.query.category)}</Badge></span>
                <span><BestBadge rank={row.bestRank} /></span>
                <strong>{row.platformCount}/{customerSurfaces.length}</strong>
              </div>
            ))}
          </div>
          <button className="text-cta" type="button" onClick={onViewPrompts}>See all {stats.totalQueries} prompts -&gt;</button>
        </>
      ) : (
        <p className="muted">No ranked prompts yet.</p>
      )}
    </div>
  );
}

function VisibilityRadar({ rows }: { rows: RadarRow[] }) {
  const axes: Array<{ key: keyof RadarMetrics; label: string }> = [
    { key: "visibility", label: "Visibility score" },
    { key: "topOne", label: "#1 position %" },
    { key: "promptMention", label: "Prompts mentioning you" },
    { key: "topPosition", label: "Top-position rate" }
  ];
  const center = 130;
  const radius = 96;
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="panel radar-panel">
      <PanelHeader title="AI Visibility Radar" subtitle="You vs top competitors" />
      <div className="radar-layout">
        <svg className="radar-chart" viewBox="-35 -20 330 300" role="img" aria-label="AI visibility comparison radar chart">
          {rings.map((ring) => (
            <polygon key={ring} points={radarPoints(axes.map(() => ring), center, radius)} className="radar-ring" />
          ))}
          {axes.map((axis, index) => {
            const point = radarPoint(index, axes.length, 1, center, radius);
            const label = radarPoint(index, axes.length, 1.18, center, radius);
            return (
              <g key={axis.key}>
                <line x1={center} y1={center} x2={point.x} y2={point.y} className="radar-axis" />
                <text x={label.x} y={label.y} textAnchor={radarLabelAnchor(index)} dominantBaseline="middle">{axis.label}</text>
              </g>
            );
          })}
          {rows.slice().reverse().map((row) => (
            <polygon key={row.name} points={radarPoints(axes.map((axis) => row.metrics[axis.key]), center, radius)} className={"radar-shape " + (row.isTarget ? "target" : "competitor")} style={{ "--radar-color": row.color } as React.CSSProperties} />
          ))}
        </svg>
        <div className="radar-legend">
          <h3>AI visibility score</h3>
          {rows.map((row) => (
            <div key={row.name} className={row.isTarget ? "you" : ""}>
              <i style={{ background: row.color }} />
              <span>{row.name}</span>
              <strong>{percent(row.metrics.visibility)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountSwitcher({
  activeReportId,
  companyName,
  location,
  options,
  onChange
}: {
  activeReportId: string;
  companyName: string;
  location: string;
  options: CompanyReportOption[];
  onChange: (reportId: string) => void;
}) {
  return (
    <div className="account-card">
      <div className="account-switcher-body">
        <label htmlFor="account-switcher">Company</label>
        <select
          id="account-switcher"
          value={activeReportId}
          onChange={(event) => onChange(event.target.value)}
          disabled={!options.length}
        >
          {!options.length ? <option value="">No reports yet</option> : null}
          {options.map((option) => (
            <option key={option.reportId} value={option.reportId}>
              {option.companyName} — {option.location}
            </option>
          ))}
        </select>
        <span>{location}</span>
      </div>
    </div>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="nav-group">
      <span>{label}</span>
      {children}
    </div>
  );
}

function NavButton({
  children,
  active,
  disabled,
  count,
  badge,
  onClick
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  count?: number;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button className={active ? "active" : ""} disabled={disabled} type="button" onClick={onClick}>
      <span>{children}</span>
      {badge ? <small>{badge}</small> : typeof count === "number" ? <small>{count}</small> : null}
    </button>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: SourceType }) {
  const toneClass = tone ? ` ${tone.toLowerCase()}` : "";
  return <span className={`badge${toneClass}`}>{children}</span>;
}

function RankCell({ run }: { run?: SurfaceRun }) {
  if (!run) return <span className="dash">-</span>;
  if (run.rawAnswer.startsWith("Provider error:")) return <span className="error-pill">Error</span>;
  const rank = targetRank(run);
  return rank ? <span className="rank-pill">#{rank}</span> : <span className="missing-pill">Missing</span>;
}

function BestBadge({ rank }: { rank: number | null }) {
  return rank ? <span className="rank-pill">#{rank}</span> : <span className="missing-pill">Missing</span>;
}

type CitationDomainRow = {
  name: string;
  domain: string;
  type: SourceType;
  count: number;
  share: number;
  owned: boolean;
};

type SourceType = "Competitor" | "Platform" | "Owned" | "Others";

type CitationUrlRow = {
  key: string;
  title: string;
  url: string;
  domain: string;
  count: number;
  promptCount: number;
  prompts: string[];
};

type CitationDomainDetail = CitationDomainRow & {
  urls: CitationUrlRow[];
};

type CitationStats = {
  uniqueSources: number;
  totalCitations: number;
  ownedCitations: number;
  ownedShare: number;
  platformShare: number;
  domainRows: CitationDomainRow[];
  domainDetails: CitationDomainDetail[];
  typeRows: Array<{ type: SourceType; count: number; share: number }>;
  platformRows: Array<{ surface: string; topDomain: string | null; ownedShare: number }>;
};

type PromptCitationRow = {
  key: string;
  title: string;
  url: string;
  domain: string;
  count: number;
};

type ThemeRow = { phrase: string; count: number; score: number; quotes: string[] };

type PlatformQuoteRow = {
  surface: string;
  mentions: number;
  score: number;
  tone: string;
  quotes: string[];
};

type MentionContext = {
  mention: CompanyMention;
  answer: string;
  surface: string;
  companyName: string;
};

type SentimentStats = {
  score: number;
  label: string;
  headline: string;
  summary: string;
  promptsAnalyzed: number;
  working: ThemeRow[];
  hurting: ThemeRow[];
  platformQuotes: PlatformQuoteRow[];
  competitorThemes: Array<{ name: string; mentions: number; themes: Array<{ phrase: string; count: number; quotes: string[] }> }>;
};


function buildCitationStats(payload: ReportPayload, scope: "all" | "gemini_search" = "all"): CitationStats {
  const ownedDomain = domainFromValue(payload.company.website);
  const domainRuns = new Map<string, Set<string>>();
  const urlRuns = new Map<string, Map<string, { title: string; url: string; runs: Set<string>; prompts: Set<string> }>>();
  const platformDomains = new Map<string, Map<string, number>>();

  const citationRuns = payload.report.runs.filter((item) => !item.rawAnswer.startsWith("Provider error:") && (scope === "all" || item.surface === scope));

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
          if (citation.title.length > existing.title.length && !looksLikeDomain(citation.title)) {
            existing.title = citationTitle(citation, domain);
          }
        } else {
          byUrl.set(url, {
            title: citationTitle(citation, domain),
            url,
            runs: new Set([runKey]),
            prompts: new Set([run.queryText])
          });
        }
        urlRuns.set(domain, byUrl);
      }
    }

    const platform = shortSurface(run.surface);
    const platformCounts = platformDomains.get(platform) ?? new Map<string, number>();
    for (const domain of domains) {
      if (!domainRuns.has(domain)) domainRuns.set(domain, new Set());
      domainRuns.get(domain)?.add(runKey);
      platformCounts.set(domain, (platformCounts.get(domain) ?? 0) + 1);
    }
    platformDomains.set(platform, platformCounts);
  }

  const totalCitations = Array.from(domainRuns.values()).reduce((sum, set) => sum + set.size, 0);
  const domainRows = Array.from(domainRuns.entries())
    .map(([domain, runs]) => {
      const type = classifyCitationDomain(domain, ownedDomain);
      const count = runs.size;
      return {
        name: domain,
        domain,
        type,
        count,
        share: totalCitations ? count / totalCitations : 0,
        owned: domain === ownedDomain
      };
    })
    .sort((a, b) => b.count - a.count);

  const domainDetails: CitationDomainDetail[] = domainRows.map((row) => {
    const rows = urlRuns.get(row.domain) ?? new Map<string, { title: string; url: string; runs: Set<string>; prompts: Set<string> }>();

    return {
      ...row,
      urls: Array.from(rows.entries())
        .map(([url, value]) => ({
          key: url,
          title: value.title,
          url: value.url,
          domain: row.domain,
          count: value.runs.size,
          promptCount: value.prompts.size,
          prompts: Array.from(value.prompts).sort()
        }))
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    };
  });

  const ownedCitations = domainRows.filter((row) => row.owned).reduce((sum, row) => sum + row.count, 0);
  const platformCitations = domainRows
    .filter((row) => row.type === "Platform")
    .reduce((sum, row) => sum + row.count, 0);

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
      .sort((a, b) => b.count - a.count),
    platformRows: Array.from(platformDomains.entries()).map(([surface, counts]) => {
      const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      const total = rows.reduce((sum, [, count]) => sum + count, 0);
      const owned = ownedDomain ? counts.get(ownedDomain) ?? 0 : 0;
      return {
        surface,
        topDomain: rows[0]?.[0] ?? null,
        ownedShare: total ? owned / total : 0
      };
    })
  };
}

function buildPromptCitationRows(row: PromptRow): PromptCitationRow[] {
  const citationMap = new Map<string, PromptCitationRow>();

  for (const run of row.runs.filter((item) => item.surface === "gemini_search")) {
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
          if (citation.title.length > existing.title.length && !looksLikeDomain(citation.title)) {
            existing.title = citation.title;
          }
          continue;
        }

        citationMap.set(url, {
          key: url,
          title: citationTitle(citation, domain),
          url,
          domain,
          count: 1
        });
      }
    }
  }

  return Array.from(citationMap.values())
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, 5);
}

function buildSentimentStats(payload: ReportPayload, stats: ReportStats): SentimentStats {
  const targetContexts = payload.report.runs.flatMap((run) =>
    run.mentions
      .filter((mention) => mention.isTarget)
      .map((mention) => ({ mention, answer: run.rawAnswer, surface: run.surface, companyName: payload.company.name }))
  );
  const targetMentions = targetContexts.map((context) => context.mention);
  const targetScore = averageSentiment(targetMentions);
  const competitorContexts = payload.report.runs.flatMap((run) =>
    run.mentions
      .filter((mention) => !mention.isTarget)
      .map((mention) => ({ mention, answer: run.rawAnswer, surface: run.surface, companyName: payload.company.name }))
  );
  const platformQuotes = buildPlatformQuoteRows(targetContexts);
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
      themes: phraseRows(contexts, positiveThemeMap(), "positive").slice(0, 4).map((row) => ({
        phrase: row.phrase,
        count: row.count,
        quotes: row.quotes
      }))
    };
  });

  const label = targetScore >= 0.35 ? "positive" : targetScore <= -0.2 ? "negative" : targetScore > 0 ? "mildly positive" : "neutral";
  const strongestWin = working[0]?.phrase ?? "service quality";
  const strongestGap = hurting[0]?.phrase ?? "citation and ranking consistency";
  const customerSurfaceScores = payload.summary.surfaceScores.filter((score) =>
    customerSurfaces.includes(score.surface as (typeof customerSurfaces)[number])
  );
  const weakestSurface = [...customerSurfaceScores].sort((a, b) => a.mentionRate - b.mentionRate)[0];
  const strongestSurface = [...customerSurfaceScores].sort((a, b) => b.mentionRate - a.mentionRate)[0];
  const topCompetitor = stats.mentionShareRows.find((row) => !row.isTarget);
  const targetShare = stats.mentionShareRows.find((row) => row.isTarget)?.visibilityRate ?? payload.summary.mentionRate;
  const citationStats = buildCitationStats(payload);
  const ownedShare = citationStats.ownedShare;
  const visibilityGap = topCompetitor ? topCompetitor.visibilityRate - targetShare : 0;
  const headline = sentimentHeadline({
    label,
    strongestWin,
    weakestSurface,
    ownedShare,
    visibilityGap,
    topCompetitorName: topCompetitor?.name
  });
  const summary = [
    `Mention tone measures how positively AI describes you only when it mentions your business; it is not the same as visibility.`,
    `For ${payload.company.name}, AI language leans ${label} around ${strongestWin}, but visibility is ${percent(targetShare)} across the customer-facing checks.`,
    weakestSurface && strongestSurface && weakestSurface.surface !== strongestSurface.surface
      ? `${shortSurface(weakestSurface.surface)} is the weak surface at ${percent(weakestSurface.mentionRate)}, while ${shortSurface(strongestSurface.surface)} is stronger at ${percent(strongestSurface.mentionRate)}.`
      : null,
    ownedShare < 0.08 ? `Your owned site is rarely cited (${percent(ownedShare)} of citations), so third-party sources are carrying most of the narrative.` : `Your owned site has some citation presence (${percent(ownedShare)}), but third-party sources still shape most answers.`,
    visibilityGap > 0.1 && topCompetitor ? `${topCompetitor.name} has a ${percent(visibilityGap)} visibility lead, mostly through repeated proof points like ${strongestGap}.` : null
  ].filter(Boolean).join(" ");

  return {
    score: targetScore,
    label,
    headline,
    summary,
    promptsAnalyzed: stats.totalQueries,
    platformQuotes,
    working,
    hurting,
    competitorThemes
  };
}


function buildPlatformQuoteRows(contexts: MentionContext[]): PlatformQuoteRow[] {
  const bySurface = new Map<string, MentionContext[]>();
  for (const context of contexts) {
    if (!customerSurfaces.includes(context.surface as (typeof customerSurfaces)[number])) continue;
    const rows = bySurface.get(context.surface) ?? [];
    rows.push(context);
    bySurface.set(context.surface, rows);
  }

  return customerSurfaces
    .map((surface) => {
      const rows = bySurface.get(surface) ?? [];
      if (!rows.length) return null;
      const mentions = rows.map((row) => row.mention);
      const score = averageSentiment(mentions);
      return {
        surface,
        mentions: rows.length,
        score,
        tone: platformTone(score),
        quotes: representativePlatformQuotes(rows)
      };
    })
    .filter(Boolean) as PlatformQuoteRow[];
}

function representativePlatformQuotes(contexts: MentionContext[]) {
  const average = averageSentiment(contexts.map((context) => context.mention));
  const sorted = [...contexts].sort((a, b) => Math.abs(sentimentValue(a.mention) - average) - Math.abs(sentimentValue(b.mention) - average));
  const quotes = uniqueStrings(sorted.map((context) => exactTargetSnippet(context)).filter(Boolean)).slice(0, 3);
  return quotes.length ? quotes : [clampWords(contexts[0]?.mention.summary || contexts[0]?.answer || "No snippet captured.", 32)];
}

function exactTargetSnippet(context: MentionContext) {
  const names = uniqueStrings([context.mention.companyName, context.companyName])
    .filter(Boolean)
    .map((name) => escapeRegExp(name));
  const namePattern = names.length ? new RegExp(names.join("|"), "i") : null;
  const sentences = context.answer
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const direct = namePattern ? sentences.find((sentence) => namePattern.test(sentence)) : null;
  const fallbackToken = context.mention.summary.split(" ").find((word) => word.length > 5)?.toLowerCase();
  const fallback = fallbackToken ? sentences.find((sentence) => sentence.toLowerCase().includes(fallbackToken)) : null;
  return cleanAiSnippet(clampWords(direct || fallback || context.mention.summary, 34));
}


function cleanAiSnippet(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/\[[^\]]+\]\((?:https?:\/\/|www\.)[^\s)]+\)/gi, (match) => match.replace(/\((?:https?:\/\/|www\.)[^\s)]+\)/gi, ""))
    .replace(/\(?https?:\/\/[^\s)]+\)?/gi, "")
    .replace(/\(?www\.[^\s)]+\)?/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sentimentValue(mention: CompanyMention) {
  return mention.sentiment === "positive" ? 0.65 : mention.sentiment === "negative" ? -0.65 : 0.1;
}

function platformTone(score: number) {
  if (score >= 0.45) return "Positive recommendation";
  if (score > 0.15) return "Positive, factual";
  if (score < -0.15) return "Negative or cautious";
  return "Neutral / factual";
}

function surfaceToneClass(surface: string) {
  if (surface.includes("chatgpt")) return "chatgpt";
  if (surface.includes("gemini")) return "gemini";
  return "generic";
}

function escapeRegExp(value: string) {
  const special = "\\^$.*+?()[]{}|";
  return value.split("").map((char) => special.includes(char) ? "\\" + char : char).join("");
}

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
  return ["vertexaisearch.cloud.google.com", "google-maps-place"].includes(domain);
}

function classifyCitationDomain(domain: string, ownedDomain: string): SourceType {
  if (domain === ownedDomain) return "Owned";
  if (isOtherCitationDomain(domain)) return "Others";
  if (isPlatformDomain(domain)) return "Platform";
  return "Competitor";
}

function isPlatformDomain(domain: string) {
  return [
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
  ].includes(domain) || domain.endsWith(".gov") || domain.endsWith(".edu");
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
    "stlouis.thehomemag.online",
    "thehomemag.online",
    "trane.com",
    "york.com"
  ].includes(domain);
}


function averageSentiment(mentions: CompanyMention[]) {
  if (!mentions.length) return 0;
  const values = mentions.map((mention) => mention.sentiment === "positive" ? 0.65 : mention.sentiment === "negative" ? -0.65 : 0.1);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sentimentHeadline({
  label,
  strongestWin,
  weakestSurface,
  ownedShare,
  visibilityGap,
  topCompetitorName
}: {
  label: string;
  strongestWin: string;
  weakestSurface?: VisibilitySummary["surfaceScores"][number];
  ownedShare: number;
  visibilityGap: number;
  topCompetitorName?: string;
}) {
  if (weakestSurface && weakestSurface.mentionRate === 0) {
    return `${shortSurface(weakestSurface.surface)} is not naming you yet, even though AI sounds ${label} when it does.`;
  }

  if (ownedShare < 0.04) {
    return `AI likes the story it finds, but your own site is barely part of the citation trail.`;
  }

  if (visibilityGap > 0.2 && topCompetitorName) {
    return `${topCompetitorName} owns more of the recommendation set; your strongest hook is ${strongestWin}.`;
  }

  if (label.includes("positive")) {
    return `AI is positive on ${strongestWin}, but the recommendation footprint is still thin.`;
  }

  return `AI does not yet have a clear, repeated reason to recommend you.`;
}

function canonicalCompanyName(name: string) {
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3 && !new Set(["air", "and", "the", "hvac", "heat", "heating", "cooling", "conditioning", "plumbing", "electric", "electrical", "services", "service", "company", "home", "homes", "inc", "llc"]).has(token));
  return tokens.length >= 2 ? tokens.join("") : name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function phraseRows(
  contexts: MentionContext[],
  themeMap: Array<{ phrase: string; patterns: RegExp[]; score: number }>,
  fallbackSentiment: "positive" | "negative"
): ThemeRow[] {
  const rows = new Map<string, { count: number; score: number; quotes: string[] }>();

  for (const theme of themeMap) {
    const matchingContexts = contexts.filter((context) => textForTheme(context).some((text) => theme.patterns.some((pattern) => pattern.test(text))));
    if (!matchingContexts.length) continue;

    rows.set(theme.phrase, {
      count: matchingContexts.length,
      score: theme.score,
      quotes: uniqueStrings(matchingContexts.flatMap((context) => quoteSnippets(context, theme.patterns))).slice(0, 3)
    });
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

  return sentences
    .filter((sentence) => patterns.some((pattern) => pattern.test(sentence)))
    .map((sentence) => clampWords(sentence, 24));
}

function clampWords(value: string, limit: number) {
  const words = value.replace(/^[-*#\d.\s]+/, "").split(/\s+/).filter(Boolean);
  return words.length > limit ? `${words.slice(0, limit).join(" ")}...` : words.join(" ");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}


function visibilityGapRows(payload: ReportPayload, stats: ReportStats) {
  const rows: Array<{ phrase: string; count: number; score: number }> = [];
  const chatgpt = payload.summary.surfaceScores.find((score) => score.surface === "chatgpt_search");
  const gemini = payload.summary.surfaceScores.find((score) => score.surface === "gemini_maps");
  if (chatgpt && chatgpt.mentionRate < 0.4) rows.push({ phrase: "weak ChatGPT visibility", count: Math.max(1, Math.round((1 - chatgpt.mentionRate) * stats.totalQueries)), score: -0.62 });
  if (gemini && gemini.mentionRate < 0.6) rows.push({ phrase: "not consistently shown in Gemini", count: Math.max(1, Math.round((1 - gemini.mentionRate) * stats.totalQueries)), score: -0.45 });
  if (payload.summary.citationCounts.every((row) => !row.name.includes(domainFromValue(payload.company.website)))) {
    rows.push({ phrase: "owned website rarely cited", count: 1, score: -0.5 });
  }
  return rows;
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

function signed(value: number) {
  const rounded = value.toFixed(2);
  return value > 0 ? `+${rounded}` : rounded;
}

type PromptRow = {
  query: Query;
  runs: SurfaceRun[];
  bySurface: Partial<Record<(typeof customerSurfaces)[number], SurfaceRun>>;
  bestRank: number | null;
  hasTarget: boolean;
  hasInsight: boolean;
  topCompetitor: string | null;
};

const categoryOrder = [
  "Core Local Service",
  "Emergency Repair",
  "Trust & Reviews",
  "Price & Financing",
  "Replacement & Tune-Up"
];

function normalizeCategory(category: string) {
  if (category === "Core Local" || category === "Symptom Diagnosis" || category === "Property-Specific Needs") return "Core Local Service";
  if (category === "Replacement & Installation" || category === "Maintenance & Prevention") return "Replacement & Tune-Up";
  return category;
}

type MentionShareRow = {
  name: string;
  count: number;
  visibilityRate: number;
  averageRank: number | null;
  isTarget: boolean;
};

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

function buildReportStats(payload: ReportPayload): ReportStats {
  const promptRows = payload.report.queries.map((query) => {
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

  const categories = categoryOrder.filter((category) => promptRows.some((row) => normalizeCategory(row.query.category) === category));
  const categoryCoverage = categories.map((category) => {
    const rows = promptRows.filter((row) => normalizeCategory(row.query.category) === category);
    const mentioned = rows.filter((row) => row.hasTarget).length;
    return {
      category,
      total: rows.length,
      mentioned,
      rate: rows.length ? mentioned / rows.length : 0
    };
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

function visibilityScoreRuns(runs: SurfaceRun[], filter: MentionShareSurfaceFilter) {
  if (filter === "gemini") return runs.filter((run) => ["gemini_maps", "gemini_search"].includes(run.surface));
  if (filter === "chatgpt") return runs.filter((run) => run.surface === "chatgpt_search");
  return runs;
}

function mentionShareRuns(runs: SurfaceRun[], filter: MentionShareSurfaceFilter) {
  const surfaces = filter === "gemini" ? ["gemini_maps"] : filter === "chatgpt" ? ["chatgpt_search"] : customerSurfaces;
  return runs.filter((run) => surfaces.includes(run.surface as (typeof customerSurfaces)[number]));
}

function buildPromptMentionRows(payload: ReportPayload, runs: SurfaceRun[]): MentionShareRow[] {
  const targetKey = canonicalCompanyName(payload.company.name);
  const groups = new Map<string, { name: string; queryIds: Set<string>; ranks: number[]; isTarget: boolean }>();

  for (const run of runs) {
    for (const mention of run.mentions) {
      const mentionKey = canonicalCompanyName(mention.companyName);
      const isTarget = mention.isTarget || mentionKey === targetKey;
      const key = isTarget ? "__target" : mentionKey;
      if (!key) continue;

      const existing = groups.get(key);
      if (existing) {
        existing.queryIds.add(run.queryId);
        existing.ranks.push(mention.rank);
        if (!isTarget && mention.companyName.length > existing.name.length) existing.name = mention.companyName;
        continue;
      }

      groups.set(key, {
        name: isTarget ? payload.company.name : mention.companyName,
        queryIds: new Set([run.queryId]),
        ranks: [mention.rank],
        isTarget
      });
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      name: group.name,
      count: group.queryIds.size,
      visibilityRate: payload.report.queries.length ? group.queryIds.size / payload.report.queries.length : 0,
      averageRank: averageNumber(group.ranks),
      isTarget: group.isTarget
    }))
    .sort((a, b) => b.count - a.count || Number(b.isTarget) - Number(a.isTarget) || (a.averageRank ?? 99) - (b.averageRank ?? 99));
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

      groups.set(key, {
        name: isTarget ? payload.company.name : mention.companyName,
        count: 1,
        ranks: [mention.rank],
        isTarget
      });
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

type RadarMetrics = {
  visibility: number;
  promptMention: number;
  topPosition: number;
  topOne: number;
};

type RadarRow = {
  name: string;
  color: string;
  isTarget: boolean;
  metrics: RadarMetrics;
};

function weightedVisibilityScore(metrics: RadarMetrics) {
  return metrics.visibility * 0.5 + metrics.promptMention * 0.25 + metrics.topPosition * 0.15 + metrics.topOne * 0.1;
}

function buildVisibilityRadarRows(payload: ReportPayload): RadarRow[] {
  const runs = mentionShareRuns(payload.report.runs, "all");
  const competitorRows = buildMentionShareRows(payload, runs).filter((row) => !row.isTarget).slice(0, 3);
  const colors = ["#0b3d22", "#ad4d32", "#7b65d1", "#d9a531"];
  const rows = [
    { name: payload.company.name, isTarget: true },
    ...competitorRows.map((row) => ({ name: row.name, isTarget: false }))
  ];

  return rows.map((row, index) => ({
    name: row.name,
    isTarget: row.isTarget,
    color: colors[index] ?? "#6d766f",
    metrics: visibilityMetricsForName(payload, runs, row.name, row.isTarget)
  }));
}

function visibilityMetricsForName(payload: ReportPayload, runs: SurfaceRun[], name: string, isTarget: boolean): RadarMetrics {
  const key = isTarget ? "__target" : canonicalCompanyName(name);
  const queryIds = new Set<string>();
  const ranks: number[] = [];
  let mentions = 0;
  let topThree = 0;
  let topOne = 0;

  for (const run of runs) {
    const mention = run.mentions.find((item) => isTarget ? item.isTarget : canonicalCompanyName(item.companyName) === key);
    if (!mention) continue;
    mentions += 1;
    queryIds.add(run.queryId);
    ranks.push(mention.rank);
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

function radarLabelAnchor(index: number): "start" | "middle" | "end" {
  if (index === 1) return "start";
  if (index === 3) return "end";
  return "middle";
}

function radarPoint(index: number, total: number, value: number, center: number, radius: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return {
    x: center + Math.cos(angle) * radius * value,
    y: center + Math.sin(angle) * radius * value
  };
}

function radarPoints(values: number[], center: number, radius: number) {
  return values.map((value, index) => {
    const point = radarPoint(index, values.length, value, center, radius);
    return point.x + "," + point.y;
  }).join(" ");
}

function targetRank(run?: SurfaceRun) {
  return run?.mentions.find((mention) => mention.isTarget)?.rank ?? null;
}

function averageNumber(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseAdditionalLocations(value: string): Omit<Location, "id">[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [city = line, state = ""] = line.split(",").map((part) => part.trim());
      return {
        label: `${city}${state ? `, ${state}` : ""}`,
        city,
        state,
        isPrimary: false
      };
    });
}

function primaryLocation(company?: Company) {
  return company?.locations.find((location) => location.isPrimary)?.label ?? company?.locations[0]?.label;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

type CompanyReportOption = {
  companyId: string;
  companyName: string;
  location: string;
  reportId: string;
  status: Report["status"];
  createdAt: string;
};

function buildCompanyReportOptions(companies: Company[], reports: Report[]): CompanyReportOption[] {
  return companies
    .map((company) => {
      const companyReports = reports.filter((report) => report.companyId === company.id);
      const report = selectPreferredReport(companyReports);
      if (!report) return null;

      return {
        companyId: company.id,
        companyName: company.name,
        location: primaryLocation(company) ?? "No location",
        reportId: report.id,
        status: report.status,
        createdAt: report.createdAt
      };
    })
    .filter((option): option is CompanyReportOption => Boolean(option))
    .sort((a, b) => {
      const aAllFresh = canonicalCompanyName(a.companyName) === "allfreshtemp" ? 1 : 0;
      const bAllFresh = canonicalCompanyName(b.companyName) === "allfreshtemp" ? 1 : 0;
      if (aAllFresh !== bAllFresh) return aAllFresh - bAllFresh;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}


function selectDefaultReport(reports: Report[], companies: Company[]) {
  const hoffmannCompanies = companies.filter((company) => canonicalCompanyName(company.name).includes("hoffmannbrothers"));
  const formalCompanies = hoffmannCompanies.filter((company) => canonicalCompanyName(company.name).includes("formalrun"));

  const formalReports = reports.filter((report) => formalCompanies.some((company) => company.id === report.companyId));
  const formalReport = selectPreferredReport(formalReports);
  if (formalReport) return formalReport;

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

    const aRuns = a.runs.length;
    const bRuns = b.runs.length;
    if (aRuns !== bRuns) return bRuns - aRuns;

    const aQueries = a.queries.length;
    const bQueries = b.queries.length;
    if (aQueries !== bQueries) return bQueries - aQueries;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
}

function viewTitle(view: View) {
  if (view === "prompts") return "Prompts";
  if (view === "citations") return "Citations";
  if (view === "sentiment") return "Sentiment";
  if (view === "setup") return "Setup";
  return "Overview";
}

function shortSurface(surface: string) {
  if (surface === "gemini_maps") return "Gemini";
  if (surface === "gemini_search") return "Gemini";
  if (surface === "chatgpt_search") return "ChatGPT";
  return SURFACE_LABELS[surface as keyof typeof SURFACE_LABELS] ?? surface;
}

function initials(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "A";
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(value).toLocaleDateString();
}
