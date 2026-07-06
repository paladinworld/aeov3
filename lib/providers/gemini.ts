import { Company, CompanyMention, Citation, Location, Query, SurfaceRun, TargetedSentimentRun } from "../types";
import { id } from "../store";
import { mockSurfaceRun } from "./mock";
import { GoogleAuth } from "google-auth-library";

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
  groundingMetadata?: {
    groundingChunks?: Array<{
      web?: { title?: string; uri?: string };
      maps?: { title?: string; uri?: string; placeId?: string };
    }>;
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
};

// ── Gemini backend: Developer API (default) or Vertex AI (opt-in) ───────────────
// GEMINI_BACKEND=vertex routes grounded calls through Vertex AI, which has no daily
// grounding cap (pay-per-use) and authenticates via GoogleAuth instead of an API key —
// needed where org policy disallows keys. In practice GOOGLE_APPLICATION_CREDENTIALS
// points at a SERVICE-ACCOUNT key (aeo-audit-runner.json), so tokens auto-refresh and
// never need an interactive login (a stale gcloud user-ADC is NOT what this uses). The
// request body, response parsing, ChatGPT, and AI Mode are all unchanged, and the
// default stays the Developer API, so this is purely additive and reversible.
const VERTEX = process.env.GEMINI_BACKEND === "vertex";
const VERTEX_LOCATION = process.env.GEMINI_VERTEX_LOCATION || "us-central1";
const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID || "";
let _vertexAuth: GoogleAuth | null = null;
let _vertexToken: { token: string; exp: number } | null = null;
async function vertexAccessToken(): Promise<string> {
  if (_vertexToken && _vertexToken.exp > Date.now()) return _vertexToken.token;
  _vertexAuth ??= new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
  const client = await _vertexAuth.getClient();
  const res = await client.getAccessToken();
  const token = (typeof res === "string" ? res : res?.token) || "";
  if (!token) throw new Error("Vertex auth returned no access token — check GOOGLE_APPLICATION_CREDENTIALS (service-account key) is set & valid, then restart the dev server. (NOT a `gcloud auth application-default login` issue — that's a different, unused credential.)");
  _vertexToken = { token, exp: Date.now() + 45 * 60 * 1000 }; // SA-minted tokens last ~1h; refresh at 45m
  return token;
}
function geminiEndpoint(model: string): string {
  if (!VERTEX) return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  if (!VERTEX_PROJECT) throw new Error("GEMINI_BACKEND=vertex requires GOOGLE_CLOUD_PROJECT (or VERTEX_PROJECT_ID) to be set");
  // 3.x models (gemini-3.5-flash) are served from the "global" location, whose host has NO
  // region prefix; regional models use {location}-aiplatform.googleapis.com.
  const host = VERTEX_LOCATION === "global" ? "https://aiplatform.googleapis.com" : `https://${VERTEX_LOCATION}-aiplatform.googleapis.com`;
  return `${host}/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${model}:generateContent`;
}
async function geminiHeaders(apiKey: string): Promise<Record<string, string>> {
  return VERTEX
    ? { "Content-Type": "application/json", Authorization: `Bearer ${await vertexAccessToken()}` }
    : { "Content-Type": "application/json", "x-goog-api-key": apiKey };
}

export async function runGeminiMaps(params: {
  company: Company;
  location: Location;
  query: Query;
  runNumber: number;
}): Promise<SurfaceRun> {
  if (isDemoMode()) {
    return mockSurfaceRun({ ...params, surface: "gemini_maps" });
  }

  const response = await generateGroundedContent({
    prompt: buildPrompt(params),
    tool: "maps",
    location: params.location
  });

  return buildRunFromGemini({
    ...params,
    surface: "gemini_maps",
    response
  });
}

export async function runGeminiSearch(params: {
  company: Company;
  location: Location;
  query: Query;
  runNumber: number;
}): Promise<SurfaceRun> {
  if (isDemoMode()) {
    return mockSurfaceRun({ ...params, surface: "gemini_search" });
  }

  const response = await generateGroundedContent({
    prompt: buildPrompt(params),
    tool: "search",
    location: params.location
  });

  return buildRunFromGemini({
    ...params,
    surface: "gemini_search",
    response
  });
}

