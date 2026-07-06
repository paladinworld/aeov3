// Deep-dive insight extraction for the "State of AI Search for Home Services" report.
// Computes, across the 30 study markets:
//  1. VOLATILITY — same prompt, same engine, 3 repeats: how often does the #1 named company
//     change between repeats? How often does a company named in one run vanish in another?
//  2. CITATION SOURCES — top cited domains per engine (the real version of the mock table).
//  3. TIER CUTS — concentration / citation mix / leader share by market tier.
//  4. REVIEWS vs AI — median reviews of the AI #1 vs the market's most-reviewed company.
//  5. AI-vs-ORGANIC OVERLAP — % of AI's top-10 companies with zero presence in organic results.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = JSON.parse(fs.readFileSync(path.join(ROOT, "data-market/db.json"), "utf8"));

const TIER = { "Phoenix":1,"Houston":1,"Atlanta":1,"Chicago":1,"Denver":1,"Seattle":1,"Tampa":1,"San Francisco":1,"Los Angeles":1,"Miami":1,"Brooklyn":1,"Boston":1,"Dallas":1,"Washington":1,"Philadelphia":1,"Detroit":1,"Minneapolis":1,
  "Charlotte":2,"Nashville":2,"Kansas City":2,"Columbus":2,"Sacramento":2,"Salt Lake City":2,"Richmond":2,
  "Boise":3,"Tulsa":3,"Des Moines":3,"Spokane":3,"Fort Myers":3,"Chattanooga":3 };
const AI = ["gemini_search","google_ai_overview","chatgpt_search"];
const ENG = { gemini_search:"Gemini", google_ai_overview:"AI Mode", chatgpt_search:"ChatGPT" };
const GENERIC = new Set(["air","heating","cooling","hvac","plumbing","electrical","electric","conditioning","conditioner","services","service","company","co","inc","llc","the","and","of","home","comfort","heat","systems","solutions","mechanical","repair","installation","cool","climate","pro","pros","best","top","local","expert","experts","quality","affordable","guys","masters","specialist","specialists","temperature","temp","breeze","aire"]);
const norm = (s)=> (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const isReal = (r)=> !String(r.rawAnswer||"").startsWith("Provider error:");

const reports = db.reports.filter(r=>r.market && r.status==="complete").map(r=>({r, city:(db.companies.find(c=>c.id===r.companyId)||{}).locations?.[0]?.city})).filter(x=>TIER[x.city]);

// ---------- 1. VOLATILITY ----------
let pairs=0, top1Changed=0, memberChanges=0, memberTotal=0;
for (const {r} of reports) {
  const ps = new Set([...(r.city||""), ]); // placeholder no-op
  const placeStop = null;
  for (const q of r.queries) for (const s of AI) {
    const runs = r.runs.filter(x=>x.queryId===q.id && x.surface===s && isReal(x));
    if (runs.length < 2) continue;
    const tops = runs.map(x=>{const m=(x.mentions||[]).find(z=>z.rank===1)||(x.mentions||[])[0];return m?norm(m.companyName):null;});
    const namedSets = runs.map(x=>new Set((x.mentions||[]).map(z=>norm(z.companyName)).filter(Boolean)));
    pairs++;
    if (new Set(tops.filter(Boolean)).size > 1 || tops.some(t=>!t)&&tops.some(t=>t)) top1Changed++;
    // membership churn: companies in run A missing from run B (pairwise, first two runs)
    const [a,b] = namedSets;
    if (a && b) { const uni=new Set([...a,...b]); let inter=0; for(const x of a) if(b.has(x)) inter++; memberTotal++; memberChanges += uni.size? 1-(inter/uni.size) : 0; }
  }
}

// ---------- 2. CITATION SOURCES per engine ----------
const cite = { gemini_search:{}, google_ai_overview:{}, chatgpt_search:{} };
const citeTotals = { gemini_search:0, google_ai_overview:0, chatgpt_search:0 };
const tierCite = {1:{},2:{},3:{}}; const tierCiteTot={1:0,2:0,3:0};
for (const {r,city} of reports) {
  const tier = TIER[city];
  for (const run of r.runs) {
    if (!AI.includes(run.surface) || !isReal(run)) continue;
    const cs = run.citations && run.citations.length ? run.citations : (run.mentions||[]).flatMap(m=>m.citations||[]);
    const seen = new Set();
    for (const c of cs) {
      let d = (c.domain||"").toLowerCase().replace(/^www\./,"");
      if (!d && c.url) { try{ d=new URL(c.url).hostname.replace(/^www\./,"").toLowerCase(); }catch{} }
      if (!d || seen.has(d)) continue; seen.add(d);
      cite[run.surface][d]=(cite[run.surface][d]||0)+1; citeTotals[run.surface]++;
      tierCite[tier][d]=(tierCite[tier][d]||0)+1; tierCiteTot[tier]++;
    }
  }
}
const topCites = (obj,total,n=12)=>Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([d,c])=>`${d} ${(100*c/total).toFixed(1)}%`);

