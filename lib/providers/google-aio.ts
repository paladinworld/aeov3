import { Citation, Company, Location, Query, SurfaceRun } from "../types";
import { id } from "../store";
import { mockSurfaceRun } from "./mock";
import { extractMentions } from "./gemini";

// Google AI Mode (the dashboard's `google_ai_overview` surface) is collected from
// DataForSEO's live SERP API — Google does not expose AI Mode through a public model
// API. We hit /serp/google/ai_mode/live/advanced, take the AI Mode answer markdown as
// the raw answer, map its `references` to citations (dropping Google-owned redirect
// junk), and reuse the shared Gemini extractor to rank company mentions — so AI Mode
// rows look identical in shape to the Gemini/ChatGPT surfaces.
export const DFS_BASE = "https://api.dataforseo.com";
const AI_MODE_PATH = "/v3/serp/google/ai_mode/live/advanced";

// DataForSEO wants a full location string ("Houston,Texas,United States"); our company
// locations store a 2-letter state, so expand it.
const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia"
};

// Google-owned / redirect hosts that aren't real citations — same family we stripped
// from the existing reports' AI Mode data.
const JUNK_DOMAIN = /(^|\.)(google\.com|googleusercontent\.com|gstatic\.com|googleapis\.com|streetviewpixels-pa\.googleapis\.com)$/i;

// Some markets people genuinely search by are REGIONS, not DataForSEO-recognized cities
// ("Long Island, NY"). DataForSEO rejects those with 40501 Invalid location_name, which
// would silently zero out AI Mode for the whole report. Map known regions to a
// representative city inside them so the geo-targeting still lands in the right place;
// anything not listed falls through to city,state (and then a state-level retry).
const REGION_ALIASES: Record<string, string> = {
  "long island,ny": "Hempstead,New York,United States",
  "inland empire,ca": "Riverside,California,United States",
  "bay area,ca": "San Francisco,California,United States",
  "south bay,ca": "San Jose,California,United States",
  "silicon valley,ca": "San Jose,California,United States",
  "dmv,dc": "Washington,District of Columbia,United States",
  "northern virginia,va": "Arlington,Virginia,United States",
  "central florida,fl": "Orlando,Florida,United States",
  "south florida,fl": "Miami,Florida,United States",
  "the triangle,nc": "Raleigh,North Carolina,United States",
  "triangle,nc": "Raleigh,North Carolina,United States"
};

export function dfsLocationName(location: Location): string {
  const state2 = (location.state || "").toUpperCase().trim();
  const stateFull = US_STATES[state2] || location.state;
  const city = location.city || location.label;
  const alias = REGION_ALIASES[`${(city || "").toLowerCase().trim()},${state2.toLowerCase()}`];
  if (alias) return alias;
  return [city, stateFull, "United States"].filter(Boolean).join(",");
}

// State-level location string — the fallback when a precise location is rejected, so
// AI Mode still returns a (state-geo-targeted) answer rather than erroring the run.
export function dfsStateLocation(location: Location): string | null {
  const stateFull = US_STATES[(location.state || "").toUpperCase().trim()] || location.state;
  return stateFull ? `${stateFull},United States` : null;
}

export const DFS_INVALID_LOCATION = 40501;

export function dfsAuthHeader(): string | null {
  const b64 = process.env.DATAFORSEO_B64;
  if (b64) return `Basic ${b64}`;
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (login && password) return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
  return null;
}

// Strip DataForSEO image embeds and collapse blank runs so the stored answer reads like
// the clean prose the other surfaces store (the markdown otherwise carries ![](cdn) tags
// and local-business card whitespace).
function cleanAnswer(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toCitations(references: Array<{ url?: string; title?: string; domain?: string }>): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const ref of references || []) {
    const url = (ref.url || "").trim();
    if (!url) continue;
    let domain = (ref.domain || "").replace(/^www\./, "").toLowerCase();
    if (!domain) {
      try { domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { continue; }
    }
    if (JUNK_DOMAIN.test(domain)) continue; // Google-owned redirect, not a real source
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title: (ref.title || domain).trim(), url, domain });
  }
  return out;
}

export async function runGoogleAiOverview(params: {
  company: Company;
  location: Location;
  query: Query;
  runNumber: number;
}): Promise<SurfaceRun> {
  const auth = dfsAuthHeader();
  if (process.env.DEMO_MODE !== "false" || !auth) {
    return mockSurfaceRun({ ...params, surface: "google_ai_overview" });
  }

  const callAiMode = async (location_name: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(DFS_BASE + AI_MODE_PATH, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify([{ keyword: params.query.text, location_name, language_code: "en" }]),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`DataForSEO HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  let json: any = await callAiMode(dfsLocationName(params.location));
  // If DataForSEO doesn't recognize the location (e.g. an unaliased region), retry once
  // geo-targeting the state so the run still produces an AI Mode answer instead of erroring.
  if (json?.status_code === 20000 && json.tasks?.[0]?.status_code === DFS_INVALID_LOCATION) {
    const stateLoc = dfsStateLocation(params.location);
    if (stateLoc) json = await callAiMode(stateLoc);
  }

  if (json?.status_code !== 20000) throw new Error(`DataForSEO error: ${json?.status_code} ${json?.status_message}`);
  const task = json.tasks?.[0];
  if (task?.status_code !== 20000) throw new Error(`DataForSEO task error: ${task?.status_code} ${task?.status_message}`);

  const items: Array<{ type: string; markdown?: string; references?: any[] }> = task.result?.[0]?.items || [];
  const ai = items.find((x) => x.type === "ai_overview");
  if (!ai || !ai.markdown) throw new Error("DataForSEO returned no AI Mode answer for this query");

  const answer = cleanAnswer(ai.markdown);
  const citations = toCitations(ai.references || []);
  const mentions = await extractMentions({
    answer,
    citations,
    targetCompanyName: params.company.name,
    knownCompetitors: params.company.competitors,
    targetPlace: `${params.location.city} ${params.location.state}`
  });

  return {
    id: id("run"),
    queryId: params.query.id,
    queryText: params.query.text,
    locationId: params.location.id,
    locationLabel: params.location.label,
    surface: "google_ai_overview",
    runNumber: params.runNumber,
    rawAnswer: answer,
    mentions: mentions.map((mention) => ({ ...mention, citations: [] })),
    citations,
    createdAt: new Date().toISOString()
  };
}