export async function runGeminiTargetedSentiment(params: {
  company: Company;
  location: Location;
  prompt: string;
}): Promise<TargetedSentimentRun> {
  if (isDemoMode()) {
    return {
      id: id("targeted_sentiment"),
      surface: "gemini_maps",
      prompt: params.prompt,
      rawAnswer: params.company.name + " appears to be a credible HVAC option in " + params.location.label + ", with strengths around local reputation, relevant HVAC service coverage, and customer proof. Main gaps to verify are pricing clarity, service-area fit, and whether third-party sources consistently support the same story.",
      sentiment: "positive",
      summary: "Positive but qualified homeowner-facing perception.",
      createdAt: new Date().toISOString()
    };
  }

  const response = await generateGroundedContent({
    tool: "maps",
    location: params.location,
    prompt: [
      params.prompt,
      "",
      "Company website: " + params.company.website,
      "",
      "Return JSON only in this shape:",
      "{\"answer\":\"homeowner-facing paragraph with specifics\",\"sentiment\":\"positive|neutral|negative\",\"summary\":\"one sentence summary\"}",
      "Do not include markdown links or raw URLs in the answer."
    ].join("\n")
  });

  const parsed = parseTargetedSentiment(extractAnswer(response));
  return {
    id: id("targeted_sentiment"),
    surface: "gemini_maps",
    prompt: params.prompt,
    rawAnswer: parsed.answer,
    sentiment: parsed.sentiment,
    summary: parsed.summary,
    createdAt: new Date().toISOString()
  };
}

export async function diagnoseGeminiMissingRecommendation(params: {
  company: Company;
  location: Location;
  query: Query;
  originalAnswer: string;
  surface: "gemini_maps" | "gemini_search";
}): Promise<string> {
  if (isDemoMode()) {
    return "The response did not recommend " + params.company.name + " because the visible evidence in this test answer favored other local providers. Strengthen location-specific service pages, review profiles, and third-party proof sources for this query.";
  }

  const response = await generateGroundedContent({
    tool: params.surface === "gemini_maps" ? "maps" : "search",
    location: params.location,
    prompt: [
      "You previously answered this local HVAC recommendation question.",
      "",
      "Location: " + params.location.label,
      "Original question: " + params.query.text,
      "Company being audited: " + params.company.name,
      "Company website: " + params.company.website,
      "Original answer:",
      params.originalAnswer,
      "",
      "Follow-up question: Why did you not recommend " + params.company.name + "?",
      "",
      "Answer in 3-5 concise bullets. Be specific about missing proof, weaker signals, competitor advantages, or source gaps. Do not be polite filler."
    ].join("\n")
  });

  return extractAnswer(response);
}

async function buildRunFromGemini(params: {
  company: Company;
  location: Location;
  query: Query;
  runNumber: number;
  surface: "gemini_maps" | "gemini_search";
  response: GeminiResponse;
}): Promise<SurfaceRun> {
  const answer = extractAnswer(params.response);
  const citations = await extractCitations(params.response);
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
    surface: params.surface,
    runNumber: params.runNumber,
    rawAnswer: answer,
    // Store the source list once on the run; don't duplicate it on every mention.
    mentions: mentions.map((mention) => ({ ...mention, citations: [] })),
    citations,
    createdAt: new Date().toISOString()
  };
}

