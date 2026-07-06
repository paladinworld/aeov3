"use client";

import { CSSProperties, Fragment, useEffect, useMemo, useState } from "react";

// Market-level report view: no target company. Leads with an AI Visibility Rank leaderboard
// (average position per platform), then share-of-voice, then a prompt-by-prompt breakdown with
// an SEO column. Rendered by app/page.tsx when the report has `market: true`.

const AI_SURFACES = ["gemini_search", "google_ai_overview", "chatgpt_search"] as const;
const ENGINE_COLS = [
  { key: "gemini_search", label: "Gemini", cls: "G" },
  { key: "google_ai_overview", label: "AI Mode", cls: "AM" },
  { key: "chatgpt_search", label: "ChatGPT", cls: "CG" },
] as const;

// Rank-leaderboard columns, in the requested order.
const RANK_COLS = [
  { key: "overall", label: "Overall AI", kind: "rank" },
  { key: "chatgpt", label: "ChatGPT", kind: "rank" },
  { key: "gemini", label: "Gemini", kind: "rank" },
  { key: "aiMode", label: "AI Mode", kind: "rank" },
  { key: "seo", label: "SEO", kind: "rank" },
  { key: "rating", label: "GBP ★", kind: "rating" },
  { key: "reviews", label: "Reviews", kind: "count" },
] as const;
type RankKey = (typeof RANK_COLS)[number]["key"];

type Mention = { companyName?: string; rank?: number };
type Run = { queryId: string; surface: string; rawAnswer?: string; mentions?: Mention[] };
type SerpListing = { rank: number; title: string; domain: string; url: string; isDirectory: boolean };
type Query = { id: string; text: string; category: string };
type Report = {
  id: string; vertical?: string; market?: boolean; repeatRuns: number;
  queries: Query[]; runs: Run[]; serp?: Record<string, { organic: SerpListing[]; localPack: SerpListing[] }>;
  gbp?: Array<{ name: string; rating: number | null; reviews: number | null }>;
};
type Company = { name: string; locations: Array<{ city: string; state: string; isPrimary?: boolean }> };
type Payload = { report: Report; company: Company };

type Ranked = { name: string; count: number; avgRank: number | null };
type PromptRow = { id: string; text: string; engines: Record<string, Ranked[]>; seo: Array<{ company: string; rank: number }> };
type RankRow = { name: string; overall: number | null; gemini: number | null; aiMode: number | null; chatgpt: number | null; seo: number | null; rating: number | null; reviews: number | null };

const isReal = (r: Run) => !String(r.rawAnswer || "").startsWith("Provider error:");

