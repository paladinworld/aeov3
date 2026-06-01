/* global React, AEO, pct, MetricCard, PanelHead, Track, Leaderboard, VisibilityRadar, Badge, BestBadge, Icon, band */
const { useState: useStateOv } = React;

function OverviewView({ onNav }) {
  const m = AEO.metrics;
  const [visFilter, setVisFilter] = useStateOv("all");
  const [pmFilter, setPmFilter] = useStateOv("all");
  const cit = AEO.citationStats;

  const visStatus = band(m.visibilityScore, 0.3, 0.2);
  const pmStatus = m.promptMentionRate > 0.4 ? "High" : m.promptMentionRate >= 0.2 ? "Medium" : "Low";
  const t3Status = m.topThreeRate > 0.2 ? "High" : m.topThreeRate >= 0.1 ? "Medium" : "Low";
  const t1Status = m.topOneRate > 0.1 ? "High" : m.topOneRate >= 0.05 ? "Medium" : "Low";

  const topDomains = cit.domainRows.slice(0, 6);

  return (
    <div className="view-stack">
      <p className="page-note" data-comment-anchor="0ae1fe8d2d-p-19-7">
        {AEO.company.location} visibility across {m.totalQueries} HVAC prompts and {m.surfaceShow.length} AI search surfaces.
      </p>
      <p className="bench-note">
        Based on tracked high-intent prompts with multiple queries for accuracy. AI results can vary by platform, session, model, location, and timing.
        <br />For reference only; not an exact view of what every consumer sees.
      </p>

      <section className="metric-grid five">
        <MetricCard label="Visibility score" value={pct(m.visibilityScore)} status={visStatus}
        tooltip="Weighted score based on how often your company appears, how many tracked prompts mention you, and how often you rank near the top." />
        <MetricCard label="Prompts mentioning you" value={pct(m.promptMentionRate)} status={pmStatus}
        helper={`${m.mentionedQueries}/${m.totalQueries} (${m.missingQueries} missing)`} />
        <MetricCard label="Top-position rate" value={pct(m.topThreeRate)} status={t3Status} helper="ranked top 3" />
        <MetricCard label="#1 position %" value={pct(m.topOneRate)} status={t1Status} helper="ranked #1" />
        <MetricCard label="Where you show up">
          <div className="surface-mini">
            {m.surfaceShow.map((s) =>
            <div key={s.surface} className="surface-mini-row">
                <span>{s.label}</span>
                <Track value={s.rate} tone={band(s.rate, 0.6, 0.3)} />
                <b>{pct(s.rate)}</b>
              </div>
            )}
          </div>
        </MetricCard>
      </section>

      <section className="dashboard-grid">
        <VisibilityRadar rows={AEO.radarRows} />

        <div className="panel">
          <PanelHead title="Category coverage" subtitle="Where you appear by prompt category" />
          <div className="panel-body">
            <div className="coverage">
              {AEO.categoryCoverage.map((row) =>
              <div key={row.category} className="coverage-row">
                  <span>{row.category}</span>
                  <Track value={row.rate} tone={band(row.rate, 0.6, 0.34)} />
                  <strong>{pct(row.rate)}<small>{row.mentioned}/{row.total}</small></strong>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <PanelHead title="Citation domains" subtitle="Most-cited sources across answers" />
          <div>
            {topDomains.map((row) =>
            <div key={row.domain} className="rank-row">
                <span className="lhs"><b>{row.domain}</b><Badge tone={row.type}>{row.type}</Badge></span>
                <strong>{row.count}</strong>
              </div>
            )}
          </div>
          <button className="text-cta" onClick={() => onNav("citations")}>See all citations <Icon name="arrow" size={13} /></button>
        </div>

        <Leaderboard title="Visibility score leaderboard" data={AEO.visibilityLeaderboard} filter={visFilter} setFilter={setVisFilter} mode="vis" />
        <Leaderboard title="Prompt mention leaderboard" data={AEO.promptLeaderboard} filter={pmFilter} setFilter={setPmFilter} mode="prompt" />

        <div className="panel top-prompts-panel wide-panel">
          <PanelHead title="Prompts where you rank" subtitle="Your top 5 wins" />
          <div className="tp-table">
            <div className="tp-head"><span>Prompt</span><span>Best rank</span><span>Platforms</span></div>
            {AEO.topWins.map((row) =>
            <div key={row.query.id} className="tp-row">
                <span className="tp-text"><b>{row.query.text}</b><Badge>{row.query.category}</Badge></span>
                <span><BestBadge rank={row.bestRank} /></span>
                <strong>{row.platformCount}/2</strong>
              </div>
            )}
          </div>
          <button className="text-cta" onClick={() => onNav("prompts")}>See all {m.totalQueries} prompts <Icon name="arrow" size={13} /></button>
        </div>
      </section>
    </div>);

}
window.OverviewView = OverviewView;