async function generateGroundedContent(params: {
  prompt: string;
  tool: "search" | "maps";
  location: Location;
}): Promise<GeminiResponse> {
  const apiKey = getApiKey();
  // Google AI Mode model: 3.5-flash surfaces community sources (Reddit ~52% of runs vs
  // ~3% on 2.5-flash) — matching what real Gemini shows consumers. Extraction stays on the
  // cheaper flash-lite via GEMINI_EXTRACTION_MODEL. Grounding on 3.x is cheaper too ($14/1K
  // + 5K/mo free vs 2.x's $35/1K).
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const endpoint = geminiEndpoint(model);
  const body =
    params.tool === "search"
      ? {
          contents: [{ role: "user", parts: [{ text: params.prompt }] }],
          tools: [{ googleSearch: {} }]
        }
      : {
          contents: [{ role: "user", parts: [{ text: params.prompt }] }],
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: params.location.latitude ?? 37.3382,
                longitude: params.location.longitude ?? -121.8863
              }
            }
          }
        };

  // Retry transient 503 "high demand"/overload spikes with exponential backoff —
  // gemini-3.5-flash (newest model) gets capacity windows; this rides them out so a whole
  // batch doesn't fail at once. ~2s,4s,8s,16s,32s ≈ up to ~1 min of retries per call.
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: await geminiHeaders(apiKey),
      body: JSON.stringify(body)
    });
    const json = (await response.json()) as GeminiResponse & { error?: { message?: string } };
    if (response.ok) return json;
    const msg = json.error?.message ?? response.statusText;
    const transient = /demand|unavailable|overload|temporarily|try again|resource has been exhausted/i.test(msg);
    if (!transient || attempt >= 5) {
      throw new Error(`Gemini ${params.tool} request failed: ${msg}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

export async function extractMentions(params: {
  answer: string;
  citations: Citation[];
  targetCompanyName: string;
  knownCompetitors: string[];
}): Promise<CompanyMention[]> {
  if (!params.answer.trim()) return [];

  try {
    const apiKey = getApiKey();
    const model = process.env.GEMINI_EXTRACTION_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const endpoint = geminiEndpoint(model);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: await geminiHeaders(apiKey),
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Extract ranked local HVAC company mentions from this AI answer.

Return JSON only in this shape:
{"mentions":[{"companyName":"...","rank":1,"sentiment":"positive|neutral|negative","summary":"short reason","isTarget":false}]}

Target company: ${params.targetCompanyName}
Known competitors: ${params.knownCompetitors.join(", ") || "none"}
Answer:
${params.answer}`
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const json = (await response.json()) as GeminiResponse;
    const raw = extractAnswer(json);
    const parsed = JSON.parse(raw) as {
      mentions?: Array<{
        companyName?: string;
        rank?: number;
        sentiment?: "positive" | "neutral" | "negative";
        summary?: string;
        isTarget?: boolean;
      }>;
    };

    return (parsed.mentions ?? [])
      .filter((mention) => mention.companyName)
      .map((mention, index) => ({
        companyName: mention.companyName ?? "Unknown company",
        rank: Number.isFinite(mention.rank) ? Number(mention.rank) : index + 1,
        sentiment: mention.sentiment ?? "neutral",
        summary: mention.summary ?? "",
        isTarget: isLikelyTargetCompany(mention.companyName ?? "", params.targetCompanyName),
        citations: params.citations
      }));
  } catch {
    return fallbackMentions(params.answer, params.targetCompanyName, params.knownCompetitors, params.citations);
  }
}

function buildPrompt(params: { company: Company; location: Location; query: Query }) {
  return `You are helping a homeowner evaluate local HVAC providers.

Location: ${params.location.label}
Question: ${params.query.text}

Answer naturally. If you recommend companies, list specific company names in ranked order and briefly explain why. Use current grounded sources when available.`;
}

function extractAnswer(response: GeminiResponse) {
  return response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim() ?? "";
}

async function extractCitations(response: GeminiResponse): Promise<Citation[]> {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const citations = await Promise.all(
    chunks.map(async (chunk) => {
      const source = chunk.web ?? chunk.maps;
      const placeId = chunk.maps?.placeId;
      const rawUrl = source?.uri ?? (placeId ? `google-maps-place:${placeId}` : "");
      const url = await resolveCitationUrl(rawUrl, source?.title);

      return {
        title: source?.title ?? url,
        url,
        domain: domainFromUrl(url)
      };
    })
  );

  return citations.filter((citation) => citation.url);
}

async function resolveCitationUrl(url: string, title?: string) {
  if (!url || url.startsWith("google-maps-place:") || !isGoogleGroundingRedirectUrl(url)) {
    return url;
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(3500)
    });
    if (response.url && !isInfrastructureDomain(domainFromUrl(response.url))) {
      return response.url;
    }
  } catch {
    // Fall through to the title-domain fallback below.
  }

  const titleDomain = domainFromTitle(title ?? "");
  return titleDomain ? `https://${titleDomain}` : url;
}

function isGoogleGroundingRedirectUrl(url: string) {
  return domainFromUrl(url) === "vertexaisearch.cloud.google.com";
}

function domainFromTitle(title: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(normalized) && !isInfrastructureDomain(normalized)
    ? normalized
    : "";
}

function isInfrastructureDomain(domain: string) {
  return [
    "maps.google.com",
    "google.com",
    "vertexaisearch.cloud.google.com",
    "google-maps-place"
  ].includes(domain);
}

function fallbackMentions(answer: string, target: string, competitors: string[], citations: Citation[]): CompanyMention[] {
  const names = [target, ...competitors].filter((name) => answer.toLowerCase().includes(name.toLowerCase()));
  return names.map((name, index) => ({
    companyName: name,
    rank: index + 1,
    sentiment: "neutral",
    summary: "Mentioned in the grounded Gemini response.",
    isTarget: isLikelyTargetCompany(name, target),
    citations
  }));
}

