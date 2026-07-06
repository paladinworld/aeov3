// Aggregate the 30-market HVAC study (data-market/db.json) into one JSON the research
// dashboard embeds. Applies the SAME blended-score methodology as the app per market, then
// rolls up the cross-market findings (reviews-vs-AI, engine divergence, AI-vs-SEO, concentration).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = JSON.parse(fs.readFileSync(path.join(ROOT, "data-market/db.json"), "utf8"));

// The 30 study markets (exclude the Austin pilot). city -> {tier, region, climate}
const MARKETS = {
  "Phoenix": { tier: 1, region: "Southwest", climate: "Hot" }, "Houston": { tier: 1, region: "Gulf", climate: "Hot" },
  "Atlanta": { tier: 1, region: "Southeast", climate: "Mixed" }, "Chicago": { tier: 1, region: "Midwest", climate: "Cold" },
  "Denver": { tier: 1, region: "Mountain", climate: "Cold" }, "Seattle": { tier: 1, region: "Pacific NW", climate: "Mild" },
  "Tampa": { tier: 1, region: "Southeast", climate: "Hot" }, "San Francisco": { tier: 1, region: "West", climate: "Mild" },
  "Los Angeles": { tier: 1, region: "West", climate: "Mild" }, "Miami": { tier: 1, region: "Southeast", climate: "Hot" },
  "Brooklyn": { tier: 1, region: "Northeast", climate: "Mixed" }, "Boston": { tier: 1, region: "Northeast", climate: "Cold" },
  "Dallas": { tier: 1, region: "Gulf", climate: "Hot" }, "Washington": { tier: 1, region: "Mid-Atlantic", climate: "Mixed" },
  "Philadelphia": { tier: 1, region: "Northeast", climate: "Mixed" }, "Detroit": { tier: 1, region: "Midwest", climate: "Cold" },
  "Minneapolis": { tier: 1, region: "Midwest", climate: "Cold" },
  "Charlotte": { tier: 2, region: "Southeast", climate: "Mixed" }, "Nashville": { tier: 2, region: "South", climate: "Mixed" },
  "Kansas City": { tier: 2, region: "Midwest", climate: "Mixed" }, "Columbus": { tier: 2, region: "Midwest", climate: "Cold" },
  "Sacramento": { tier: 2, region: "West", climate: "Hot" }, "Salt Lake City": { tier: 2, region: "Mountain", climate: "Cold" },
  "Richmond": { tier: 2, region: "Mid-Atlantic", climate: "Mixed" },
  "Boise": { tier: 3, region: "Mountain", climate: "Cold" }, "Tulsa": { tier: 3, region: "South", climate: "Mixed" },
  "Des Moines": { tier: 3, region: "Midwest", climate: "Cold" }, "Spokane": { tier: 3, region: "Pacific NW", climate: "Cold" },
  "Fort Myers": { tier: 3, region: "Southeast", climate: "Hot" }, "Chattanooga": { tier: 3, region: "South", climate: "Mixed" },
};

const GENERIC = new Set(["air","heating","cooling","hvac","plumbing","electrical","electric","conditioning","conditioner","services","service","company","co","inc","llc","the","and","of","home","comfort","heat","systems","solutions","mechanical","repair","installation","cool","climate","pro","pros","best","top","local","expert","experts","quality","affordable","guys","masters","specialist","specialists","temperature","temp","breeze","aire"]);
const US_STATES = { AZ:"arizona",TX:"texas",GA:"georgia",IL:"illinois",CO:"colorado",WA:"washington",FL:"florida",CA:"california",NY:"newyork",MA:"massachusetts",DC:"districtofcolumbia",PA:"pennsylvania",MI:"michigan",MN:"minnesota",NC:"northcarolina",TN:"tennessee",MO:"missouri",OH:"ohio",UT:"utah",VA:"virginia",ID:"idaho",OK:"oklahoma",IA:"iowa" };
const norm = (s) => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const isReal = (r) => !String(r.rawAnswer||"").startsWith("Provider error:");
const isDomainLike = (n) => /(^https?:)|([a-z0-9-]+\.(com|net|org|io|co|us|biz|info))/i.test(n) || (!/\s/.test(n) && n.includes("."));
const AI = ["gemini_search","google_ai_overview","chatgpt_search"];
const W = { gemini_search:0.5, google_ai_overview:0.3, chatgpt_search:0.2 };

