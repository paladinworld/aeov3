/* global React, AEO, pct, signed, MetricCard, PanelHead, Track, Badge */
const { useState: useStateCS } = React;

function CitationsView() {
  const cit = AEO.citationStats;
  const [expanded, setExpanded] = useStateCS(cit.domainDetails[0] ? cit.domainDetails[0].domain : "");
  return (
    <div className="view-stack">
      <p className="page-note">
        Citation stats use the sources AI cites as supporting authority. Platform sources are directories, review sites, trust profiles, and editorial lists; competitor sources are other HVAC company websites.
      </p>

      <section className="metric-grid four">
        <MetricCard label="Unique sources" value={String(cit.uniqueSources)} helper="real citation domains" />
        <MetricCard label="Total citations" value={String(cit.totalCitations)} helper="counted once per run" />
        <MetricCard label="Your citation share" value={pct(cit.ownedShare)} status={cit.ownedShare >= 0.15 ? "Medium" : "Low"} helper={`${cit.ownedCitations} owned citations`} />
        <MetricCard label="Platform source share" value={pct(cit.platformShare)} helper="directories, reviews, editorial" />
      </section>

      <section className="panel">
        <PanelHead title="Where AI gets its answers" subtitle="Citation volume by source type" />
        <div className="panel-body">
          <div className="coverage">
            {cit.typeRows.map((row) =>
            <div key={row.type} className={"coverage-row citation-type-row " + row.type.toLowerCase()}>
                <span>{row.type}</span>
                <Track value={row.share} />
                <strong>{row.count}<small>{pct(row.share)}</small></strong>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <PanelHead title="Top cited domains" subtitle="Expand a domain to see the exact cited pages" />
        <div className="src-table">
          <div className="src-head"><span>Domain</span><span>Type</span><span>Citations</span><span>Share</span></div>
          {cit.domainDetails.map((row) => {
            const open = expanded === row.domain;
            return (
              <div key={row.domain} className="dom-group">
                <button className={"dom-row" + (open ? " expanded" : "")} onClick={() => setExpanded(open ? "" : row.domain)}>
                  <strong><i>{open ? "⌄" : "›"}</i>{row.domain}</strong>
                  <span><Badge tone={row.type}>{row.type}</Badge></span>
                  <span>{row.count}</span>
                  <span>{pct(row.share)}</span>
                </button>
                {open ?
                <div className="url-list">
                    {row.urls.length ? row.urls.map((u) =>
                  <a key={u.key} href={u.url} target="_blank" rel="noreferrer" className="url-row">
                        <div className="u-main">
                          <strong>{u.title}</strong>
                          <code>{u.url}</code>
                          <p>{u.prompts.slice(0, 3).join(" · ")}</p>
                        </div>
                        <span>{u.count}x cited</span>
                        <span>{u.promptCount} prompts</span>
                      </a>
                  ) : <p className="muted" style={{ padding: "8px 0" }}>No exact URLs were captured for this domain.</p>}
                  </div> :
                null}
              </div>);

          })}
        </div>
      </section>
    </div>);

}

function SentimentView() {
  const s = AEO.sentiment;
  const leftPct = Math.round((s.score + 1) * 50);
  return (
    <div className="view-stack">
      <section className="sentiment-hero">
        <span className="ov">Overall AI sentiment — {s.label}</span>
        <strong className="sentiment-score">{signed(s.score)}</strong>
        <div className="sent-meter" data-comment-anchor="b3d0688fb2-div-81-9"><i style={{ left: `${leftPct}%` }}>{signed(s.score)}</i></div>
        <div className="sent-scale"><span>Negative (−1)</span><span>Neutral (0)</span><span>Positive (+1)</span></div>
      </section>

      <section className="dashboard-grid">
        <ThemePanel title="What AI says that's working" subtitle="Recurring positive themes in mentions" rows={s.working} positive />
        <ThemePanel title="What AI says that's hurting" subtitle="Recurring negative themes in AI language" rows={s.hurting} />
      </section>

      <section className="panel">
        <PanelHead title="Competitor language to beat" subtitle="Most repeated proof points from top competitors" />
        <div className="comp-quote-grid">
          {s.competitorThemes.map((c) =>
          <div key={c.name} className="comp-quote-card">
              <h3>{c.name}</h3>
              <span>{c.mentions} mentions</span>
              {c.themes.map((t) =>
            <div key={t.phrase} className="ct"><span>{t.phrase}</span><small>{t.count}x</small></div>
            )}
            </div>
          )}
        </div>
      </section>
    </div>);

}

function ThemePanel({ title, subtitle, rows, positive }) {
  return (
    <div className={"panel theme-panel " + (positive ? "positive" : "negative")}>
      <PanelHead title={title} subtitle={subtitle} />
      <div>
        {rows.length ? rows.map((row) =>
        <div key={row.phrase} className="theme-block">
            <span className="theme-mark">{positive ? "✓" : "!"}</span>
            <em>{row.phrase}</em>
            <small>{row.count}x mentioned</small>
            <strong>{signed(row.score)}</strong>
          </div>
        ) : <p className="muted" style={{ padding: "16px 20px" }}>Not enough direct AI language yet.</p>}
      </div>
    </div>);

}

Object.assign(window, { CitationsView, SentimentView });