import { appendFileSync } from "node:fs";
import { Company, CompanyMention, Citation, Location, Query, SurfaceRun, TargetedSentimentRun } from "../types";
import { id } from "../store";
import { mockSurfaceRun } from "./mock";

// Append per-call token usage so a run's exact OpenAI cost can be tallied. Opt-in via
// OPENAI_USAGE_LOG=<path>; no-op otherwise. Best-effort (never throws into a run).
function logUsage(model: string, usage: unknown) {
  const path = process.env.OPENAI_USAGE_LOG;
  if (!path || !usage) return;
  try { appendFileSync(path, JSON.stringify({ model, usage }) + "\n"); } catch { /* ignore */ }
}

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{
        type?: string;
        url?: string;
        title?: string;
      }>;
    }>;
    // web_search_call items carry the full list of pages the search opened — ChatGPT
    // shows these in its "Sources" panel. Requested via include: web_search_call.action.sources.
    action?: {
      sources?: Array<{
        url?: string;
        title?: string;
      }>;
    };
  }>;
};

export async function runChatGptSearch(params: {
  company: Company;
  location: Location;
  query: Query;
  runNumber: number;
  model?: string;
  searchContext?: "low" | "medium" | "high";
}): Promise<SurfaceRun> {
  if (process.env.DEMO_MODE !== "false" || !process.env.OPENAI_API_KEY) {
    return mockSurfaceRun({ ...params, surface: "chatgpt_search" });
  }

  const response = await createSearchResponse(params);
  const answer = extractText(response);
  const citations = extractCitations(response);
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
    surface: "chatgpt_search",
    runNumber: params.runNumber,
    rawAnswer: answer,
    // Store the source list once on the run; don't duplicate it on every mention.
    mentions: mentions.map((mention) => ({ ...mention, citations: [] })),
    citations,
    createdAt: new Date().toISOString()
  };
}

export async function runChatGptTargetedSentiment(params: {
  company: Company;
  location: Location;
  prompt: string;
}): Promise<TargetedSentimentRun> {
  if (process.env.DEMO_MODE !== "false" || !process.env.OPENAI_API_KEY) {
    return {
      id: id("targeted_sentiment"),
      surface: "chatgpt_search",
      prompt: params.prompt,
      rawAnswer: params.company.name + " appears to be a credible HVAC option in " + params.location.label + ", with strengths around local service coverage and customer trust. Main gaps to verify are pricing clarity, appointment availability, and whether third-party sources consistently validate the same claims.",
      sentiment: "positive",
      summary: "Positive but qualified homeowner-facing perception.",
      createdAt: new Date().toISOString()
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      tools: [
        {
          type: "web_search",
          user_location: {
            type: "approximate",
            country: "US",
            city: params.location.city,
            region: params.location.state
          }
        }
      ],
      tool_choice: "auto",
      input: [
        params.prompt,
        "",
        "Company website: " + params.company.website,
        "",
        "Return JSON only in this shape:",
        "{\"answer\":\"homeowner-facing paragraph with specifics\",\"sentiment\":\"positive|neutral|negative\",\"summary\":\"one sentence summary\"}",
        "Do not include markdown links or raw URLs in the answer."
      ].join("\n")
    })
  });

  const json = (await response.json()) as OpenAIResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(`OpenAI targeted sentiment failed: ${json.error?.message ?? response.statusText}`);
  }

  const parsed = parseTargetedSentiment(extractText(json));
  return {
    id: id("targeted_sentiment"),
    surface: "chatgpt_search",
    prompt: params.prompt,
    rawAnswer: parsed.answer,
    sentiment: parsed.sentiment,
    summary: parsed.summary,
    createdAt: new Date().toISOString()
  };
}