function analyzeMarket(report, company) {
  const p = company.locations[0];
  const placeStop = new Set([...p.city.toLowerCase().split(/[^a-z0-9]+/g), (p.state||"").toLowerCase(), US_STATES[(p.state||"").toUpperCase()]||""].filter(Boolean));
  const tok = (n) => (n||"").toLowerCase().split(/[^a-z0-9]+/g).filter(t=>t.length>=3 && !GENERIC.has(t) && !placeStop.has(t));
  const ck = (n) => { const t=tok(n); return t.length?t.join(""):norm(n); };
  const sr = { gemini_search:[], google_ai_overview:[], chatgpt_search:[] };
  for (const r of report.runs) if (AI.includes(r.surface) && isReal(r)) sr[r.surface].push(r);
  const tq = report.queries.length || 1;
  const reg = {};
  for (const s of AI) for (const run of sr[s]) for (const m of run.mentions||[]) {
    const nm=(m.companyName||"").trim(); if(!nm) continue; const k=ck(nm); if(!k) continue;
    reg[k]=reg[k]||{d:nm,total:0,eng:{gemini_search:{m:0,q:new Set(),t3:0,t1:0},google_ai_overview:{m:0,q:new Set(),t3:0,t1:0},chatgpt_search:{m:0,q:new Set(),t3:0,t1:0}}};
    if(!isDomainLike(nm)&&nm.length>reg[k].d.length)reg[k].d=nm; reg[k].total++;
    const e=reg[k].eng[s]; e.m++; e.q.add(run.queryId); if(m.rank&&m.rank<=3)e.t3++; if(m.rank===1)e.t1++;
  }
  const es=(e,s)=>{const R=sr[s].length; if(!R||!e.m) return 0; return .5*(e.m/R)+.25*(e.q.size/tq)+.15*(e.t3/R)+.1*(e.t1/R);};
  // GBP lookup
  const gbp = new Map();
  for (const g of report.gbp||[]) { const k=ck(g.name); if(!k) continue; const pv=gbp.get(k); if(!pv||(g.reviews??0)>(pv.reviews??0)) gbp.set(k,g); }
  const totalAI = sr.gemini_search.length+sr.google_ai_overview.length+sr.chatgpt_search.length;
  const companies = Object.values(reg).filter(c=>!isDomainLike(c.d)).map(c=>{
    const overall = es(c.eng.gemini_search,"gemini_search")*W.gemini_search + es(c.eng.google_ai_overview,"google_ai_overview")*W.google_ai_overview + es(c.eng.chatgpt_search,"chatgpt_search")*W.chatgpt_search;
    const g=gbp.get(ck(c.d));
    return { name:c.d, total:c.total, overall, share:+(100*c.total/totalAI).toFixed(1), reviews:g?.reviews??null, rating:g?.rating??null,
      g1:es(c.eng.gemini_search,"gemini_search"), a1:es(c.eng.google_ai_overview,"google_ai_overview"), c1:es(c.eng.chatgpt_search,"chatgpt_search") };
  }).sort((a,b)=>b.overall-a.overall);
  // engine #1 agreement
  const topBy=(k)=>[...companies].filter(c=>c[k]>0).sort((a,b)=>b[k]-a[k])[0]?.name;
  const gT=topBy("g1"),aT=topBy("a1"),cT=topBy("c1");
  const engineAgree = gT&&gT===aT&&aT===cT;
  // directory share of organic top-3
  let dirTop=0,orgN=0; for(const q of report.queries){const o=(report.serp?.[q.id]?.organic||[]).slice(0,3); dirTop+=o.filter(x=>x.isDirectory).length; orgN+=Math.min(3,o.length)||3;}
  const dirShare = Math.round(100*dirTop/orgN);
  // concentration: companies covering 50% of mentions
  let cum=0, n50=0; for(const c of companies){cum+=c.total; n50++; if(cum>=totalAI*0.5)break;}
  // most-reviewed company (with GBP) and whether it's the AI #1
  const withRev = companies.filter(c=>c.reviews!=null);
  const mostReviewed = [...withRev].sort((a,b)=>(b.reviews||0)-(a.reviews||0))[0];
  const aiLeader = companies[0];
  return {
    city:p.city, ...MARKETS[p.city],
    companiesNamed: companies.length,
    aiLeader: { name:aiLeader?.name, share:aiLeader?.share, reviews:aiLeader?.reviews, rating:aiLeader?.rating },
    mostReviewed: mostReviewed?{name:mostReviewed.name, reviews:mostReviewed.reviews, aiRankOfMostReviewed: companies.findIndex(c=>c.name===mostReviewed.name)+1}:null,
    leaderIsMostReviewed: mostReviewed && aiLeader && mostReviewed.name===aiLeader.name,
    engineAgree, top1Share: aiLeader?.share, companiesFor50pct: n50, directoryShareTop3: dirShare,
    // top 10 companies for the scatter (reviews vs AI)
    top: companies.slice(0,10).map(c=>({name:c.name, overall:+c.overall.toFixed(3), share:c.share, reviews:c.reviews, rating:c.rating, aiRank: companies.indexOf(c)+1})),
  };
}

