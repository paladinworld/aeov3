import Link from "next/link";
import { notFound } from "next/navigation";
import { summarizeReport } from "@/lib/scoring";
import { readDb } from "@/lib/store";
import { Report, SurfaceRun } from "@/lib/types";
import { ShareReportActions } from "./ShareReportActions";

type ShareReportPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShareReportPage({ params }: ShareReportPageProps) {
  const { id } = await params;
  const db = await readDb();
  const report = db.reports.find((item) => item.id === id);

  if (!report) notFound();

  const company = db.companies.find((item) => item.id === report.companyId);
  if (!company) notFound();

  const summary = summarizeReport(report);
  const location = company.locations.find((item) => report.locationIds.includes(item.id)) ?? company.locations[0];
  const promptStats = buildPromptStats(report);
  const visibilityScore = weightedVisibilityScore({
    mentionRate: summary.mentionRate,
    promptCoverage: promptStats.promptCoverage,
    topThreeRate: summary.topThreeRate,
    topOneRate: promptStats.topOneRate
  });
  const topWins = promptStats.promptRows
    .filter((row) => row.bestRank)
    .sort((a, b) => (a.bestRank ?? 99) - (b.bestRank ?? 99))
    .slice(0, 5);
  const missedPrompts = promptStats.promptRows
    .filter((row) => !row.hasTarget)
    .slice(0, 5);

  return (
    <main className="share-report">
      <header className="share-report-hero">
        <div>
          <Link href="/" className="share-back no-print">Netic AI Visibility Insights</Link>
          <p>Executive AI Visibility Snapshot</p>
          <h1>{company.name}</h1>
          <span>{location?.label ?? "Primary market"} · HVAC visibility audit</span>
        </div>
        <ShareReportActions companyName={company.name} reportId={report.id} />
      </header>

      <section className="share-summary-card">
        <div>
          <span>Visibility Score</span>
          <strong>{percent(visibilityScore)}</strong>
          <p>{scoreLabel(visibilityScore)} visibility across tracked high-intent prompts.</p>
        </div>
        <div>
          <span>Prompts Mentioning You</span>
          <strong>{percent(promptStats.promptCoverage)}</strong>
          <p>{promptStats.mentionedPrompts}/{promptStats.totalPrompts} prompts mention the company.</p>
        </div>
        <div>
          <span>Top-Position Rate</span>
          <strong>{percent(summary.topThreeRate)}</strong>
          <p>Ranked top 3 across AI checks.</p>
        </div>
        <div>
          <span>#1 Position</span>
          <strong>{percent(promptStats.topOneRate)}</strong>
          <p>Ranked first in tracked AI answers.</p>
        </div>
      </section>

      <section className="share-grid">
        <article className="share-panel">
          <h2>What this means</h2>
          <p>
            {company.name} is visible in {percent(promptStats.promptCoverage)} of tracked prompts, with a top-3 rate of {percent(summary.topThreeRate)}.
            The fastest improvement path is usually to strengthen the exact prompts where competitors are repeatedly recommended and to build presence on citation sources AI already trusts.
          </p>
        </article>

        <article className="share-panel">
          <h2>Top competitors mentioned</h2>
          <ul className="share-list">
            {summary.competitorCounts.slice(0, 5).map((row) => (
              <li key={row.name}><span>{row.name}</span><strong>{row.count}</strong></li>
            ))}
          </ul>
        </article>
      </section>

      <section className="share-grid">
        <article className="share-panel">
          <h2>Prompts where you rank</h2>
          <ul className="share-list prompt-list">
            {topWins.length ? topWins.map((row) => (
              <li key={row.queryId}>
                <span>{row.queryText}</span>
                <strong>#{row.bestRank}</strong>
              </li>
            )) : <li><span>No ranked prompts captured yet.</span></li>}
          </ul>
        </article>

        <article className="share-panel">
          <h2>Prompts to improve</h2>
          <ul className="share-list prompt-list">
            {missedPrompts.length ? missedPrompts.map((row) => (
              <li key={row.queryId}><span>{row.queryText}</span></li>
            )) : <li><span>No missing prompts captured.</span></li>}
          </ul>
        </article>
      </section>

      <section className="share-panel">
        <h2>Top citation domains</h2>
        <ul className="share-list citation-list">
          {summary.citationCounts.slice(0, 8).map((row) => (
            <li key={row.name}><span>{row.name}</span><strong>{row.count}</strong></li>
          ))}
        </ul>
      </section>

      <footer className="share-note">
        Based on tracked high-intent prompts with multiple queries for accuracy. AI results can vary by platform, session, model, location, and timing. For reference only; not an exact view of what every consumer sees.
      </footer>
    </main>
  );
}

function buildPromptStats(report: Report) {
  const promptRows = report.queries.map((query) => {
    const runs = report.runs.filter((run) => run.queryId === query.id && !run.rawAnswer.startsWith("Provider error:"));
    const ranks = runs
      .map((run) => targetRank(run))
      .filter((rank): rank is number => Boolean(rank));

    return {
      queryId: query.id,
      queryText: query.text,
      hasTarget: ranks.length > 0,
      bestRank: ranks.length ? Math.min(...ranks) : null
    };
  });
  const totalPrompts = promptRows.length;
  const mentionedPrompts = promptRows.filter((row) => row.hasTarget).length;
  const topOneRuns = report.runs.filter((run) => targetRank(run) === 1).length;

  return {
    promptRows,
    totalPrompts,
    mentionedPrompts,
    promptCoverage: totalPrompts ? mentionedPrompts / totalPrompts : 0,
    topOneRate: report.runs.length ? topOneRuns / report.runs.length : 0
  };
}

function targetRank(run: SurfaceRun) {
  return run.mentions.find((mention) => mention.isTarget)?.rank ?? null;
}

function weightedVisibilityScore(metrics: {
  mentionRate: number;
  promptCoverage: number;
  topThreeRate: number;
  topOneRate: number;
}) {
  return metrics.mentionRate * 0.5 + metrics.promptCoverage * 0.25 + metrics.topThreeRate * 0.15 + metrics.topOneRate * 0.1;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function scoreLabel(value: number) {
  if (value >= 0.3) return "High";
  if (value >= 0.2) return "Medium";
  return "Low";
}