const GENERIC = new Set([
  "air", "heating", "cooling", "hvac", "plumbing", "electrical", "electric", "conditioning", "conditioner",
  "services", "service", "company", "co", "inc", "llc", "the", "and", "of", "home", "comfort", "heat",
  "systems", "solutions", "mechanical", "repair", "installation",
  // Weak descriptors — too common as substrings to identify a brand (e.g. "cool" ⊂ coolmenow).
  "cool", "climate", "pro", "pros", "best", "top", "local", "expert", "experts", "quality", "affordable",
  "guys", "masters", "specialist", "specialists", "temperature", "temp", "breeze", "aire",
]);
const US_STATES: Record<string, string> = { AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california", CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia", HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa", KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland", MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi", MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada", NH: "newhampshire", NJ: "newjersey", NM: "newmexico", NY: "newyork", NC: "northcarolina", ND: "northdakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania", RI: "rhodeisland", SC: "southcarolina", SD: "southdakota", TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont", VA: "virginia", WA: "washington", WV: "westvirginia", WI: "wisconsin", WY: "wyoming", DC: "districtofcolumbia" };
const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function MarketReport({ reportId, token }: { reportId: string; token: string | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<RankKey>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const url = `/api/reports/${reportId}${token ? `?t=${encodeURIComponent(token)}` : ""}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((p: Payload) => setData(p))
      .catch((e) => setError(e.message));
  }, [reportId, token]);

  const model = useMemo(() => (data ? buildModel(data) : null), [data]);

  const sortedRank = useMemo(() => {
    if (!model) return [];
    return [...model.rankBoard].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // missing always last
      if (bv == null) return -1;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [model, sortKey, sortDir]);

  if (error) return <div className="mr-state">Couldn’t load this report ({error}).</div>;
  if (!model) return <div className="mr-state">Loading market report…</div>;

  const { market, vertical, totals, leaderboard, prompts, seoDirectoryShare } = model;
  const pct = (n: number) => Math.round((100 * n) / (totals.aiRuns || 1));
  const clickSort = (k: RankKey) => {
    if (k === sortKey) { setSortDir(sortDir === "asc" ? "desc" : "asc"); return; }
    const col = RANK_COLS.find((c) => c.key === k);
    setSortKey(k);
    setSortDir(col && col.kind !== "rank" ? "desc" : "asc"); // ranks: low is best (asc); rating/reviews: high is best (desc)
  };
  const cellFor = (v: number | null, kind: string) => {
    if (v == null) return <span className="mr-missing">{kind === "rank" ? "missing" : "—"}</span>;
    if (kind === "rating") return <span className="tnum">{v.toFixed(1)}★</span>;
    if (kind === "count") return <span className="tnum">{v.toLocaleString()}</span>;
    return <span className="tnum">#{v}</span>;
  };
  // Rank heatmap — one Netic-green hue, intensity by position (#1 strongest, fading out by ~#20).
  const shadeFor = (v: number | null): CSSProperties | undefined => {
    if (v == null) return undefined;
    const mix = Math.round(Math.max(0, 1 - (v - 1) / 20) * 30);
    return mix > 0 ? { background: `color-mix(in oklab, var(--primary) ${mix}%, transparent)` } : undefined;
  };

  return (
    <div className="mr">
      <style>{STYLES}</style>

      <header className="mr-head">
        <div className="mr-head-main">
          <span className="mr-eyebrow">AI Search Visibility · Market Report</span>
          <h1>Who AI recommends for <em>{vertical}</em> in {market}</h1>
        </div>
        <div className="mr-toggles">
          <label>Market<select defaultValue={market} aria-label="Market"><option>{market}</option></select></label>
          <label>Vertical<select defaultValue={vertical} aria-label="Vertical"><option>{vertical}</option></select></label>
        </div>
      </header>

      <section className="mr-stats">
        <div className="mr-stat"><span className="mr-stat-n tnum">{totals.companiesNamed}</span><span className="mr-stat-l">companies named by AI</span></div>
        <div className="mr-stat"><span className="mr-stat-n tnum">{totals.prompts}</span><span className="mr-stat-l">head prompts × {totals.repeats} runs</span></div>
        <div className="mr-stat"><span className="mr-stat-n tnum">{seoDirectoryShare}%</span><span className="mr-stat-l">of top organic results are directories, not companies</span></div>
      </section>

      {/* 1 — AI Visibility Rank leaderboard */}
      <section className="mr-block">
        <div className="mr-block-head">
          <h2>AI visibility rank</h2>
          <p>Each company’s competitive <strong>position</strong> on each platform — #1 = most visible. Ranked by a blended visibility score (mention rate, coverage, top-3 &amp; top-1 finishes), with <strong>Overall AI</strong> weighting Gemini 50% / AI&nbsp;Mode 30% / ChatGPT 20% — the same method as the company report. <strong>“Missing”</strong> = never named there (which drags Overall down). <strong>Click a column</strong> to sort.</p>
        </div>
        <div className="mr-table-wrap">
          <table className="mr-rank">
            <thead>
              <tr>
                <th className="mr-th-co">Company</th>
                {RANK_COLS.map((c) => (
                  <th key={c.key} className={`mr-th-sort ${sortKey === c.key ? "mr-active" : ""}`} onClick={() => clickSort(c.key)}>
                    {c.label}<span className="mr-caret">{sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRank.map((r, i) => (
                <tr key={r.name} className={i === 0 ? "mr-r-lead" : ""}>
                  <td className="mr-td-co" title={r.name}>{r.name}</td>
                  {RANK_COLS.map((col) => (
                    <td key={col.key} style={col.kind === "rank" ? shadeFor(r[col.key]) : undefined} className={`${col.key === "seo" ? "mr-seo-col " : ""}${sortKey === col.key ? "mr-active-cell" : ""}`}>{cellFor(r[col.key], col.kind)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2 — Share of voice */}
      <section className="mr-block">
        <div className="mr-block-head">
          <h2>AI share of voice</h2>
          <p>How <em>often</em> each company is named — the share of all {totals.aiRuns} AI answers that mention them. The colored split shows which engine drives it.</p>
        </div>
        <div className="mr-legend">
          {ENGINE_COLS.map((e) => <span key={e.key} className="mr-legend-item"><i className={`mr-dot mr-${e.cls}`} />{e.label}</span>)}
          <span className="mr-legend-scale">bar = % of AI answers · axis 0–100%</span>
        </div>
        <ol className="mr-board">
          {leaderboard.map((c, i) => (
            <li key={c.name} className={i === 0 ? "mr-row mr-lead" : "mr-row"}>
              <span className="mr-rank tnum">{i + 1}</span>
              <span className="mr-name" title={c.name}>{c.name}</span>
              <span className="mr-bar-track">
                <span className="mr-bar mr-G" style={{ width: `${pct(c.gemini)}%` }} title={`Gemini ${pct(c.gemini)}%`} />
                <span className="mr-bar mr-AM" style={{ width: `${pct(c.aiMode)}%` }} title={`AI Mode ${pct(c.aiMode)}%`} />
                <span className="mr-bar mr-CG" style={{ width: `${pct(c.chatgpt)}%` }} title={`ChatGPT ${pct(c.chatgpt)}%`} />
              </span>
              <span className="mr-sov tnum">{pct(c.total)}%</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 3 — Prompt-by-prompt (expandable) */}
      <section className="mr-block">
        <div className="mr-block-head">
          <h2>Prompt-by-prompt: AI engines vs. traditional SEO</h2>
          <p>Each head term shows the company each engine names first, plus the top company website in Google’s organic results (directories excluded). <strong>Click any prompt</strong> to expand the top 5 per platform.</p>
        </div>
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead>
              <tr>
                <th className="mr-th-prompt">Prompt</th>
                <th>Gemini</th><th>AI Mode</th><th>ChatGPT</th>
                <th className="mr-th-seo">SEO <span>(organic)</span></th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((p) => {
                const isOpen = open === p.id;
                const cell = (label: string) => { const r = p.engines[label]?.[0]; return r ? <span className="mr-cell-name">{r.name}</span> : <span className="mr-none">—</span>; };
                return (
                  <Fragment key={p.id}>
                    <tr className={isOpen ? "mr-prow mr-open" : "mr-prow"} onClick={() => setOpen(isOpen ? null : p.id)}>
                      <td className="mr-td-prompt"><span className={`mr-chev ${isOpen ? "mr-chev-open" : ""}`}>▸</span>{p.text}</td>
                      <td>{cell("Gemini")}</td>
                      <td>{cell("AI Mode")}</td>
                      <td>{cell("ChatGPT")}</td>
                      <td className="mr-td-seo">{p.seo[0] ? <><span className="mr-cell-name">{p.seo[0].company}</span><span className="mr-cell-rank tnum">#{p.seo[0].rank}</span></> : <span className="mr-none">directories only</span>}</td>
                    </tr>
                    {isOpen && (
                      <tr className="mr-detail-row">
                        <td colSpan={5}>
                          <div className="mr-detail">
                            {ENGINE_COLS.map((e) => (
                              <div key={e.key} className="mr-detail-col">
                                <div className={`mr-detail-h mr-h-${e.cls}`}>{e.label} — top 5</div>
                                <ol>{(p.engines[e.label] || []).slice(0, 5).map((r, idx) => (
                                  <li key={r.name}><span className="mr-di-rank tnum">{idx + 1}</span><span className="mr-di-name">{r.name}</span><span className="mr-di-meta tnum">named {r.count}× · avg pos {r.avgRank ?? "–"}</span></li>
                                ))}{!(p.engines[e.label] || []).length && <li className="mr-none">no companies named</li>}</ol>
                              </div>
                            ))}
                            <div className="mr-detail-col">
                              <div className="mr-detail-h mr-h-SEO">SEO — top 5 company sites</div>
                              <ol>{p.seo.slice(0, 5).map((s) => (
                                <li key={s.company + s.rank}><span className="mr-di-rank tnum">{s.rank}</span><span className="mr-di-name">{s.company}</span></li>
                              ))}{!p.seo.length && <li className="mr-none">organic top results are all directories</li>}</ol>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mr-foot">Netic · AI Search Visibility — market-level report. Rankings reflect {totals.repeats} runs per prompt across Gemini, Google AI Mode, and ChatGPT. SEO column matches companies to Google organic results by brand name.</footer>
    </div>
  );
}

function buildModel(data: Payload) {
  const { report, company } = data;
  const primary = company.locations.find((l) => l.isPrimary) ?? company.locations[0];
  const place = primary ? `${primary.city}, ${primary.state}` : "";
  const placeStop = new Set([
    ...(primary ? primary.city.toLowerCase().split(/[^a-z0-9]+/g) : []),
    (primary?.state || "").toLowerCase(),
    US_STATES[(primary?.state || "").toUpperCase()] || "",
  ].filter(Boolean));
  const tokensOf = (name: string): string[] =>
    (name || "").toLowerCase().split(/[^a-z0-9]+/g).filter((t) => t.length >= 3 && !GENERIC.has(t) && !placeStop.has(t));
  const isDomainLike = (n: string) => /(^https?:)|([a-z0-9-]+\.(com|net|org|io|co|us|biz|info))/i.test(n) || (!/\s/.test(n) && n.includes("."));
  const canonKey = (name: string) => { const t = tokensOf(name); return t.length ? t.join("") : norm(name); };

  // Runs grouped by AI engine (real answers only).
  const surfaceRuns: Record<string, Run[]> = { gemini_search: [], google_ai_overview: [], chatgpt_search: [] };
  for (const run of report.runs) if (AI_SURFACES.includes(run.surface as (typeof AI_SURFACES)[number]) && isReal(run)) surfaceRuns[run.surface].push(run);
  const totalQueries = report.queries.length || 1;

  // Registry keyed by CANONICAL company (merges "The Coolest LLC" / "The Coolest, LLC"),
  // tracking the per-engine stats the company-report score needs.
  type Eng = { m: number; q: Set<string>; t3: number; t1: number };
  type Reg = { key: string; display: string; total: number; gemini: number; aiMode: number; chatgpt: number; eng: Record<string, Eng> };
  const engKeyOf: Record<string, "gemini" | "aiMode" | "chatgpt"> = { gemini_search: "gemini", google_ai_overview: "aiMode", chatgpt_search: "chatgpt" };
  const reg: Record<string, Reg> = {};
  for (const surface of AI_SURFACES) for (const run of surfaceRuns[surface]) for (const m of run.mentions || []) {
    const name = (m.companyName || "").trim(); if (!name) continue;
    const key = canonKey(name); if (!key) continue;
    if (!reg[key]) reg[key] = { key, display: name, total: 0, gemini: 0, aiMode: 0, chatgpt: 0, eng: { gemini_search: { m: 0, q: new Set(), t3: 0, t1: 0 }, google_ai_overview: { m: 0, q: new Set(), t3: 0, t1: 0 }, chatgpt_search: { m: 0, q: new Set(), t3: 0, t1: 0 } } };
    const r = reg[key];
    if (!isDomainLike(name) && (isDomainLike(r.display) || name.length > r.display.length)) r.display = name;
    r.total++; r[engKeyOf[surface]]++;
    const e = r.eng[surface]; e.m++; e.q.add(run.queryId); if (m.rank && m.rank <= 3) e.t3++; if (m.rank === 1) e.t1++;
  }

  // Per-engine visibility score = 0.5·mentionRate + 0.25·coverage + 0.15·top3 + 0.10·top1
  // (identical to the company report). Absent on an engine → 0, so it drags Overall down.
  const W: Record<string, number> = { gemini_search: 0.5, google_ai_overview: 0.3, chatgpt_search: 0.2 };
  const engScore = (e: Eng, surface: string): number => {
    const runs = surfaceRuns[surface].length;
    if (!runs || e.m === 0) return 0;
    return 0.5 * (e.m / runs) + 0.25 * (e.q.size / totalQueries) + 0.15 * (e.t3 / runs) + 0.10 * (e.t1 / runs);
  };
  const organicByPrompt = report.queries.map((q) => (report.serp?.[q.id]?.organic || []).filter((o) => !o.isDirectory));

  const companies = Object.values(reg).filter((c) => !isDomainLike(c.display)).map((c) => {
    const sGem = engScore(c.eng.gemini_search, "gemini_search");
    const sAim = engScore(c.eng.google_ai_overview, "google_ai_overview");
    const sCg = engScore(c.eng.chatgpt_search, "chatgpt_search");
    let acc = 0, ws = 0;
    for (const s of AI_SURFACES) { if (!surfaceRuns[s].length) continue; acc += engScore(c.eng[s], s) * W[s]; ws += W[s]; }
    const overall = ws ? acc / ws : 0;
    // SEO standing — organic appearances (brand-token in domain) + avg organic position.
    const toks = tokensOf(c.display); let app = 0, posSum = 0;
    if (toks.length) for (const org of organicByPrompt) { for (const o of org) if (toks.some((t) => norm(o.domain).includes(t))) { app++; posSum += o.rank; break; } }
    return { key: c.key, name: c.display, total: c.total, gemini: c.gemini, aiMode: c.aiMode, chatgpt: c.chatgpt,
      sGem, sAim, sCg, overall, seoApp: app, seoPos: app ? posSum / app : 0,
      present: { gemini: c.eng.gemini_search.m > 0, aiMode: c.eng.google_ai_overview.m > 0, chatgpt: c.eng.chatgpt_search.m > 0 } };
  });

  // Integer competitive rank per platform (present companies only; #1 = best score).
  type C = (typeof companies)[number];
  const rankMap = (val: (c: C) => number, present: (c: C) => boolean) => {
    const m = new Map<string, number>();
    companies.filter(present).sort((a, b) => val(b) - val(a)).forEach((c, i) => m.set(c.key, i + 1));
    return m;
  };
  const overallRank = rankMap((c) => c.overall, () => true);
  const gemRank = rankMap((c) => c.sGem, (c) => c.present.gemini);
  const aimRank = rankMap((c) => c.sAim, (c) => c.present.aiMode);
  const cgRank = rankMap((c) => c.sCg, (c) => c.present.chatgpt);
  const seoRank = rankMap((c) => c.seoApp * 100 - c.seoPos, (c) => c.seoApp > 0); // more appearances, then better position

  // GBP rating + reviews, keyed by canonical company (keep the highest-review match on collision).
  const gbpMap = new Map<string, { rating: number | null; reviews: number | null }>();
  for (const g of report.gbp || []) {
    const k = canonKey(g.name); if (!k) continue;
    const prev = gbpMap.get(k);
    if (!prev || (g.reviews ?? 0) > (prev.reviews ?? 0)) gbpMap.set(k, { rating: g.rating, reviews: g.reviews });
  }

  const top = [...companies].sort((a, b) => b.overall - a.overall).slice(0, 30);
  const rankBoard: RankRow[] = top.map((c) => ({
    name: c.name,
    overall: overallRank.get(c.key) ?? null,
    gemini: gemRank.get(c.key) ?? null,
    aiMode: aimRank.get(c.key) ?? null,
    chatgpt: cgRank.get(c.key) ?? null,
    seo: seoRank.get(c.key) ?? null,
    rating: gbpMap.get(c.key)?.rating ?? null,
    reviews: gbpMap.get(c.key)?.reviews ?? null,
  }));
  const leaderboard = top.map((c) => ({ name: c.name, total: c.total, gemini: c.gemini, aiMode: c.aiMode, chatgpt: c.chatgpt }));

  // Organic SERP result → company name (domain match to a canonical company; longest token wins).
  const aiTokenMap = companies.map((c) => ({ name: c.name, tokens: tokensOf(c.name) }));
  const serpCompany = (o: SerpListing): string => {
    const dom = norm(o.domain);
    let best: string | null = null, bestLen = 0;
    for (const c of aiTokenMap) for (const t of c.tokens) if (t.length > bestLen && dom.includes(t)) { best = c.name; bestLen = t.length; }
    if (best) return best;
    const fromTitle = (o.title || "").split(/[|\-–—·:]/)[0].trim();
    const fw = fromTitle.toLowerCase().split(/\s+/)[0];
    const stuffed = ["hvac", "ac", "air", "best", "top", "commercial", "residential", "heating", "cooling", "plumbing", "affordable", "emergency", "24", "local", "the"].includes(fw);
    return (fromTitle.length > 2 && !stuffed && !/^https?/i.test(fromTitle)) ? fromTitle : o.domain;
  };

  const displayOf = (key: string) => reg[key]?.display || key;
  const topN = (qid: string, surface: string, n: number): Ranked[] => {
    const runs = report.runs.filter((r) => r.queryId === qid && r.surface === surface && isReal(r));
    const t: Record<string, { c: number; rs: number; rn: number }> = {};
    for (const r of runs) for (const m of r.mentions || []) {
      const nm = (m.companyName || "").trim(); if (!nm) continue;
      const k = canonKey(nm); if (!k) continue;
      t[k] = t[k] || { c: 0, rs: 0, rn: 0 }; t[k].c++; if (m.rank) { t[k].rs += m.rank; t[k].rn++; }
    }
    return Object.entries(t).map(([k, v]) => ({ name: displayOf(k), count: v.c, avgRank: v.rn ? Math.round(v.rs / v.rn) : null }))
      .sort((a, b) => b.count - a.count || (a.avgRank ?? 99) - (b.avgRank ?? 99)).slice(0, n);
  };

  let dirInTop3 = 0;
  const prompts: PromptRow[] = report.queries.map((q) => {
    const organic = report.serp?.[q.id]?.organic || [];
    dirInTop3 += organic.slice(0, 3).filter((o) => o.isDirectory).length;
    return {
      id: q.id, text: q.text.replace(` in ${place}`, ""),
      engines: { Gemini: topN(q.id, "gemini_search", 5), "AI Mode": topN(q.id, "google_ai_overview", 5), ChatGPT: topN(q.id, "chatgpt_search", 5) },
      seo: organic.filter((o) => !o.isDirectory).slice(0, 5).map((o) => ({ company: serpCompany(o), rank: o.rank })),
    };
  });
  const seoDirectoryShare = report.queries.length ? Math.round((100 * dirInTop3) / (report.queries.length * 3)) : 0;

  return {
    market: place, vertical: report.vertical || "HVAC",
    totals: { companiesNamed: Object.keys(reg).length, prompts: report.queries.length, repeats: report.repeatRuns, aiRuns: report.runs.filter((r) => AI_SURFACES.includes(r.surface as (typeof AI_SURFACES)[number]) && isReal(r)).length },
    rankBoard, leaderboard, prompts, seoDirectoryShare,
  };
}

const STYLES = `
.mr{--G:var(--netic-green,#1e6e4e);--AM:#2f8f7f;--CG:#8bb0a0;--seo:#b5502f;max-width:1080px;margin:0 auto;padding:40px 28px 80px;color:var(--fg)}
.mr-state{max-width:1080px;margin:0 auto;padding:80px 28px;color:var(--fg-muted);font-size:14px}
.mr-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:22px}
.mr-eyebrow{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--primary)}
.mr-head h1{font-size:30px;line-height:1.12;font-weight:600;letter-spacing:-.02em;margin:8px 0 0;text-wrap:balance;max-width:20ch}
.mr-head h1 em{font-style:italic;color:var(--primary)}
.mr-toggles{display:flex;gap:12px}
.mr-toggles label{display:flex;flex-direction:column;gap:5px;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.08em;color:var(--fg-muted)}
.mr-toggles select{appearance:none;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-md);padding:8px 12px;font-size:13px;font-weight:600;color:var(--fg);letter-spacing:0;text-transform:none;cursor:pointer}
.mr-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin:28px 0 40px}
.mr-stat{background:var(--bg);padding:20px 22px;display:flex;flex-direction:column;gap:6px}
.mr-stat-n{font-size:34px;font-weight:600;letter-spacing:-.02em;line-height:1}
.mr-stat-l{font-size:12.5px;color:var(--fg-muted);line-height:1.35}
.mr-block{margin-bottom:52px}
.mr-block-head h2{font-size:19px;font-weight:600;letter-spacing:-.01em;margin:0 0 5px}
.mr-block-head p{font-size:13.5px;color:var(--fg-muted);line-height:1.5;margin:0;max-width:72ch}
.mr-block-head em{font-style:italic}
.mr-table-wrap{overflow-x:auto;margin-top:16px;border:1px solid var(--border);border-radius:var(--radius)}
/* Rank leaderboard */
.mr-rank{width:100%;border-collapse:collapse;font-size:13px;min-width:640px}
.mr-rank th{padding:11px 14px;background:var(--secondary,#f6f6f4);border-bottom:1px solid var(--border);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-muted);text-align:right;white-space:nowrap}
.mr-th-co{text-align:left!important}
.mr-th-sort{cursor:pointer;user-select:none;transition:color var(--dur,.15s)}
.mr-th-sort:hover{color:var(--fg)}
.mr-th-sort.mr-active{color:var(--primary)}
.mr-caret{margin-left:5px;font-size:9px;opacity:.7}
.mr-rank td{padding:9px 14px;border-bottom:1px solid color-mix(in oklab,var(--border) 55%,transparent);text-align:right;font-variant-numeric:tabular-nums}
.mr-rank tr:last-child td{border-bottom:0}
.mr-td-co{text-align:left!important;font-weight:500;max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mr-r-lead .mr-td-co{color:var(--primary);font-weight:600}
.mr-active-cell{background:color-mix(in oklab,var(--primary) 6%,transparent);font-weight:600}
.mr-seo-col{color:var(--seo)}
.mr-missing{color:var(--fg-muted);font-style:italic;font-size:11.5px;font-variant-numeric:normal}
/* Share of voice */
.mr-legend{display:flex;gap:16px;align-items:center;margin:16px 0 10px;flex-wrap:wrap}
.mr-legend-item{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--fg-muted)}
.mr-legend-scale{font-size:10.5px;color:var(--fg-muted);margin-left:auto}
.mr-dot{width:10px;height:10px;border-radius:2px;display:inline-block}
.mr-dot.mr-G,.mr-bar.mr-G{background:var(--G)}
.mr-dot.mr-AM,.mr-bar.mr-AM{background:var(--AM)}
.mr-dot.mr-CG,.mr-bar.mr-CG{background:var(--CG)}
.mr-board{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.mr-row{display:grid;grid-template-columns:30px minmax(150px,1.2fr) 3fr 48px;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid color-mix(in oklab,var(--border) 60%,transparent);font-size:13px}
.mr-lead .mr-name{font-weight:600;color:var(--primary)}
.mr-rank-n{color:var(--fg-muted)}
.mr-row .mr-rank{all:unset;color:var(--fg-muted);font-size:12px;text-align:right}
.mr-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mr-bar-track{position:relative;display:flex;align-items:center;height:14px;background:color-mix(in oklab,var(--border) 40%,transparent);border-radius:2px}
.mr-bar{height:100%;min-width:0}
.mr-bar:first-child{border-radius:2px 0 0 2px}
.mr-sov{text-align:right;font-weight:600}
/* Prompt table */
.mr-table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:760px}
.mr-table th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-muted);padding:11px 14px;background:var(--secondary,#f6f6f4);border-bottom:1px solid var(--border);white-space:nowrap}
.mr-th-seo{color:var(--seo)}
.mr-th-seo span{text-transform:none;letter-spacing:0;font-weight:400}
.mr-prow{cursor:pointer;transition:background var(--dur,.15s)}
.mr-prow:hover{background:color-mix(in oklab,var(--primary) 4%,transparent)}
.mr-prow.mr-open{background:color-mix(in oklab,var(--primary) 6%,transparent)}
.mr-table td{padding:10px 14px;border-bottom:1px solid color-mix(in oklab,var(--border) 55%,transparent);vertical-align:top}
.mr-td-prompt{font-weight:500;color:var(--fg);white-space:nowrap}
.mr-chev{display:inline-block;color:var(--fg-muted);margin-right:8px;transition:transform var(--dur,.15s);font-size:10px}
.mr-chev-open{transform:rotate(90deg);color:var(--primary)}
.mr-cell-name{display:inline}
.mr-cell-rank{color:var(--fg-muted);font-size:10.5px;margin-left:6px}
.mr-td-seo .mr-cell-name{color:var(--seo)}
.mr-none{color:var(--fg-muted);font-style:italic;font-size:11.5px}
.mr-detail-row td{background:color-mix(in oklab,var(--secondary,#f6f6f4) 60%,var(--bg));padding:0}
.mr-detail{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border)}
.mr-detail-col{background:var(--bg);padding:12px 14px}
.mr-detail-h{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid}
.mr-h-G{color:var(--G);border-color:var(--G)}
.mr-h-AM{color:var(--AM);border-color:var(--AM)}
.mr-h-CG{color:var(--CG);border-color:var(--CG)}
.mr-h-SEO{color:var(--seo);border-color:var(--seo)}
.mr-detail-col ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
.mr-detail-col li{display:grid;grid-template-columns:16px 1fr;gap:6px;font-size:11.5px;align-items:baseline}
.mr-di-rank{color:var(--fg-muted);font-size:10px;text-align:right}
.mr-di-name{color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mr-di-meta{grid-column:2;color:var(--fg-muted);font-size:10px}
.mr-foot{margin-top:40px;padding-top:18px;border-top:1px solid var(--border);font-size:11.5px;color:var(--fg-muted);line-height:1.5}
@media(max-width:640px){.mr-stats{grid-template-columns:1fr}.mr-head h1{font-size:24px}.mr-row{grid-template-columns:24px minmax(110px,1fr) 2fr 40px}}
`;
