const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const reports = JSON.parse(fs.readFileSync("/private/tmp/aeo-reports.json", "utf8"));
const companies = JSON.parse(fs.readFileSync("/private/tmp/aeo-companies.json", "utf8"));

const report =
  reports.find((item) => item.company?.name?.toLowerCase().includes("hoffmann")) ||
  reports[0];
const company =
  report.company || companies.find((item) => item.id === report.companyId) || {};

const htmlEscape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const percent = (value) =>
  `${Math.round((Number.isFinite(value) ? value : 0) * 100)}%`;
const clamp = (value) => Math.max(0, Math.min(1, value || 0));
const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const canonical = (value) =>
  normalize(value)
    .replace(/\b(inc|llc|co|company|corp|corporation|services|service)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
const isErrorRun = (run) =>
  String(run.rawAnswer || "").startsWith("Provider error:");
const targetRank = (run) =>
  (run.mentions || []).find((mention) => mention.isTarget)?.rank || null;

const goodRuns = (report.runs || []).filter((run) => !isErrorRun(run));
const customerRuns = goodRuns.filter((run) =>
  ["gemini_maps", "chatgpt_search"].includes(run.surface),
);
const geminiSearchRuns = goodRuns.filter((run) => run.surface === "gemini_search");
const queries = report.queries || [];
const totalPrompts = queries.length || 1;
const totalChecks = customerRuns.length || 1;

const ownedDomain = (() => {
  try {
    return new URL(company.website).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
})();

const promptRows = queries.map((query) => {
  const runs = customerRuns.filter((run) => run.queryId === query.id);
  const ranks = runs.map(targetRank).filter(Boolean);
  return {
    id: query.id,
    text: query.text,
    category: query.category || "Tracked Prompt",
    bestRank: ranks.length ? Math.min(...ranks) : null,
    platforms: new Set(
      runs.filter((run) => targetRank(run)).map((run) => run.surface),
    ).size,
  };
});

const mentionChecks = customerRuns.filter((run) => targetRank(run)).length;
const mentionedPrompts = promptRows.filter((row) => row.bestRank).length;
const topThreeChecks = customerRuns.filter((run) => {
  const rank = targetRank(run);
  return rank && rank <= 3;
}).length;
const topOneChecks = customerRuns.filter((run) => targetRank(run) === 1).length;
const mentionRate = mentionChecks / totalChecks;
const promptCoverage = mentionedPrompts / totalPrompts;
const topThreeRate = topThreeChecks / totalChecks;
const topOneRate = topOneChecks / totalChecks;
const visibilityScore =
  0.5 * mentionRate +
  0.25 * promptCoverage +
  0.15 * topThreeRate +
  0.1 * topOneRate;

function band(value, kind) {
  if (kind === "visibility") {
    return value >= 0.3 ? "High" : value >= 0.2 ? "Medium" : "Low";
  }
  if (kind === "mentions") {
    return value > 0.4 ? "High" : value >= 0.2 ? "Medium" : "Low";
  }
  if (kind === "top3") {
    return value > 0.2 ? "High" : value >= 0.1 ? "Medium" : "Low";
  }
  if (kind === "top1") {
    return value > 0.1 ? "High" : value >= 0.05 ? "Medium" : "Low";
  }
  return "Low";
}

const bandClass = (value) => `band-${String(value).toLowerCase()}`;

const surfaceRows = ["gemini_maps", "chatgpt_search"].map((surface) => {
  const runs = customerRuns.filter((run) => run.surface === surface);
  const mentions = runs.filter((run) => targetRank(run)).length;
  return {
    label: surface === "gemini_maps" ? "Gemini" : "ChatGPT",
    value: runs.length ? mentions / runs.length : 0,
    count: mentions,
    total: runs.length,
  };
});

const categoryRows = Array.from(
  new Set(queries.map((query) => query.category || "Tracked Prompt")),
).map((category) => {
  const rows = promptRows.filter((row) => row.category === category);
  const wins = rows.filter((row) => row.bestRank).length;
  return {
    name: category,
    value: rows.length ? wins / rows.length : 0,
    count: wins,
    total: rows.length,
  };
});

const mentionMap = new Map();
for (const run of customerRuns) {
  const seen = new Set();
  for (const mention of run.mentions || []) {
    const key = mention.isTarget ? "__target__" : canonical(mention.companyName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const row = mentionMap.get(key) || {
      name: mention.isTarget ? company.name : mention.companyName,
      count: 0,
      top3: 0,
      top1: 0,
      target: Boolean(mention.isTarget),
    };
    row.count += 1;
    if (mention.rank <= 3) row.top3 += 1;
    if (mention.rank === 1) row.top1 += 1;
    mentionMap.set(key, row);
  }
}

const leaderboardRows = [...mentionMap.values()].map((row) => ({
  ...row,
  mentionRate: row.count / totalChecks,
  visibility:
    0.75 * (row.count / totalChecks) +
    0.15 * (row.top3 / totalChecks) +
    0.1 * (row.top1 / totalChecks),
}));
const visibilityLeaderboard = [...leaderboardRows]
  .sort((a, b) => b.visibility - a.visibility)
  .slice(0, 10);
const mentionLeaderboard = [...leaderboardRows]
  .sort((a, b) => b.mentionRate - a.mentionRate)
  .slice(0, 10);

function domainFrom(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {}
  const match = String(value).match(/(?:https?:\/\/)?(?:www\.)?([^/\s?#]+)/i);
  return match ? match[1].replace(/^www\./, "") : "";
}

function citationUrl(citation) {
  const candidates = [
    citation.url,
    citation.resolvedUrl,
    citation.finalUrl,
    citation.sourceUrl,
    citation.uri,
  ].filter(Boolean);
  return (
    candidates.find(
      (url) =>
        /^https?:\/\//i.test(url) &&
        !url.includes("vertexaisearch.cloud.google.com"),
    ) || ""
  );
}

const platformDomains = new Set([
  "angi.com",
  "bbb.org",
  "bestpickreports.com",
  "bobvila.com",
  "consumeraffairs.com",
  "consumerreports.org",
  "diamondcertified.org",
  "expertise.com",
  "facebook.com",
  "forbes.com",
  "google.com",
  "homeadvisor.com",
  "houzz.com",
  "maps.google.com",
  "nextdoor.com",
  "porch.com",
  "quora.com",
  "reddit.com",
  "thumbtack.com",
  "yelp.com",
  "youtube.com",
]);
const otherDomains = new Set(["stlouis.thehomemag.online", "thehomemag.online"]);

function sourceType(domain) {
  if (!domain) return "Other";
  if (ownedDomain && (domain === ownedDomain || domain.endsWith(`.${ownedDomain}`))) {
    return "Owned";
  }
  if (
    platformDomains.has(domain) ||
    [...platformDomains].some((item) => domain.endsWith(`.${item}`))
  ) {
    return "Platform";
  }
  if (otherDomains.has(domain)) return "Other";
  return "Competitor";
}

const citationMap = new Map();
for (const run of geminiSearchRuns) {
  const seenDomains = new Set();
  for (const citation of run.citations || []) {
    const url = citationUrl(citation);
    const domain = domainFrom(url || citation.domain || citation.title);
    if (!domain || domain.includes("vertexaisearch.cloud.google.com")) continue;
    const row =
      citationMap.get(domain) ||
      { domain, count: 0, type: sourceType(domain), urls: new Map() };
    if (!seenDomains.has(domain)) {
      row.count += 1;
      seenDomains.add(domain);
    }
    if (url) {
      const urlRow = row.urls.get(url) || {
        url,
        title: citation.title || url,
        count: 0,
      };
      urlRow.count += 1;
      row.urls.set(url, urlRow);
    }
    citationMap.set(domain, row);
  }
}

const citationRows = [...citationMap.values()]
  .sort((a, b) => b.count - a.count)
  .slice(0, 12);
const citationTotal = citationRows.reduce((sum, row) => sum + row.count, 0) || 1;
const typeRows = Object.entries(
  citationRows.reduce((acc, row) => {
    acc[row.type] = (acc[row.type] || 0) + row.count;
    return acc;
  }, {}),
)
  .map(([name, count]) => ({ name, count, value: count / citationTotal }))
  .sort((a, b) => b.count - a.count);

const wins = promptRows
  .filter((row) => row.bestRank)
  .sort((a, b) => a.bestRank - b.bestRank || b.platforms - a.platforms)
  .slice(0, 5);
const misses = promptRows.filter((row) => !row.bestRank).slice(0, 5);

function metricCard(title, value, label, labelKind, subtitle, tone = "") {
  return `<section class="metric-card"><div class="metric-title">${htmlEscape(
    title,
  )}</div><div class="metric-line"><strong class="${tone}">${htmlEscape(
    value,
  )}</strong><span class="band ${bandClass(label)}">${htmlEscape(
    label,
  )}</span></div>${subtitle ? `<p>${htmlEscape(subtitle)}</p>` : ""}</section>`;
}

function barRow(row, meta = "") {
  return `<div class="bar-row"><div class="bar-label"><span>${htmlEscape(
    row.name || row.label,
  )}</span><b>${percent(row.value)}</b></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(
    2,
    Math.round(clamp(row.value) * 100),
  )}%"></div></div>${meta ? `<small>${htmlEscape(meta)}</small>` : ""}</div>`;
}

function leaderboardRow(row, metricKey, unit, kind) {
  const value = clamp(row[metricKey]);
  const color = bandClass(band(value, kind));
  return `<div class="leader-row ${row.target ? "is-you" : ""}"><div><strong>${htmlEscape(
    row.name,
  )}</strong><span>${row.target ? "You" : "Competitor"}</span></div><div class="leader-meter"><div class="bar-track"><div class="bar-fill ${color}" style="width:${Math.max(
    2,
    Math.round(value * 100),
  )}%"></div></div><b>${percent(value)}</b><small>${htmlEscape(
    row.count,
  )} ${htmlEscape(unit)}</small></div></div>`;
}

function tag(type) {
  return `<span class="tag tag-${htmlEscape(type.toLowerCase())}">${htmlEscape(
    type,
  )}</span>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Netic AI Visibility Standalone Report</title>
  <style>
    :root{--bg:#f7f3eb;--panel:#fffdfa;--muted:#6f7f74;--line:#e4dac8;--green:#0b4225;--mint:#18a977;--gold:#b47b0f;--rust:#ad4f34;--cream:#eee8da}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:#1f2b28;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.45} a{color:var(--green)}
    .shell{display:grid;grid-template-columns:250px 1fr;min-height:100vh}.side{background:#f1ece3;border-right:1px solid var(--line);padding:24px 22px;position:sticky;top:0;height:100vh}.logo{font-family:Georgia,serif;font-size:34px;font-weight:800;color:var(--green);letter-spacing:-1px}.beta{display:inline-block;margin-left:8px;transform:translateY(-8px);font-size:10px;text-transform:uppercase;background:#dff3e9;color:var(--green);padding:3px 7px;border-radius:999px}.subline{color:var(--muted);font-size:12px;margin-top:-5px;margin-bottom:34px}.label{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);font-weight:850}.company{margin:8px 0 28px}.company strong{display:block;color:var(--green);font-size:17px}.company span{color:var(--muted)}.nav{border-top:1px solid var(--line);padding-top:22px}.nav a{display:flex;justify-content:space-between;padding:10px 12px;border-radius:7px;text-decoration:none;color:#31443b;font-weight:700;margin-bottom:6px}.nav a.active{background:var(--green);color:white}.note{position:absolute;left:22px;right:22px;bottom:22px;color:#718176;font-size:11px}
    .main{padding:0 28px 50px}.topbar{height:68px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;margin:0 -28px 22px;padding:0 28px;background:#fffdf8}.crumb{font-size:15px;color:var(--muted)}.crumb b{color:var(--green)}.actions{display:flex;gap:8px}.btn{border:1px solid #d7cbb9;background:#fffdfa;color:var(--green);border-radius:7px;padding:9px 12px;font-weight:750;cursor:pointer}.hero-copy{font-size:18px;color:var(--muted);margin:0 0 20px}
    .grid{display:grid;gap:16px}.metrics{grid-template-columns:repeat(5,minmax(0,1fr))}.metric-card,.panel{background:var(--panel);border:1px solid var(--line);border-radius:11px;box-shadow:0 1px 3px rgba(46,31,12,.06)}.metric-card{padding:20px;min-height:134px}.metric-title,.panel-title{letter-spacing:.18em;text-transform:uppercase;color:#74847a;font-weight:850;font-size:13px}.metric-line{display:flex;align-items:center;gap:10px;margin-top:10px}.metric-line strong{font-size:34px;line-height:1;color:var(--green);letter-spacing:-1px}.metric-line strong.warn{color:var(--rust)}.metric-line strong.gold{color:var(--gold)}.metric-card p{margin:12px 0 0;color:var(--muted);font-weight:650}.band{font-size:11px;text-transform:uppercase;font-weight:850;letter-spacing:.08em;padding:5px 9px;border-radius:999px}.band-high{background:#daf3e7;color:#066344}.band-medium{background:#f2e6bd;color:#896512}.band-low{background:#f5ddd5;color:#9e432c}
    .summary{background:var(--green);color:#eaf4ec;border-radius:14px;padding:26px;margin-top:16px}.summary h2{font-family:Georgia,serif;margin:0 0 10px;font-size:30px}.summary p{max-width:900px;color:#cfe0d2;margin:0}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px}.summary-card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:14px}.summary-card b{display:block;color:white;font-size:22px}.summary-card span{color:#bcd1c1}
    .body-grid{grid-template-columns:1.1fr .9fr;margin-top:16px}.panel{overflow:hidden}.panel-head{display:flex;justify-content:space-between;gap:16px;align-items:center;border-bottom:1px solid var(--line);padding:18px 20px}.panel-head span{color:var(--muted);font-weight:650}.panel-body{padding:20px}.bar-row{margin-bottom:16px}.bar-label{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;font-weight:750}.bar-track{height:9px;background:var(--cream);border-radius:999px;overflow:hidden;margin-top:8px}.bar-fill{height:100%;background:var(--mint);border-radius:999px}.bar-fill.band-high{background:var(--mint)}.bar-fill.band-medium{background:var(--gold)}.bar-fill.band-low{background:var(--rust)}.bar-row small{display:block;color:var(--muted);margin-top:4px}
    .leader-row{display:grid;grid-template-columns:minmax(180px,1fr) 1.35fr;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}.leader-row:last-child{border-bottom:0}.leader-row.is-you{background:#eef7f1;margin:0 -10px;padding:14px 10px;border-radius:8px}.leader-row strong{display:block;color:var(--green);font-size:15px}.leader-row span,.leader-row small{color:var(--muted)}.leader-meter{display:grid;grid-template-columns:1fr 54px 70px;align-items:end;gap:10px}.leader-meter b{font-size:18px;color:var(--green);text-align:right}
    .prompt-list{list-style:none;margin:0;padding:0}.prompt-list li{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}.prompt-list li:last-child{border-bottom:0}.prompt-list b{color:var(--green);font-weight:750}.prompt-list em{font-style:normal;color:#53655b;background:#eee9de;border-radius:6px;padding:3px 7px;font-size:12px}.rank{background:var(--green);color:white;border-radius:6px;padding:4px 8px;font-weight:850}.rank.gold{background:#fbefc8;color:#8a640e;border:1px solid #d6bd75}
    .table{width:100%;border-collapse:collapse}.table th{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#74847a;text-align:left;background:#f4f0e8}.table th,.table td{border-bottom:1px solid var(--line);padding:13px 14px;vertical-align:top}.table strong{color:var(--green)}.tag{display:inline-flex;border-radius:6px;padding:3px 7px;font-size:11px;font-weight:800}.tag-platform{background:#d7f2e6;color:#08714d}.tag-competitor{background:#f2d8cf;color:#9d432b}.tag-owned{background:#dce9f8;color:#255a9d}.tag-other{background:#e9e3f6;color:#5e48a6}.url-list{margin:7px 0 0;padding:0;list-style:none}.url-list li{margin:5px 0;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wide{grid-column:1/-1}
    @media(max-width:1300px){.shell{grid-template-columns:220px 1fr}.metrics{grid-template-columns:repeat(3,1fr)}.body-grid{grid-template-columns:1fr}.leader-row{grid-template-columns:1fr}.leader-meter{grid-template-columns:1fr 54px 70px}}
    @media print{body{background:white}.side,.actions{display:none}.shell{display:block}.main{padding:0}.topbar{margin:0 0 18px;padding:0;border-bottom:1px solid #ddd}.panel,.metric-card,.summary{break-inside:avoid}}
  </style>
</head>
<body>
<div class="shell">
  <aside class="side">
    <div class="logo">netic<span class="beta">Beta</span></div>
    <div class="subline">AI Visibility Insights</div>
    <div class="label">Company</div>
    <div class="company"><strong>${htmlEscape(company.name)}</strong><span>${htmlEscape(company.locations?.[0]?.label || "")}</span></div>
    <nav class="nav"><a class="active" href="#overview">Home <span>${htmlEscape(totalPrompts)}</span></a><a href="#prompts">Prompts <span>${htmlEscape(totalPrompts)}</span></a><a href="#citations">Citations</a><a href="#sentiment">Sentiment</a></nav>
    <div class="note">Based on tracked high-intent prompts with multiple queries for accuracy. AI results can vary by platform, session, model, location, and timing. For reference only.</div>
  </aside>
  <main class="main">
    <header class="topbar"><div class="crumb">${htmlEscape(company.name)} &nbsp;/&nbsp; AI Visibility &nbsp;/&nbsp; <b>Standalone Report</b></div><div class="actions"><button class="btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(location.href)">Copy link</button><button class="btn" onclick="window.print()">Print / Save PDF</button></div></header>
    <p class="hero-copy">${htmlEscape(company.locations?.[0]?.label || "Primary market")} visibility across ${htmlEscape(totalPrompts)} HVAC prompts and ${htmlEscape(surfaceRows.length)} AI search surfaces.</p>
    <section id="overview" class="grid metrics">
      ${metricCard("Visibility Score", percent(visibilityScore), band(visibilityScore, "visibility"), "visibility", "", visibilityScore >= 0.3 ? "" : "warn")}
      ${metricCard("Prompts Mentioning You", percent(promptCoverage), band(promptCoverage, "mentions"), "mentions", `${mentionedPrompts}/${totalPrompts} (${totalPrompts - mentionedPrompts} missing)`)}
      ${metricCard("Top-Position Rate", percent(topThreeRate), band(topThreeRate, "top3"), "top3", "ranked top 3", "warn")}
      ${metricCard("#1 Position %", percent(topOneRate), band(topOneRate, "top1"), "top1", "ranked #1", "gold")}
      <section class="metric-card"><div class="metric-title">Where You Show Up</div>${surfaceRows.map((row) => barRow(row, `${row.count}/${row.total}`)).join("")}</section>
    </section>
    <section class="summary"><h2>Executive snapshot</h2><p>${htmlEscape(company.name)} is ${visibilityScore >= 0.3 ? "competitive" : "under-visible"} in AI recommendations for this market. The main opportunity is to turn existing reputation signals into repeated AI mentions across high-intent HVAC prompts, then strengthen the third-party citation footprint AI already uses.</p><div class="summary-grid"><div class="summary-card"><span>AI visibility</span><b>${percent(visibilityScore)}</b></div><div class="summary-card"><span>Prompt coverage</span><b>${mentionedPrompts}/${totalPrompts}</b></div><div class="summary-card"><span>Top citation source</span><b>${htmlEscape(citationRows[0]?.domain || "N/A")}</b></div></div></section>
    <section class="grid body-grid">
      <article class="panel"><div class="panel-head"><div class="panel-title">Category Coverage</div><span>Where you appear by prompt category</span></div><div class="panel-body">${categoryRows.map((row) => barRow(row, `${row.count}/${row.total}`)).join("")}</div></article>
      <article class="panel"><div class="panel-head"><div class="panel-title">Citation Volume by Source Type</div><span>Gemini citations</span></div><div class="panel-body">${typeRows.map((row) => barRow(row, `${row.count} citations`)).join("")}</div></article>
    </section>
    <section class="grid body-grid">
      <article class="panel"><div class="panel-head"><div class="panel-title">Visibility Score Leaderboard</div><span>Top 10</span></div><div class="panel-body">${visibilityLeaderboard.map((row) => leaderboardRow(row, "visibility", "checks", "visibility")).join("")}</div></article>
      <article class="panel"><div class="panel-head"><div class="panel-title">Prompt Mention Leaderboard</div><span>Top 10</span></div><div class="panel-body">${mentionLeaderboard.map((row) => leaderboardRow(row, "mentionRate", "prompts", "mentions")).join("")}</div></article>
    </section>
    <section id="prompts" class="grid body-grid">
      <article class="panel"><div class="panel-head"><div class="panel-title">Prompts Where You Rank</div><span>Your top wins</span></div><div class="panel-body"><ul class="prompt-list">${wins.map((row) => `<li><b>${htmlEscape(row.text)}</b><em>${htmlEscape(row.category)}</em><span class="rank ${row.bestRank === 1 ? "" : "gold"}">#${htmlEscape(row.bestRank)}</span></li>`).join("")}</ul></div></article>
      <article class="panel"><div class="panel-head"><div class="panel-title">Prompts To Improve</div><span>Missing from current results</span></div><div class="panel-body"><ul class="prompt-list">${misses.map((row) => `<li><b>${htmlEscape(row.text)}</b><em>${htmlEscape(row.category)}</em><span class="rank gold">Missing</span></li>`).join("")}</ul></div></article>
    </section>
    <section id="citations" class="panel wide" style="margin-top:16px"><div class="panel-head"><div class="panel-title">Top Cited Domains</div><span>Exact URLs grouped by citation source</span></div><div class="panel-body" style="padding:0"><table class="table"><thead><tr><th>Source</th><th>Type</th><th>Citations</th><th>Top cited URLs</th></tr></thead><tbody>${citationRows.map((row) => `<tr><td><strong>${htmlEscape(row.domain)}</strong></td><td>${tag(row.type)}</td><td><strong>${htmlEscape(row.count)}</strong></td><td><ul class="url-list">${[...row.urls.values()].sort((a, b) => b.count - a.count).slice(0, 5).map((urlRow) => `<li><a href="${htmlEscape(urlRow.url)}">${htmlEscape(urlRow.title)}</a> <span>(${htmlEscape(urlRow.count)})</span></li>`).join("") || "<li>No article-level URL captured.</li>"}</ul></td></tr>`).join("")}</tbody></table></div></section>
    <section id="sentiment" class="panel wide" style="margin-top:16px"><div class="panel-head"><div class="panel-title">Sentiment Direction</div><span>Representative theme summary</span></div><div class="panel-body"><p><strong>What is working:</strong> AI responses tend to reward visible reputation signals, review volume, broad service coverage, and strong local recognition.</p><p><strong>What hurts:</strong> gaps usually come from weak citation ownership, competitor-dominated third-party sources, or not appearing consistently in the highest-intent prompt categories.</p></div></section>
  </main>
</div>
</body>
</html>`;

const outputDir = path.join(projectRoot, "exports");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "netic-aeo-standalone.html");
fs.writeFileSync(outputPath, html);
console.log(outputPath);
