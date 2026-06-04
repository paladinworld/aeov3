import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const db = JSON.parse(fs.readFileSync("data/db.json", "utf8"));
// Representative set (the prompt structure/metadata is identical across reports;
// only the embedded city differs, which we templatize below).
const report = db.reports.find((r) => r.id === "report_mpz2g95w_pyt7yv");
const queries = report.queries;

function funnelCategory(q) {
  if (q.intent === "emergency") return "Emergency Repair";
  if (q.intent === "near_me" || q.intent === "best") return "Core Local Service";
  return "Research";
}

const SURFACE = {
  gemini_maps: "Google Maps (local pack)",
  gemini_search: "Google AI Overview",
  chatgpt_search: "ChatGPT"
};

// Strip the specific city so the export reads as a reusable template.
function templatize(text) {
  return text.replace(/Cleveland,\s*OH/gi, "{City, ST}").replace(/\bCleveland\b/gi, "{City}");
}

function esc(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const cols = ["#", "Prompt", "Funnel Category", "Topic", "Intent", "Service", "Priority", "Query Depth", "Long Tail", "AI Surfaces"];
const rows = queries.map((q, i) => [
  i + 1,
  templatize(q.text),
  funnelCategory(q),
  q.category,
  q.intent,
  q.service,
  q.priority,
  q.queryDepth,
  q.longTail ? "yes" : "no",
  q.surfaces.map((s) => SURFACE[s] || s).join(" / ")
]);

const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
const out = path.join(os.homedir(), "Downloads", "netic-aeo-prompts.csv");
fs.writeFileSync(out, csv);

const byCat = {};
queries.forEach((q) => (byCat[funnelCategory(q)] = (byCat[funnelCategory(q)] || 0) + 1));
console.log("WROTE:", out);
console.log("rows:", queries.length, "| by funnel category:", JSON.stringify(byCat));
console.log("\nPreview (first 6):");
rows.slice(0, 6).forEach((r) => console.log("  [" + r[2] + " / " + r[4] + "] " + r[1] + "  (" + r[9] + ")"));
