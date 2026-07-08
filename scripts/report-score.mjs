// Compute a report's AI Visibility Score (0-100) + the target's overall rank, replicating
// DashboardClient's blendedVisibilityForName exactly: per-engine weighted metric
// (0.5·mentionRate + 0.25·promptCoverage + 0.15·top3 + 0.10·top1), blended 50/30/20
// (Gemini/AI Mode/ChatGPT) over PRIMARY prompts, renormalized over engines present.
// Usage: node scripts/report-score.mjs <report.json>  (a GET /api/reports/<id> payload)
import fs from "node:fs";

const PRIMARY = new Set(["Core General", "Repair & Maintenance", "Reviews & Price"]);
const ENGINES = [["gemini_search", 0.5], ["google_ai_overview", 0.3], ["chatgpt_search", 0.2]];
const isReal = (r) => !String(r.rawAnswer || "").startsWith("Provider error:");

const STOP = new Set(["air","and","the","hvac","heat","heating","cooling","plumbing","electric","electrical","services","service","company","home","homes","inc","llc","all","conditioning","conditioner","conditioners","conditioned","comfort","co","corp","pest","control","exterminating","exterminators","exterminator","termite","termites","tree","trees","arborist","lawn","landscape","landscapes","landscaping","grounds","garden","gardens","care","expert","experts","pros","group","foundation","foundations","solutions","solution","structural","waterproofing","basement","crawl","crawlspace","pier","piering","leveling","inspection","inspections","repair","repairs","roof","roofing","roofer","roofers","restoration","construction","contractor","contractors","exterior","exteriors","siding","gutter","gutters","plumber","plumbers","window","windows","installation","replacement","remodeling","water","florida","treatment","softener","softeners","softening","filtration","filter","filters","purification","pure","reverse","osmosis","h2o","heater","heaters","tankless","well","natural","gas","propane","fuel","utility","utilities"]);
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function canonical(name) {
  const toks = (name || "").toLowerCase().split(/[^a-z0-9]+/g).filter((t) => t.length >= 3 && !STOP.has(t));
  return toks.length >= 2 ? toks.join("") : norm(name);
}

const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const rep = payload.report || payload;
const queries = rep.queries || [];
const primaryIds = new Set(queries.filter((q) => PRIMARY.has(q.category)).map((q) => q.id));
const totalPrimary = primaryIds.size || queries.length;
const runs = (rep.runs || []).filter((r) => primaryIds.has(r.queryId) && isReal(r));

// per-engine weighted visibility for a company-key selector
function engineVis(surface, sel) {
  const er = runs.filter((r) => r.surface === surface);
  const R = er.length;
  if (!R) return null;
  let m = 0; const q = new Set(); let t3 = 0, t1 = 0;
  for (const run of er) {
    const hit = (run.mentions || []).find(sel);
    if (!hit) continue;
    m++; q.add(run.queryId);
    if (hit.rank <= 3) t3++;
    if (hit.rank === 1) t1++;
  }
  return 0.5 * (m / R) + 0.25 * (q.size / totalPrimary) + 0.15 * (t3 / R) + 0.10 * (t1 / R);
}
function blended(sel) {
  let acc = 0, w = 0;
  for (const [surface, weight] of ENGINES) {
    if (!runs.some((r) => r.surface === surface)) continue;
    const v = engineVis(surface, sel);
    if (v == null) continue;
    acc += v * weight; w += weight;
  }
  return w ? acc / w : 0;
}

const targetScore = blended((m) => m.isTarget);
// rank across all company keys
const keys = new Set();
for (const run of runs) for (const m of run.mentions || []) {
  if (m.isTarget) continue;
  const nm = (m.companyName || "").trim();
  if (nm && !nm.includes(".")) keys.add(canonical(nm));
}
let better = 0;
for (const k of keys) if (blended((m) => !m.isTarget && canonical(m.companyName) === k) > targetScore) better++;
const rank = better + 1;
const total = keys.size + 1;
console.log(JSON.stringify({ score100: Math.round(targetScore * 100), rank, total }));
