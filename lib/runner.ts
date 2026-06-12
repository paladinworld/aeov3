import { Company, Location, Query, Surface, SurfaceRun, TargetedSentimentRun } from "./types";
import { diagnoseGeminiMissingRecommendation, runGeminiMaps, runGeminiSearch, runGeminiTargetedSentiment } from "./providers/gemini";
import { diagnoseChatGptMissingRecommendation, runChatGptSearch, runChatGptTargetedSentiment } from "./providers/openai";
import { runGoogleAiOverview } from "./providers/google-aio";

export const TARGETED_SENTIMENT_PROMPT_TEMPLATE = "You are helping a homeowner choose an HVAC company in {location}. Based on publicly available information, what are the strongest reasons to consider {company}, and what concerns or gaps should a homeowner know before choosing them?";

export function targetedSentimentPrompt(company: Company, location: Location) {
  return TARGETED_SENTIMENT_PROMPT_TEMPLATE
    .replace("{location}", location.label)
    .replace("{company}", company.name);
}

export async function runTargetedSentimentTask(params: {
  company: Company;
  location: Location;
  surface: "gemini_maps" | "chatgpt_search";
}): Promise<TargetedSentimentRun> {
  const prompt = targetedSentimentPrompt(params.company, params.location);

  return params.surface === "chatgpt_search"
    ? runChatGptTargetedSentiment({ ...params, prompt })
    : runGeminiTargetedSentiment({ ...params, prompt });
}

export async function runSurface(params: {
  company: Company;
  location: Location;
  query: Query;
  surface: Surface;
  runNumber: number;
  model?: string; // ChatGPT-answer model override (per-prompt, e.g. gpt-5.5 primary / gpt-5 secondary)
  searchContext?: "low" | "medium" | "high"; // web_search context budget (medium primary / low secondary)
}): Promise<SurfaceRun> {
  let run: SurfaceRun;

  switch (params.surface) {
    case "gemini_maps":
      run = await runGeminiMaps(params);
      break;
    case "gemini_search":
      run = await runGeminiSearch(params);
      break;
    case "chatgpt_search":
      run = await runChatGptSearch(params);
      break;
    case "google_ai_overview":
      run = await runGoogleAiOverview(params);
      break;
  }

  return maybeAttachMissingInsight(params, run);
}

async function maybeAttachMissingInsight(params: {
  company: Company;
  location: Location;
  query: Query;
  surface: Surface;
  runNumber: number;
}, run: SurfaceRun): Promise<SurfaceRun> {
  if (params.runNumber !== 1) return run;
  // Buckets that trigger the "why didn't AI recommend you?" follow-up: the PRIMARY
  // high-intent categories the Visibility Score is built on, where the "why" is most
  // actionable (e.g. pricing/financing, reviews, repair).
  if (!["Core General", "Repair & Maintenance", "Reviews & Price"].includes(params.query.category)) return run;
  if (!["gemini_search", "chatgpt_search"].includes(params.surface)) return run;
  if (run.rawAnswer.startsWith("Provider error:")) return run;

  const targetRank = run.mentions.find((mention) => mention.isTarget)?.rank ?? null;
  if (targetRank && targetRank <= 5) return run;

  try {
    const question = `Why did you not recommend ${params.company.name}?`;
    const answer = params.surface === "chatgpt_search"
      ? await diagnoseChatGptMissingRecommendation({ ...params, originalAnswer: run.rawAnswer })
      : await diagnoseGeminiMissingRecommendation({ ...params, surface: "gemini_search", originalAnswer: run.rawAnswer });

    return {
      ...run,
      missingInsight: {
        question,
        answer,
        createdAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      ...run,
      missingInsight: {
        question: `Why did you not recommend ${params.company.name}?`,
        answer: `Diagnostic unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
        createdAt: new Date().toISOString()
      }
    };
  }
}
