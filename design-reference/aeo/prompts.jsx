/* global React, AEO, pct, MetricCard, Badge, RankCell, BestBadge, Icon, shortSurface */
const { useState: useStatePr, useMemo: useMemoPr, useEffect: useEffectPr } = React;

const CUST = ["gemini_maps", "chatgpt_search"];
const INTENT_LABELS = { best: "Best of", near_me: "Near me", emergency: "Emergency", problem: "Problem", review: "Reviews", price: "Pricing", comparison: "Comparison" };

function PromptsView() {
  const rows = AEO.promptRows;
  const m = AEO.metrics;
  const [filter, setFilter] = useStatePr("all");
  const [cat, setCat] = useStatePr("All");
  const [expanded, setExpanded] = useStatePr("");

  const visible = useMemoPr(() => {
    return rows.filter((r) => {
      if (cat !== "All" && r.query.category !== cat) return false;
      if (filter === "ranked" && !r.hasTarget) return false;
      if (filter === "missing" && r.hasTarget) return false;
      return true;
    });
  }, [filter, cat]);

  useEffectPr(() => {
    if (!visible.length) return;
    if (!expanded || !visible.some((r) => r.query.id === expanded)) setExpanded(visible[0].query.id);
  }, [visible]);

  const topCompetitor = AEO.visibilityLeaderboard.all.find((r) => !r.isTarget);

  return (
    <div className="view-stack">
      <section className="metric-grid five">
        <MetricCard label="Total prompts" value={String(m.totalQueries)} helper={`${m.totalQueries * 2} AI checks`} />
        <MetricCard label="You rank in" value={String(m.mentionedQueries)} helper="prompts with a mention" />
        <MetricCard label="Missing" value={String(m.missingQueries)} helper="not ranked anywhere" />
        <MetricCard label="#1 position %" value={pct(m.topOneRate)} helper="ranked #1" />
        <MetricCard label="Top competitor" value={topCompetitor ? topCompetitor.name : "—"} valueSm
        helper={topCompetitor ? pct(topCompetitor.visibilityRate) + " visibility" : ""} />
      </section>

      <section className="panel">
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
      </section>

      <section className="panel">
        <div className="prompt-tools" data-comment-anchor="7cd65de1b1-div-45-9">
          <div className="segmented">
            {[["all", "All"], ["ranked", "Your rank"], ["missing", "Missing"]].map(([k, l]) =>
            <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>{l}</button>
            )}
          </div>
          <span className="sort-note">Sorted by category, then priority</span>
        </div>

        <div className="intent-pills">
          <button className={cat === "All" ? "active" : ""} onClick={() => setCat("All")}>All <span>{m.totalQueries}</span></button>
          {AEO.categoryCoverage.map((row) =>
          <button key={row.category} className={cat === row.category ? "active" : ""} onClick={() => setCat(row.category)}>
              {row.category} <span>{row.total}</span>
            </button>
          )}
        </div>

        <div className="prompt-table">
          <div className="prompt-head">
            <span>Prompt</span><span>Intent</span><span>Gemini</span><span>ChatGPT</span><span>Best</span><span>#1 competitor</span>
          </div>
          {visible.map((row) =>
          <div key={row.query.id} className={"prompt-record" + (expanded === row.query.id ? " open" : "")}>
              <button className="prompt-row" onClick={() => setExpanded(expanded === row.query.id ? "" : row.query.id)}>
                <span className="prompt-text">
                  <i className={"row-chev" + (expanded === row.query.id ? " open" : "")}>›</i>
                  <span className="label">{row.query.text}</span>
                  {row.hasInsight ? <b className="insight-marker">Insight</b> : null}
                </span>
                <span><Badge>{INTENT_LABELS[row.query.intent] || row.query.intent}</Badge></span>
                <span className="cell-center"><RankCell run={row.bySurface.gemini_maps} /></span>
                <span className="cell-center"><RankCell run={row.bySurface.chatgpt_search} /></span>
                <span className="cell-center"><BestBadge rank={row.bestRank} /></span>
                <span className="comp-name">{row.topCompetitor || "—"}</span>
              </button>
              {expanded === row.query.id ? <PromptDetails row={row} /> : null}
            </div>
          )}
          {!visible.length ? <p className="muted" style={{ padding: "20px" }}>No prompts match these filters.</p> : null}
        </div>
      </section>
    </div>);

}

function PromptDetails({ row }) {
  const insightRuns = CUST.map((s) => row.bySurface[s]).filter((r) => r && r.missingInsight);
  return (
    <div className="prompt-details">
      {CUST.map((surface) => {
        const run = row.bySurface[surface];
        return (
          <div key={surface} className="answer-card">
            <div className="answer-top">
              <Badge>{shortSurface(surface)}</Badge>
              <span>{run && run.targetRank ? `You rank #${run.targetRank}` : "You: not ranked"}</span>
            </div>
            <ol>
              {(run ? run.mentions : []).slice(0, 5).map((mn, i) =>
              <li key={i} className={mn.isTarget ? "you" : ""}>{mn.companyName}</li>
              )}
            </ol>
            <p className="answer-excerpt">{run ? truncateTxt(run.rawAnswer, 240) : "No response saved yet."}</p>
          </div>);

      })}

      {insightRuns.length ?
      <div className="answer-card full">
          <div className="answer-top"><Badge tone="others">Missing insight</Badge><span>Why you were not recommended</span></div>
          <div className="missing-list">
            {insightRuns.map((run) =>
          <div key={run.surface} className="missing-row">
                <strong>{shortSurface(run.surface)}</strong>
                <p>{run.missingInsight.answer}</p>
              </div>
          )}
          </div>
        </div> :
      null}

      <div className="answer-card full">
        <div className="answer-top"><Badge>Cited sources</Badge><span>Source citations</span></div>
        {row.citedSources.length ?
        <div className="pc-list">
            {row.citedSources.map((c) =>
          <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="pc-row">
                <span>{c.title}</span>
                <code>{c.url}</code>
                <small>{c.domain} · {c.count}x cited</small>
              </a>
          )}
          </div> :
        <p className="muted">No cited sources were captured for this prompt.</p>}
      </div>
    </div>);

}

function truncateTxt(v, n) {return v.length > n ? v.slice(0, n - 1) + "…" : v;}

window.PromptsView = PromptsView;