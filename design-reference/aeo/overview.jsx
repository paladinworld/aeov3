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

  // Share of voice: brand mentions / (brand + competitor mentions)
  const lb = AEO.visibilityLeaderboard.all;
  const sovTotal = lb.reduce((a, r) => a + r.count, 0);
  const sovBrand = (lb.find((r) => r.isTarget) || { count: 0 }).count;
  const sov = sovTotal ? sovBrand / sovTotal : 0;
  const sovStatus = sov >= 0.2 ? "High" : sov >= 0.1 ? "Medium" : "Low";
  const ordinal = (n) => {const s = ["th", "st", "nd", "rd"],v = n % 100;return n + (s[(v - 20) % 10] || s[v] || s[0]);};
  const sovRank = lb.findIndex((r) => r.isTarget) + 1;
  const sovCount = lb.length;

  // Citation rate: answers citing your domain / answers that cite any source
  const allCited = new Set();
  const brandCited = new Set();
  (cit.domainDetails || []).forEach((d) =>
  (d.urls || []).forEach((u) =>
  (u.prompts || []).forEach((p) => {allCited.add(p);if (d.owned) brandCited.add(p);})));
  const citRate = allCited.size ? brandCited.size / allCited.size : 0;
  const citStatus = citRate >= 0.4 ? "High" : citRate >= 0.2 ? "Medium" : "Low";

  // First mention rate (brand named first / #1 position)
  const fmStatus = m.topOneRate >= 0.2 ? "High" : m.topOneRate >= 0.1 ? "Medium" : "Low";
  const tpStatus = m.topThreeRate >= 0.4 ? "High" : m.topThreeRate >= 0.2 ? "Medium" : "Low";

  const score100 = Math.round(m.visibilityScore * 100);
  const gband = score100 >= 67 ? "High" : score100 >= 34 ? "Medium" : "Low";

  // Key-insight inputs (all data-driven)
  const bestPf = m.surfaceShow.reduce((a, b) => (b.rate > a.rate ? b : a));
  const worstPf = m.surfaceShow.reduce((a, b) => (b.rate < a.rate ? b : a));
  const cats = AEO.categoryCoverage;
  const bestCat = cats.reduce((a, b) => (b.rate > a.rate ? b : a));
  const worstCat = cats.reduce((a, b) => (b.rate < a.rate ? b : a));
  const verdict = gband === "High"
    ? "You're ranking well — AI surfaces you across most relevant searches in your market."
    : gband === "Medium"
    ? "You're showing up about average compared with your competitors, with clear room to climb."
    : "You're below average for your market — AI rarely recommends you when homeowners ask.";

  const topDomains = cit.domainRows.slice(0, 6);

  return (
    <div className="view-stack">
      <p className="page-note" data-comment-anchor="0ae1fe8d2d-p-19-7">
        {AEO.company.location} visibility across {m.totalQueries} HVAC prompts and {m.surfaceShow.length} AI search surfaces.
      </p>
      <p className="bench-note">
        Based on tracked high-intent prompts with multiple queries for accuracy. AI results can vary by platform, session, model, location, and timing. For reference only; not an exact view of what every consumer sees.
      </p>

      <div className="panel score-panel">
        <PanelHead title="AI visibility score" subtitle="How often AI recommends you, overall" />
        <div className="score-body">
          <div className="score-gauge">
            <div className="glegend">
              <span><i className="lo" />Low</span>
              <span><i className="md" />Medium</span>
              <span><i className="hi" />High</span>
            </div>
            <div className="gauge-wrap">
              <Gauge value={score100} />
              <div className="gauge-center">
                <strong>{score100}%</strong>
                <span className={"gpill " + gband.toLowerCase()}>{gband}</span>
              </div>
            </div>
            <p className="gauge-cap">Across {m.totalQueries} tracked prompts</p>
          </div>
          <div className="score-platforms">
            <span className="sp-label">By platform</span>
            <div className="pf-list">
              {m.surfaceShow.map((s) =>
              <div key={s.surface} className="pf-row">
                  <div className="pf-name">{s.label}</div>
                  <div className="pf-bar"><div className="platform-track"><i style={{ width: pct(s.rate) }} /></div><b>{pct(s.rate)}</b></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="metric-grid four">
        <MetricCard label="Share of voice" value={pct(sov)}
        helper={`${ordinal(sovRank)} of ${sovCount} in your market`}
        tooltip="When an AI answer names you or a competitor, how often it names you." />
        <MetricCard label="Citation rate" value={pct(citRate)}
        helper={`${brandCited.size}/${allCited.size} cited answers`}
        tooltip="Of the AI answers that cite sources, how often your site or brand is one of them." />
        <MetricCard label="Top-position rate" value={pct(m.topThreeRate)}
        helper="ranked top 3"
        tooltip="How often you appear in the top 3 companies named in an AI answer." />
        <MetricCard label="First mention rate" value={pct(m.topOneRate)}
        helper="named first"
        tooltip="How often you are the first company named in an AI answer." />
      </section>

      <section className="dashboard-grid">
        <Leaderboard title="Visibility score rank" data={AEO.visibilityLeaderboard} filter={visFilter} setFilter={setVisFilter} mode="vis"
        onMore={() => onNav("competitors")} moreLabel="See all competitors" />
        <Leaderboard title="Share of voice rank" data={AEO.visibilityLeaderboard} filter={pmFilter} setFilter={setPmFilter} mode="sov"
        onMore={() => onNav("competitors")} moreLabel="See all competitors" />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <PanelHead title="Citation domain rank" subtitle="Most-cited sources across answers" />
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

        <div className="panel">
          <PanelHead title="AI visibility score by prompt type" subtitle="How often AI recommends you, by what the homeowner is asking" />
          <div className="cov-list">
            {AEO.categoryCoverage.map((row) =>
            <div key={row.category} className="coverage-row">
                <span>{row.category}</span>
                <Track value={row.rate} tone={band(row.rate, 0.6, 0.34)} />
                <strong>{pct(row.rate)}<small>{row.mentioned}/{row.total}</small></strong>
              </div>
            )}
          </div>
          <button className="text-cta" onClick={() => onNav("prompts")}>See all prompts <Icon name="arrow" size={13} /></button>
        </div>
      </section>
    </div>);

}
window.OverviewView = OverviewView;