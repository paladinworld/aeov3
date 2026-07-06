// Build the State of AI Search report: exports/report-template.html -> exports/state-of-ai-search-home-services.html
// Generates: volatility example cards, engine-agreement grid, reviews-by-engine scatter panels,
// and the Section-3 grouped theme bars. All data from data-market/ (verified extractions).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const db = rd("data-market/db.json");
const agg = rd("data-market/study-aggregate.json");
const scatterByEng = rd("data-market/reviews-by-engine.json");
const isReal = (r) => !String(r.rawAnswer || "").startsWith("Provider error:");
const ENG = { gemini_search: "Google Gemini", google_ai_overview: "Google AI Mode", chatgpt_search: "ChatGPT" };

// ---- 1. volatility example (3 runs, same prompt/engine, max churn) ----
let best = null;
for (const r of db.reports.filter((x) => x.market && x.status === "complete")) {
  for (const q of r.queries) for (const s of ["gemini_search", "chatgpt_search"]) {
    const runs = r.runs.filter((x) => x.queryId === q.id && x.surface === s && isReal(x)).slice(0, 3);
    if (runs.length < 3) continue;
    const lists = runs.map((x) => (x.mentions || []).map((m) => (m.companyName || "").trim()).filter(Boolean).slice(0, 5));
    if (lists.some((l) => l.length < 4)) continue;
    const tops = lists.map((l) => l[0]);
    if (new Set(tops).size < 2) continue;
    let churn = 0;
    for (let i = 1; i < 3; i++) { const prev = new Set(lists[i - 1]); churn += lists[i].filter((n) => !prev.has(n)).length; }
    const score = churn + (new Set(tops).size === 3 ? 3 : 0);
    if (!best || score > best.score) best = { score, q: q.text, s, lists };
  }
}
const seen = new Map();
const label = (n) => { if (!seen.has(n)) seen.set(n, "Company " + String.fromCharCode(65 + seen.size)); return seen.get(n); };
best.lists.flat().forEach(label);
const runsExample = `<div class="runs3">` + best.lists.map((l, i) => {
  const prev = i > 0 ? new Set(best.lists[i - 1]) : null;
  return `<div class="runcard"><h4>Run ${i + 1}</h4><ol>${l.map((n) => `<li class="${prev && !prev.has(n) ? "new" : "stay"}">${label(n)}</li>`).join("")}</ol></div>`;
}).join("") + `</div>`;

// ---- 2. agreement grid ----
const agreeGrid = agg.markets.map((m) => `<div class="gc ${m.engineAgree ? "agree" : "dis"}" title="${m.city}">${m.city}</div>`).join("");