// classify domain type for tier comparison
const DIRS=["yelp.","angi.","thumbtack.","homeadvisor.","bbb.org","yellowpages","houzz.","porch.","networx","expertise.com","bestprosintown","birdeye","trustpilot","consumeraffairs","top10","bestpick"];
const SOCIAL=["reddit.","youtube.","facebook.","instagram.","nextdoor.","tiktok."];
const classify=(d)=> DIRS.some(x=>d.includes(x))?"directory": SOCIAL.some(x=>d.includes(x))?"community": (d.includes("google.")||d.includes("gstatic"))?"google":"company/other";
const tierMix={};
for (const t of [1,2,3]) { const mix={}; for(const [d,c] of Object.entries(tierCite[t])){ const k=classify(d); mix[k]=(mix[k]||0)+c; } tierMix[t]=Object.fromEntries(Object.entries(mix).map(([k,v])=>[k, Math.round(100*v/tierCiteTot[t])+"%"])); }

// ---------- 3/4/5 per-market ----------
function marketStats({r,city}) {
  const p=(db.companies.find(c=>c.id===r.companyId)||{}).locations?.[0]||{};
  const placeStop=new Set([...(p.city||"").toLowerCase().split(/[^a-z0-9]+/g),(p.state||"").toLowerCase()].filter(Boolean));
  const tok=(n)=>(n||"").toLowerCase().split(/[^a-z0-9]+/g).filter(t=>t.length>=3&&!GENERIC.has(t)&&!placeStop.has(t));
  const ck=(n)=>{const t=tok(n);return t.length?t.join(""):norm(n);};
  const counts={}; const disp={};
  for (const run of r.runs){ if(!AI.includes(run.surface)||!isReal(run))continue; for(const m of run.mentions||[]){const nm=(m.companyName||"").trim(); if(!nm||nm.includes("."))continue; const k=ck(nm); counts[k]=(counts[k]||0)+1; if(!disp[k]||nm.length>disp[k].length)disp[k]=nm;} }
  const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const gbp=new Map(); for(const g of r.gbp||[]){const k=ck(g.name); const pv=gbp.get(k); if(!pv||(g.reviews??0)>(pv.reviews??0))gbp.set(k,g);}
  const leaderKey=ranked[0]?.[0]; const leaderRev=gbp.get(leaderKey)?.reviews??null;
  const maxRev=Math.max(0,...[...gbp.values()].map(g=>g.reviews||0));
  // AI top-10 organic presence
  const organicDomains=new Set();
  for(const q of r.queries) for(const o of (r.serp?.[q.id]?.organic||[])) organicDomains.add(norm(o.domain));
  let zeroOrganic=0, checked=0;
  for(const [k] of ranked.slice(0,10)){ const ts=tok(disp[k]); if(!ts.length)continue; checked++; const hit=[...organicDomains].some(d=>ts.some(t=>d.includes(t))); if(!hit)zeroOrganic++; }
  return { city, tier:TIER[city], leaderRev, maxRev, zeroOrganic, checked };
}
const ms = reports.map(marketStats);
const med=(a)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const leaderRevs=ms.filter(m=>m.leaderRev!=null);
const zeroOrgPct = Math.round(100*ms.reduce((a,m)=>a+m.zeroOrganic,0)/ms.reduce((a,m)=>a+m.checked,0));

console.log("=== 1. VOLATILITY (same prompt, same engine, repeats) ===");
console.log("prompt×engine pairs:",pairs,"| #1 company CHANGED between repeats:",Math.round(100*top1Changed/pairs)+"%");
console.log("avg membership churn between two runs of the same prompt:",Math.round(100*memberChanges/memberTotal)+"% of named companies differ");
console.log("\n=== 2. TOP CITED SOURCES BY ENGINE (share of citing runs) ===");
for(const s of AI){ console.log(ENG[s]+":  "+topCites(cite[s],citeTotals[s]).join(" · ")); }
console.log("\n=== 3. CITATION MIX BY TIER ===");
console.log(JSON.stringify(tierMix));
console.log("\n=== 4. REVIEWS vs AI LEADER ===");
console.log("median reviews of AI #1:",med(leaderRevs.map(m=>m.leaderRev)),"| median of market's MOST-reviewed:",med(ms.map(m=>m.maxRev)));
console.log("markets where AI #1 has <1000 reviews:",leaderRevs.filter(m=>m.leaderRev<1000).length+"/"+leaderRevs.length);
console.log("\n=== 5. AI TOP-10 vs ORGANIC ===");
console.log("share of AI top-10 companies with ZERO organic presence (any of 25 prompts, top-20 results):",zeroOrgPct+"%");