export async function diagnoseChatGptMissingRecommendation(params: {
  company: Company;
  location: Location;
  query: Query;
  originalAnswer: string;
  model?: string;
}): Promise<string> {
  if (process.env.DEMO_MODE !== "false" || !process.env.OPENAI_API_KEY) {
    return "The response did not recommend " + params.company.name + " because the visible evidence in this test answer favored other local providers. Strengthen location-specific service pages, review profiles, and third-party proof sources for this query.";
  }

  const model = params.model || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const body: Record<string, unknown> = {
      model,
      tools: [
        {
          type: "web_search",
          search_context_size: "medium",
          user_location: {
            type: "approximate",
            country: "US",
            city: params.location.city,
            region: params.location.state
          }
        }
      ],
      tool_choice: "auto",
      input: [
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
  };
  if (model.startsWith("gpt-5")) body.reasoning = { effort: "low" };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`
    },
    body: JSON.stringify(body)
  });

  const json = (await response.json()) as OpenAIResponse & { error?: { message?: string }; usage?: unknown };
  if (!response.ok) {
    throw new Error(`OpenAI missing diagnostic failed: ${json.error?.message ?? response.statusText}`);
  }
  logUsage(model, json.usage);

  return extractText(json);
}

async function createSearchResponse(params: {
  company: Company;
  location: Location;
  query: Query;
  model?: string;
  searchContext?: "low" | "medium" | "high";
}): Promise<OpenAIResponse> {
  const model = params.model || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  // Cost controls measured to cut ~65-70% per call with no loss of faithfulness
  // (still surfaces Reddit + names the target). The dominant cost was input tokens:
  // the default search_context_size loads 55-78k tokens of search-result text per call,
  // so we cap it (medium on high-intent primary prompts, low on secondary). reasoning:low
  // trims reasoning-token output on a listing task. We deliberately do NOT clamp output
  // length/verbosity — a fuller company list keeps coverage stable across repeats.
  const body: Record<string, unknown> = {
    model,
    tools: [
      {
        type: "web_search",
        search_context_size: params.searchContext || "medium",
        user_location: {
          type: "approximate",
          country: "US",
          city: params.location.city,
          region: params.location.state
        }
      }
    ],
    tool_choice: "auto",
    include: ["web_search_call.action.sources"],
    input: `You are helping a homeowner evaluate local HVAC providers.

Location: ${params.location.label}
Question: ${params.query.text}

Answer naturally. If you recommend companies, list specific company names in ranked order and briefly explain why. Use current web sources when available.`
  };
  // reasoning.effort is only valid on gpt-5* reasoning models; the cheap extraction/
  // fallback model (gpt-4.1-mini) would 400 on it.
  if (model.startsWith("gpt-5")) body.reasoning = { effort: "low" };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`
    },
    body: JSON.stringify(body)
  });

  const json = (await response.json()) as OpenAIResponse & { error?: { message?: string }; usage?: unknown };
  if (!response.ok) {
    throw new Error(`OpenAI web search failed: ${json.error?.message ?? response.statusText}`);
  }
  logUsage(model, json.usage);

  return json;
}

async function extractMentions(params: {
  answer: string;
  citations: Citation[];
  targetCompanyName: string;
  knownCompetitors: string[];
}): Promise<CompanyMention[]> {
  if (!params.answer.trim()) return [];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EXTRACTION_MODEL || "gpt-4.1-mini",
        input: `Extract ranked local HVAC company mentions from this AI answer.

Return JSON only in this shape:
{"mentions":[{"companyName":"...","rank":1,"sentiment":"positive|neutral|negative","summary":"short reason","isTarget":false}]}

Target company: ${params.targetCompanyName}
Known competitors: ${params.knownCompetitors.join(", ") || "none"}
Answer:
${params.answer}`
      })
    });

    const json = (await response.json()) as OpenAIResponse;
    const parsed = JSON.parse(extractJson(extractText(json))) as {
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

function extractText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

function extractCitations(response: OpenAIResponse): Citation[] {
  const items = response.output ?? [];
  // Inline footnotes the model tied to specific sentences...
  const fromAnnotations = items
    .flatMap((item) => item.content ?? [])
    .flatMap((content) => content.annotations ?? [])
    .map((annotation) => ({ url: annotation.url, title: annotation.title }));
  // ...plus every page the web_search actually opened (ChatGPT's "Sources" panel).
  // Capturing only annotations dropped ~⅔ of sources — notably directories/aggregators
  // (serviceagent, bestprosintown, expertise, etc.) the model consulted but didn't inline-cite.
  const fromSources = items.flatMap((item) => item.action?.sources ?? []).map((source) => ({ url: source.url, title: source.title }));

  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const ref of [...fromAnnotations, ...fromSources]) {
    if (!ref.url || seen.has(ref.url)) continue;
    seen.add(ref.url);
    citations.push({ title: ref.title ?? ref.url, url: ref.url, domain: domainFromUrl(ref.url) });
  }
  return citations;
}

function fallbackMentions(answer: string, target: string, competitors: string[], citations: Citation[]): CompanyMention[] {
  const names = [target, ...competitors].filter((name) => answer.toLowerCase().includes(name.toLowerCase()));
  return names.map((name, index) => ({
    companyName: name,
    rank: index + 1,
    sentiment: "neutral",
    summary: "Mentioned in the OpenAI web search response.",
    isTarget: isLikelyTargetCompany(name, target),
    citations
  }));
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function domainFromUrl(url: string) {
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
    "corp"
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return apiKey;
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