// ---- 3. reviews-by-engine scatter small multiples ----
const PANELS = [
  { key: "gemini_search", name: "Gemini", color: "#0e7d4a", rho: "0.56", note: "reviews matter" },
  { key: "google_ai_overview", name: "AI Mode", color: "#a87415", rho: "0.29", note: "a little" },
  { key: "chatgpt_search", name: "ChatGPT", color: "#b0512e", rho: "0.19", note: "barely at all" },
];
const PW = 262, PH = 210, GAP = 27, mL = 34, mB = 30, mT = 30;
function panel(p, xoff) {
  const pts = [];
  const dedupe = new Set();
  for (const d of scatterByEng[p.key]) {
    const rev = Math.max(1, d.rev), sc = Math.max(0, Math.min(70, d.sc));
    const k = Math.round(Math.log10(rev) * 40) + ":" + Math.round(sc * 2);
    if (dedupe.has(k)) continue; dedupe.add(k);
    pts.push({ rev, sc, city: d.city });
  }
  const X = (rev) => xoff + mL + (Math.log10(rev) / 4.7) * (PW - mL - 6);
  const Y = (sc) => mT + (1 - sc / 70) * (PH - mT - mB);
  let s = `<text x="${xoff + mL}" y="16" font-size="13" font-weight="650" fill="${p.color}">${p.name}</text>`;
  s += `<text x="${xoff + mL + 62}" y="16" font-size="11.5" fill="#8b8578">ρ ${p.rho} — ${p.note}</text>`;
  for (const v of [1, 10, 100, 1000, 10000]) {
    const x = X(v);
    s += `<line class="gl" x1="${x.toFixed(1)}" y1="${mT}" x2="${x.toFixed(1)}" y2="${PH - mB}"/>`;
    s += `<text class="axlbl" x="${x.toFixed(1)}" y="${PH - mB + 14}" text-anchor="middle" font-size="9.5">${v >= 1000 ? v / 1000 + "k" : v}</text>`;
  }
  for (const v of [0, 35, 70]) {
    const y = Y(v);
    s += `<line class="gl" x1="${xoff + mL}" y1="${y.toFixed(1)}" x2="${xoff + PW - 6}" y2="${y.toFixed(1)}"/>`;
    s += `<text class="axlbl" x="${xoff + mL - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9.5">${v}</text>`;
  }
  s += `<line class="ax" x1="${xoff + mL}" y1="${PH - mB}" x2="${xoff + PW - 6}" y2="${PH - mB}"/>`;
  for (const d of pts) {
    s += `<circle class="dot" cx="${X(d.rev).toFixed(1)}" cy="${Y(d.sc).toFixed(1)}" r="2.4" fill="${p.color}" fill-opacity="0.38"><title>${d.city}: ${d.rev.toLocaleString()} reviews, visibility ${d.sc}</title></circle>`;
  }
  s += `<text class="axlbl" x="${xoff + PW - 6}" y="${PH - 4}" text-anchor="end" font-size="9.5">Google reviews →</text>`;
  return s;
}
const totalW = PW * 3 + GAP * 2;
let revScatter = `<svg viewBox="0 0 ${totalW} ${PH + 6}" role="img" aria-label="Reviews vs visibility by engine">`;
revScatter += `<text class="axlbl" x="10" y="${mT - 14}" transform="rotate(-90 10 ${mT + 60})" font-size="9.5">visibility →</text>`;
PANELS.forEach((p, i) => { revScatter += panel(p, i * (PW + GAP)); });
revScatter += `</svg>`;

// ---- 4. grouped 3-bar theme charts (numbers from market-study mining, verified) ----
const POS = [
  ["Strong rating & plenty of reviews", 29, 42, 40],
  ["Fast response — same-day, 24/7, emergency", 39, 33, 34],
  ["Years in business & experience", 33, 32, 26],
  ["Licenses, certifications & awards", 22, 33, 21],
  ["Professionalism & trustworthiness", 31, 4, 17],
  ["Fair, upfront pricing", 22, 6, 11],
  ["Family-owned / local identity", 14, 10, 10],
  ["Guarantees & warranties", 14, 5, 7],
];
const NEG = [
  ["“Competitors simply looked more prominent”", 87, 100, 94],
  ["Thin presence in the sources AI checks — review sites, BBB, best-of lists", 78, 89, 84],
  ["Weak or unclear website content", 7, 81, 49],
  ["Too few reviews / too little visibility", 15, 34, 26],
  ["Not clearly anchored to the city asked about", 20, 29, 25],
  ["AI never encountered them at all", 0, 27, 16],
];
// Heatmap matrix (per the approved design): rows = themes, columns = Gemini/ChatGPT/Overall,
// each column tinted in its own hue, darker = higher (alpha scaled to the column max).
const HUES = { g: [14, 125, 74], c: [176, 81, 46], a: [85, 81, 74] };
const TXT = { g: "#0c5a38", c: "#8c3a1e", a: "#3f3c36" };
function heat(rows) {
  const max = { g: Math.max(...rows.map((r) => r[1])), c: Math.max(...rows.map((r) => r[2])), a: Math.max(...rows.map((r) => r[3])) };
  const cell = (v, k, cls) => {
    const alpha = (0.07 + 0.48 * (v / max[k])).toFixed(2);
    return `<td class="cell ${cls}" style="background:rgba(${HUES[k].join(",")},${alpha});color:${TXT[k]}">${v}%</td>`;
  };
  return `<table class="heat"><thead><tr><th class="rowh">Theme</th><th class="all">Overall</th><th class="gem">Gemini</th><th class="cg">ChatGPT</th></tr></thead><tbody>` +
    rows.map(([nm, g, c, a]) => `<tr><td class="theme">${nm}</td>${cell(a, "a", "c1")}${cell(g, "g", "")}${cell(c, "c", "c3")}</tr>`).join("") +
    `</tbody></table>`;
}