function domainFromUrl(url: string) {
  if (url.startsWith("google-maps-place:")) return "google-maps-place";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isLikelyTargetCompany(candidate: string, target: string) {
  const candidateNormalized = normalize(candidate);
  const targetNormalized = normalize(target);

  if (!candidateNormalized || !targetNormalized) return false;
  if (candidateNormalized === targetNormalized) return true;

  const targetTokens = companyTokens(target);
  const candidateTokens = companyTokens(candidate);
  const sharedTokens = targetTokens.filter((token) => candidateTokens.includes(token));

  // Substring match only counts when they ALSO share a distinctive (brand) token — otherwise
  // a generic substring like "airplumb" wrongly matches "paschalairplumbingelectric".
  if ((candidateNormalized.includes(targetNormalized) || targetNormalized.includes(candidateNormalized)) && sharedTokens.length >= 1) return true;
  if (sharedTokens.length >= 2) return true;
  return sharedTokens.length === 1 && sharedTokens[0].length >= 5 && candidateTokens[0] === sharedTokens[0];
}

function companyTokens(value: string) {
  const stopwords = new Set([
    "air",
    "and",
    "the",
    "hvac",
    "heat",
    "heating",
    "cooling",
    "plumbing",
    "electric",
    "electrical",
    "services",
    "service",
    "company",
    "home",
    "homes",
    "inc",
    "llc",
    "all",
    "conditioning",
    "conditioner",
    "conditioners",
    "conditioned",
    "comfort",
    "co",
    "corp",
    // Non-HVAC vertical generics — without these, "pest"/"control"/"tree"/"landscape" count
    // as brand tokens and any "X Pest Control" wrongly matches "Moxie Pest Control", etc.
    "pest",
    "control",
    "exterminating",
    "exterminators",
    "exterminator",
    "termite",
    "termites",
    "tree",
    "trees",
    "arborist",
    "lawn",
    "landscape",
    "landscapes",
    "landscaping",
    "grounds",
    "garden",
    "gardens",
    "care",
    "expert",
    "experts",
    "pros",
    "group",
    // Home-services vertical generics (foundation / roofing / plumbing / windows) — June 2026.
    // Same class of fix as the pest/tree generics: without these, "X Foundation Solutions"
    // wrongly matches "Virginia Foundation Solutions", any "X Roofing" matches another, etc.
    "foundation", "foundations", "solutions", "solution", "structural", "waterproofing",
    "basement", "crawl", "crawlspace", "pier", "piering", "leveling", "inspection",
    "inspections", "repair", "repairs", "roof", "roofing", "roofer", "roofers",
    "restoration", "construction", "contractor", "contractors", "exterior", "exteriors",
    "siding", "gutter", "gutters", "plumber", "plumbers", "window", "windows",
    "installation", "replacement", "remodeling", "water", "florida", "treatment", "softener", "softeners", "softening", "filtration", "filter", "filters", "purification", "pure", "reverse", "osmosis", "h2o", "heater", "heaters", "tankless", "well"
  ]);

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3 && !stopwords.has(token));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  return apiKey;
}

function isDemoMode() {
  return process.env.DEMO_MODE !== "false" || !process.env.GEMINI_API_KEY;
}

function parseTargetedSentiment(text: string): { answer: string; sentiment: "positive" | "neutral" | "negative"; summary: string } {
  try {
    const parsed = JSON.parse(extractJson(text)) as { answer?: string; sentiment?: "positive" | "neutral" | "negative"; summary?: string };
    return {
      answer: parsed.answer?.trim() || text.trim(),
      sentiment: parsed.sentiment ?? sentimentFromText(parsed.answer || text),
      summary: parsed.summary?.trim() || "Targeted homeowner perception captured."
    };
  } catch {
    return {
      answer: text.trim(),
      sentiment: sentimentFromText(text),
      summary: "Targeted homeowner perception captured."
    };
  }
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function sentimentFromText(text: string): "positive" | "neutral" | "negative" {
  const value = text.toLowerCase();
  const negativeSignals = ["concern", "gap", "limited", "mixed", "complaint", "weak", "issue", "expensive"];
  const positiveSignals = ["strong", "credible", "reliable", "highly rated", "positive", "trusted", "recommend"];
  const negativeCount = negativeSignals.filter((signal) => value.includes(signal)).length;
  const positiveCount = positiveSignals.filter((signal) => value.includes(signal)).length;
  if (negativeCount > positiveCount + 1) return "negative";
  if (positiveCount > 0) return "positive";
  return "neutral";
}