const markets = [];
for (const r of db.reports.filter(x=>x.market&&x.status==="complete")) {
  const co = db.companies.find(c=>c.id===r.companyId);
  const city = co?.locations?.[0]?.city;
  if (!MARKETS[city]) continue; // skip Austin pilot
  markets.push(analyzeMarket(r, co));
}
markets.sort((a,b)=>(b.top1Share||0)-(a.top1Share||0));

// Cross-market aggregates
const n = markets.length;
const agg = {
  markets: n,
  medianCompaniesNamed: [...markets].map(m=>m.companiesNamed).sort((a,b)=>a-b)[Math.floor(n/2)],
  avgTop1Share: +(markets.reduce((a,m)=>a+(m.top1Share||0),0)/n).toFixed(1),
  avgCompaniesFor50pct: +(markets.reduce((a,m)=>a+m.companiesFor50pct,0)/n).toFixed(1),
  engineAgreePct: Math.round(100*markets.filter(m=>m.engineAgree).length/n),
  leaderIsMostReviewedPct: Math.round(100*markets.filter(m=>m.leaderIsMostReviewed).length/n),
  avgDirectoryShareTop3: Math.round(markets.reduce((a,m)=>a+m.directoryShareTop3,0)/n),
};
// reviews-vs-AI scatter points (all top-10 companies across markets that have GBP)
const scatter = [];
for (const m of markets) for (const c of m.top) if (c.reviews!=null) scatter.push({ city:m.city, name:c.name, reviews:c.reviews, aiScore:+(c.overall*100).toFixed(1), aiRank:c.aiRank, rating:c.rating });

fs.writeFileSync(path.join(ROOT, "data-market/study-aggregate.json"), JSON.stringify({ agg, markets, scatter }, null, 2));
console.log("markets:", n, "| scatter points:", scatter.length);
console.log("agg:", JSON.stringify(agg, null, 0));
console.log("sample leaders:", markets.slice(0,5).map(m=>`${m.city}: ${m.aiLeader.name} (${m.aiLeader.share}%, ${m.aiLeader.reviews??"?"} rev)`).join(" | "));
