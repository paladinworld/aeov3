import { Company, CompanyMention, Citation, Location, Query, SurfaceRun, TargetedSentimentRun } from "../types";
import { id } from "../store";
import { mockSurfaceRun } from "./mock";

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
  }>;
};

export async function runChatGptSearch(params: {
  company: Company;
  location: Location;
  query: Query;
  runNumber: number;
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
    mentions,
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
}): Promise<string> {
  if (process.env.DEMO_MODE !== "false" || !process.env.OPENAI_API_KEY) {
    return "The response did not recommend " + params.company.name + " because the visible evidence in this test answer favored other local providers. Strengthen location-specific service pages, review profiles, and third-party proof sources for this query.";
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
    })
  });

  const json = (await response.json()) as OpenAIResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(`OpenAI missing diagnostic failed: ${json.error?.message ?? response.statusText}`);
  }

  return extractText(json);
}

async function createSearchResponse(params: {
  company: Company;
  location: Location;
  query: Query;
}): Promise<OpenAIResponse> {
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
      include: ["web_search_call.action.sources"],
      input: `You are helping a homeowner evaluate local HVAC providers.

Location: ${params.location.label}
Question: ${params.query.text}

Answer naturally. If you recommend companies, list specific company names in ranked order and briefly explain why. Use current web sources when available.`
    })
  });

  const json = (await response.json()) as OpenAIResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(`OpenAI web search failed: ${json.error?.message ?? response.statusText}`);
  }

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
  const annotations =
    response.output
      ?.flatMap((item) => item.content ?? [])
      .flatMap((content) => content.annotations ?? []) ?? [];

  return annotations
    .filter((annotation) => annotation.url)
    .map((annotation) => ({
      title: annotation.title ?? annotation.url ?? "",
      url: annotation.url ?? "",
      domain: domainFromUrl(annotation.url ?? "")
    }));
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
  if (candidateNormalized.includes(targetNormalized) || targetNormalized.includes(candidateNormalized)) return true;

  const targetTokens = companyTokens(target);
  const candidateTokens = companyTokens(candidate);
  const sharedTokens = targetTokens.filter((token) => candidateTokens.includes(token));

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
    "llc"
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
