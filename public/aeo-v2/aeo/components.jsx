/* global React */
const { useState, useMemo, useEffect } = React;

/* ── formatting helpers ── */
const pct = (v) => `${Math.round(v * 100)}%`;
const signed = (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
const shortSurface = (s) => (s && s.startsWith("chatgpt") ? "ChatGPT" : "Gemini");
const band = (v, hi, md) => (v >= hi ? "High" : v >= md ? "Medium" : "Low");

/* ── Lucide icons (strokeWidth 2) ── */
const ICONS = {
  home: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  prompts: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  citations: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  sentiment: "M3 3v18h18M19 9l-5 5-4-4-3 3",
  competitors: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  setup: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  copy: "M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 5L2 7",
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
  arrow: "M5 12h14M12 5l7 7-7 7",
  chevron: "M9 18l6-6-6-6",
  chevdown: "M6 9l6 6 6-6",
};
function Icon({ name, size = 16, cls = "" }) {
  return (
    <svg className={cls} xmlns="http://www.w3.org/2000/svg" width={size} height={size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].split("M").filter(Boolean).map((d, i) => <path key={i} d={"M" + d} />)}
    </svg>
  );
}

/* ── primitives ── */
function Badge({ children, tone }) {
  return <span className={"badge" + (tone ? " " + tone.toLowerCase() : "")}>{children}</span>;
}
function Track({ value, tone }) {
  return <div className={"track" + (tone ? " " + tone.toLowerCase() : "")}><i style={{ width: `${Math.max(2, Math.round(value * 100))}%` }} /></div>;
}
function RankCell({ run }) {
  if (!run) return <span className="dash">—</span>;
  const r = run.targetRank;
  return r ? <span className={"rank-pill" + (r === 1 ? " one" : "")}>#{r}</span> : <span className="missing-pill">Missing</span>;
}
function BestBadge({ rank }) {
  return rank ? <span className={"rank-pill" + (rank === 1 ? " one" : "")}>#{rank}</span> : <span className="missing-pill">Missing</span>;
}

function MetricCard({ label, value, helper, status, tooltip, valueSm, children }) {
  return (
    <div className="metric-card">
      <span className="metric-label">
        {label}
        {tooltip ? <i className="info-dot" tabIndex={0}>i<em>{tooltip}</em></i> : null}
      </span>
      {children ? children : (
        <div className="metric-value">
          <strong className={valueSm ? "sm" : ""}>{value}</strong>
          {status ? <i className={"status-pill " + status.toLowerCase()}>{status}</i> : null}
        </div>
      )}
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}
function PanelHead({ title, subtitle, right }) {
  return (
    <div className={right ? "controls-head" : "panel-head"}>
      <h2>{title}</h2>
      {subtitle ? <span className="sub">{subtitle}</span> : null}
      {right || null}
    </div>
  );
}

/* ── Leaderboard ── */
function Leaderboard({ title, data, filter, setFilter, mode }) {
  const rows = data[filter] || [];
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  const top = rows.slice(0, 10);
  const targetRow = rows.find((r) => r.isTarget);
  const pinned = targetRow && !top.some((r) => r.isTarget);
  const visible = pinned ? [...top, targetRow] : top;
  const bandOf = mode === "vis" ? (v) => band(v, 0.3, 0.2) : (v) => (v > 0.4 ? "High" : v >= 0.2 ? "Medium" : "Low");
  const unit = mode === "vis" ? "checks" : "prompts";
  return (
    <div className="panel">
      <PanelHead title={title} right={
        <div className="segmented">
          {["all", "gemini", "chatgpt"].map((f) => (
            <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "gemini" ? "Gemini" : "ChatGPT"}
            </button>
          ))}
        </div>
      } />
      <div className="lb-list">
        {visible.map((r, i) => (
          <div key={r.name + i} className={"lb-row" + (r.isTarget ? " you" : "")}>
            {pinned && r.isTarget ? <small className="your-pos">Your position</small> : null}
            <div className="who"><strong>{r.name}</strong><span>{r.isTarget ? "You" : "Competitor"}</span></div>
            <Track value={r.count / maxCount} tone={bandOf(r.visibilityRate)} />
            <b>{pct(r.visibilityRate)}</b>
            <small>{r.count} {unit}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Radar ── */
function radarPoint(i, total, value, c, rad) {
  const a = -Math.PI / 2 + (Math.PI * 2 * i) / total;
  return { x: c + Math.cos(a) * rad * value, y: c + Math.sin(a) * rad * value };
}
function radarPoints(vals, c, rad) {
  return vals.map((v, i) => { const p = radarPoint(i, vals.length, v, c, rad); return `${p.x},${p.y}`; }).join(" ");
}
function VisibilityRadar({ rows }) {
  const axes = [
    { key: "visibility", label: "Visibility score" },
    { key: "topOne", label: "#1 position %" },
    { key: "promptMention", label: "Prompts mentioning you" },
    { key: "topPosition", label: "Top-position rate" },
  ];
  const c = 130, rad = 92, rings = [0.25, 0.5, 0.75, 1];
  const anchor = (i) => (i === 1 ? "start" : i === 3 ? "end" : "middle");
  return (
    <div className="panel radar-panel wide-panel">
      <PanelHead title="AI visibility radar" subtitle="You vs top competitors" />
      <div className="panel-body">
        <div className="radar-layout">
          <svg className="radar-chart" viewBox="-84 -22 424 304" role="img" aria-label="AI visibility radar">
            {rings.map((r) => <polygon key={r} points={radarPoints(axes.map(() => r), c, rad)} className="radar-ring" />)}
            {axes.map((ax, i) => {
              const p = radarPoint(i, axes.length, 1, c, rad);
              const l = radarPoint(i, axes.length, 1.22, c, rad);
              return (
                <g key={ax.key}>
                  <line x1={c} y1={c} x2={p.x} y2={p.y} className="radar-axis" />
                  <text x={l.x} y={l.y} textAnchor={anchor(i)} dominantBaseline="middle">{ax.label}</text>
                </g>
              );
            })}
            {rows.slice().reverse().map((row) => (
              <polygon key={row.name} points={radarPoints(axes.map((a) => row.metrics[a.key]), c, rad)}
                className={"radar-shape " + (row.isTarget ? "target" : "competitor")}
                style={{ "--radar-color": row.color }} />
            ))}
          </svg>
          <div className="radar-legend">
            <h3>AI visibility score</h3>
            {rows.map((row) => (
              <div key={row.name} className={row.isTarget ? "you" : ""}>
                <i style={{ background: row.color }} />
                <span title={row.name}>{row.name}</span>
                <strong>{pct(row.metrics.visibility)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { pct, signed, shortSurface, band, Icon, Badge, Track, RankCell, BestBadge, MetricCard, PanelHead, Leaderboard, VisibilityRadar });
