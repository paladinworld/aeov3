#!/usr/bin/env node
// Strongest-market scout for a national brand — run BEFORE the real audit to pick ONE city.
//
//   node scripts/scout.mjs scout-input.json
//
// Input JSON: { "brand": "Hiller", "vertical": "HVAC", "locations": [{ "city": "Nashville", "state": "TN" }, ...] }
//   vertical ∈ HVAC | Pest Control | Tree Care | Commercial Landscaping (default HVAC).
//
// PRIMARY signal = AI-Mode VISIBILITY: for each metro it asks DataForSEO Google AI Mode the
// vertical's core "best …" prompts and checks whether the brand is named. This DIRECTLY
// predicts AI-audit performance — unlike Google-review count, which we proved does NOT
// correlate (Moxie 7.5k reviews → 1% Gemini; Hiller's HQ Nashville lost to tiny Cookeville).
// Review count is still pulled as SECONDARY context. ~$0.004/AI-Mode call (3 calls/metro).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const AUTH = "Basic " + env.DATAFORSEO_B64;

const STATES = { AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia" };

// Vertical → 3 core high-intent "best …" prompts ({p} = "City, ST"). These are the prompts
// where a brand SHOULD appear if it has any AI visibility — the sharpest signal.
const PROMPTS = {
  "HVAC": ["best HVAC company in {p}", "best heating and cooling company in {p}", "AC repair in {p}"],
  "Pest Control": ["best pest control company in {p}", "top rated pest control company in {p}", "exterminator in {p}"],
  "Tree Care": ["best tree service in {p}", "tree removal company in {p}", "best arborist in {p}"],
  "Commercial Landscaping": ["best commercial landscaping company in {p}", "commercial grounds maintenance in {p}", "HOA landscaping company in {p}"],
  "Plumbing": ["best plumber in {p}", "best plumbing company in {p}", "water heater installation in {p}"],
  "Roofing": ["best roofing company in {p}", "top rated roofing company in {p}", "roof replacement in {p}"],
  "Windows": ["best window replacement company in {p}", "replacement windows in {p}", "window installation in {p}"],
  "Foundation": ["best foundation repair company in {p}", "top rated foundation repair company in {p}", "basement waterproofing in {p}"]
};

const input = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || "scout-input.json"), "utf8"));
const brand = input.brand;
const vertical = input.vertical || "HVAC";
const prompts = PROMPTS[vertical] || PROMPTS["HVAC"];
// Distinctive brand token(s) to look for in answers (strip generic industry words).
const GENERIC = new Set(["pest","control","services","service","inc","llc","company","co","home","the","and","of","heating","air","cooling","conditioning","plumbing","electrical","electric","hvac","tree","lawn","landscape","landscaping","grounds","exterminating","exterminator","termite","cooling","plumber","plumbers","roof","roofing","roofer","roofers","exterior","exteriors","siding","gutter","gutters","windows","restoration","construction","contractors","contractor"]);
const brandTokens = brand.toLowerCase().split(/[\s&,]+/).filter((t) => t.length >= 3 && !GENERIC.has(t));
const named = (md = "") => { const t = md.toLowerCase(); return brandTokens.some((tok) => t.includes(tok)); };

async function aiMode(keyword, location_name) {
  try {
    const r = await fetch("https://api.dataforseo.com/v3/serp/google/ai_mode/live/advanced", {
      method: "POST", headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword, location_name, language_code: "en" }])
    });
    const t = (await r.json()).tasks?.[0];
    const it = (t?.result?.[0]?.items || []).find((x) => x.type === "ai_overview");
    return { md: it?.markdown || "", cost: t?.cost || 0 };
  } catch { return { md: "", cost: 0 }; }
}
async function reviews(city, state) {
  try {
    const r = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
      method: "POST", headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword: brand, location_name: `${city},${STATES[state] || state},United States`, language_code: "en", depth: 10 }])
    });
    const items = ((await r.json()).tasks?.[0]?.result?.[0]?.items || []).filter((x) => x.type === "maps_search");
    const hit = items.find((it) => named(it.title));
    return hit ? hit.rating?.votes_count ?? 0 : null;
  } catch { return null; }
}
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }

(async () => {
  console.log(`Scouting ${input.locations.length} metros for "${brand}" (${vertical}) — AI-Mode visibility…\n`);
  let cost = 0;
  const results = await pool(input.locations, 8, async ({ city, state }) => {
    const loc = `${city},${STATES[state] || state},United States`;
    let hits = 0;
    for (const p of prompts) { const { md, cost: c } = await aiMode(p.replaceAll("{p}", `${city}, ${state}`), loc); cost += c; if (named(md)) hits++; }
    const rev = await reviews(city, state);
    return { city, state, pct: Math.round((100 * hits) / prompts.length), hits, rev };
  });
  results.sort((a, b) => b.pct - a.pct || (b.rev ?? -1) - (a.rev ?? -1));
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("METRO", 24) + pad("AI-MODE VIS", 13) + "REVIEWS");
  console.log("-".repeat(46));
  for (const r of results) console.log(pad(`${r.city}, ${r.state}`, 24) + pad(`${r.pct}% (${r.hits}/${prompts.length})`, 13) + (r.rev ?? "—"));
  const top = results.filter((r) => r.pct > 0).slice(0, 3);
  console.log(`\n▶ Run the audit here (best AI visibility): ${top.length ? top.map((r) => `${r.city}, ${r.state} (${r.pct}%)`).join("  |  ") : "none surfaced — brand likely weak in AI everywhere"}`);
  console.log(`(AI-Mode probe cost ~$${cost.toFixed(3)}. Review count shown as secondary context only — it does NOT predict AI visibility.)`);
})();