// Rank-decay chart: median share of AI answers by market position (data-market/rank-decay.json)
const decay = rd("data-market/rank-decay.json").slice(0, 15);
const DW = 840, DH = 250, dL = 46, dB = 44, dT = 16, dMax = 50;
const bw = Math.floor((DW - dL - 10) / decay.length) - 8;
let rankDecay = `<svg viewBox="0 0 ${DW} ${DH}" role="img" aria-label="Median share of AI answers by market position">`;
for (const v of [0, 25, 50]) {
  const y = DH - dB - (v / dMax) * (DH - dB - dT);
  rankDecay += `<line class="gl" x1="${dL - 6}" y1="${y}" x2="${DW - 4}" y2="${y}"/><text class="axlbl" x="${dL - 10}" y="${y + 3}" text-anchor="end" font-size="10">${v}%</text>`;
}
decay.forEach((d, i) => {
  const x = dL + i * (bw + 8), h = (d.med / dMax) * (DH - dB - dT), y = DH - dB - h;
  rankDecay += `<rect class="bar" x="${x}" y="${y.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="3" fill="#0e7d4a" fill-opacity="${(1 - i * 0.045).toFixed(2)}"><title>The market's #${d.pos} most-visible company is named in ${d.med}% of AI answers (median of 30 markets)</title></rect>`;
  if ([1, 2, 3, 5, 8, 10, 15].includes(d.pos)) rankDecay += `<text class="dlab tnum" x="${x + bw / 2}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11.5">${Math.round(d.med)}%</text>`;
  rankDecay += `<text class="axlbl" x="${x + bw / 2}" y="${DH - dB + 15}" text-anchor="middle" font-size="10">#${d.pos}</text>`;
});
rankDecay += `<line class="ax" x1="${dL - 6}" y1="${DH - dB}" x2="${DW - 4}" y2="${DH - dB}"/>`;
rankDecay += `<text class="axlbl" x="${dL + (decay.length * (bw + 8)) / 2}" y="${DH - 8}" text-anchor="middle" font-size="10.5">a market's companies, ranked by how often AI names them →</text></svg>`;

// ---- 5. review-bucket grouped bars (values from verified bucket analysis) ----
// avg visibility (0-100-scaled score) by review bucket: [<1k, 1k-5k, >5k]
const BUCKETS = [
  { name: "Gemini", vals: [7.0, 22.7, 27.6], shades: ["#a5cfba", "#4f9f77", "#0e7d4a"], mult: "×3.9", note: "reviews pay" },
  { name: "AI Mode", vals: [7.6, 10.3, 11.9], shades: ["#dbc08a", "#c0964b", "#a87415"], mult: "×1.6", note: "a little" },
  { name: "ChatGPT", vals: [10.2, 16.6, 16.7], shades: ["#dcab97", "#c67d5c", "#b0512e"], mult: "×1.6", note: "flat after ~1k" },
];
const BW = 58, BGAP = 10, GW = 3 * BW + 2 * BGAP, GGAP = 62, H2 = 250, base = H2 - 58, top2 = 34, ymax = 30;
const BX0 = 46;
let revBuckets = `<svg viewBox="0 0 ${BX0 + GW * 3 + GGAP * 2 + 10} ${H2}" role="img" aria-label="Visibility by review count and engine">`;
for (const v of [0, 10, 20, 30]) {
  const y = base - (v / ymax) * (base - top2);
  revBuckets += `<line class="gl" x1="${BX0 - 6}" y1="${y}" x2="${BX0 + GW * 3 + GGAP * 2}" y2="${y}"/><text class="axlbl" x="${BX0 - 10}" y="${y + 3}" text-anchor="end" font-size="10">${v}</text>`;
}
revBuckets += `<text class="axlbl" x="${BX0 - 34}" y="${top2 - 12}" font-size="10">avg visibility score</text>`;
const BLAB = ["<1k", "1k–5k", "5k+"];
BUCKETS.forEach((g, gi) => {
  const gx = BX0 + gi * (GW + GGAP);
  g.vals.forEach((v, bi) => {
    const h = (v / ymax) * (base - top2), x = gx + bi * (BW + BGAP), y = base - h;
    revBuckets += `<rect class="bar" x="${x}" y="${y.toFixed(1)}" width="${BW}" height="${h.toFixed(1)}" rx="4" fill="${g.shades[bi]}"><title>${g.name} — companies with ${BLAB[bi]} reviews: avg visibility ${v}</title></rect>`;
    revBuckets += `<text class="dlab tnum" x="${x + BW / 2}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="12">${v.toFixed(1)}</text>`;
    revBuckets += `<text class="axlbl" x="${x + BW / 2}" y="${base + 15}" text-anchor="middle" font-size="10">${BLAB[bi]}</text>`;
  });
  revBuckets += `<text class="dlab" x="${gx + GW / 2}" y="${base + 34}" text-anchor="middle" font-size="13" fill="${g.shades[2]}">${g.name}</text>`;
  revBuckets += `<text class="axlbl" x="${gx + GW / 2}" y="${base + 50}" text-anchor="middle" font-size="10.5">5k+ vs &lt;1k: ${g.mult} — ${g.note}</text>`;
});
revBuckets += `<line class="ax" x1="${BX0 - 6}" y1="${base}" x2="${BX0 + GW * 3 + GGAP * 2}" y2="${base}"/></svg>`;

