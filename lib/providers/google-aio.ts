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
const DFS_BASE = "https://api.dataforseo.com";
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

function dfsLocationName(location: Location): string {
  const state = US_STATES[(location.state || "").toUpperCase().trim()] || location.state;
  const city = location.city || location.label;
  return [city, state, "United States"].filter(Boolean).join(",");
}

function dfsAuthHeader(): string | null {
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

  const body = [{
    keyword: params.query.text,
    location_name: dfsLocationName(params.location),
    language_code: "en"
  }];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let json: any;
  try {
    const response = await fetch(DFS_BASE + AI_MODE_PATH, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`DataForSEO HTTP ${response.status}`);
    json = await response.json();
  } finally {
    clearTimeout(timer);
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
    knownCompetitors: params.company.competitors
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