// ---- 6. "how reviewed is each engine's shortlist" — median reviews of top-5 picks ----
const SHORTLIST = [
  { name: "Gemini", med: 2215, top1: 2830, color: "#0e7d4a" },
  { name: "AI Mode", med: 557, top1: 736, color: "#a87415" },
  { name: "ChatGPT", med: 805, top1: 2676, color: "#b0512e" },
];
const SMAX = 2400, SW = 560, SX = 110;
let topRevs = `<svg viewBox="0 0 840 168" role="img" aria-label="Median reviews of each engine's top picks">`;
SHORTLIST.forEach((e, i) => {
  const y = 14 + i * 50, w = Math.min(SW, (e.med / SMAX) * SW);
  topRevs += `<text class="dlab" x="${SX - 10}" y="${y + 15}" text-anchor="end" fill="${e.color}">${e.name}</text>`;
  topRevs += `<rect class="bar" x="${SX}" y="${y}" width="${w.toFixed(0)}" height="22" rx="4" fill="${e.color}"><title>${e.name}: median ${e.med.toLocaleString()} reviews across its top-5 picks (its #1 pick: ${e.top1.toLocaleString()})</title></rect>`;
  topRevs += `<text class="dlab tnum" x="${SX + w + 10}" y="${y + 15}">${e.med.toLocaleString()} reviews</text>`;
  topRevs += `<text class="dlab-s tnum" x="${SX + w + 10}" y="${y + 30}" font-size="10.5">#1 pick alone: ${e.top1.toLocaleString()}</text>`;
});
topRevs += `</svg>`;

// ---- assemble ----
let html = fs.readFileSync(path.join(ROOT, "exports/report-template.html"), "utf8");
html = html
  .replace("{{RUNS_EXAMPLE}}", runsExample)
  .replace("{{RUNS_PROMPT}}", best.q.replace(/ in [A-Z][^,]*, [A-Z]{2}$/, " in [city]"))
  .replace("{{RUNS_ENGINE}}", ENG[best.s])
  .replace("{{AGREE_GRID}}", agreeGrid)
  .replace("{{REV_SCATTER}}", revScatter)
  .replace("{{REV_BUCKETS}}", revBuckets)
  .replace("{{TOP_REVS}}", topRevs)
  .replace("{{POS_HEAT}}", heat(POS))
  .replace("{{NEG_HEAT}}", heat(NEG))
  .replace("{{RANK_DECAY}}", rankDecay);
const left = html.match(/\{\{[A-Z_]+\}\}/g) || [];
fs.writeFileSync(path.join(ROOT, "exports/state-of-ai-search-home-services.html"), html);
console.log("built | placeholders left:", left.join(",") || "none", "| size:", (html.length / 1024).toFixed(0) + "KB");
