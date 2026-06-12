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

  // The "why didn't AI recommend you?" follow-up is NOT attached here per-run — a single
  // round is a noisy signal. It runs once per prompt AFTER all repeats finish, off the
  // consensus across the 5 rounds (see attachMissingInsights).
  return run;
}

const INSIGHT_CATEGORIES = ["Core General", "Repair & Maintenance", "Reviews & Price"];

// Consensus target rank across an engine's repeat runs for ONE prompt — mirrors the
// dashboard's buildConsensus: companies ranked by how OFTEN they appear, then avg position.
function consensusTargetRank(runs: SurfaceRun[]): number | null {
  const live = runs.filter((run) => !run.rawAnswer.startsWith("Provider error:"));
  const groups = new Map<string, { isTarget: boolean; count: number; ranks: number[] }>();
  for (const run of live) {
    const seen = new Set<string>();
    for (const mention of run.mentions) {
      const key = mention.isTarget ? "__target" : (mention.companyName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const g = groups.get(key) ?? { isTarget: Boolean(mention.isTarget), count: 0, ranks: [] };
      g.count += 1;
      g.ranks.push(mention.rank);
      groups.set(key, g);
    }
  }
  const ranked = Array.from(groups.values())
    .map((g) => ({ isTarget: g.isTarget, count: g.count, avg: g.ranks.reduce((a, b) => a + b, 0) / g.ranks.length }))
    .sort((a, b) => b.count - a.count || a.avg - b.avg);
  const i = ranked.findIndex((r) => r.isTarget);
  return i >= 0 ? i + 1 : null;
}

// After all runs complete: for each PRIMARY prompt × engine actually run, ask the
// "why didn't AI recommend you?" follow-up ONCE — and only if the target is consensus-
// missing (not in the top 5 across the 5 rounds). Attaches the answer to that prompt's
// run #1 so it's stored once. ChatGPT uses gpt-5.5; the Google engine uses Gemini.
export async function attachMissingInsights(
  company: Company,
  queries: Query[],
  runs: SurfaceRun[],
  surfaces: Surface[],
  locations: Location[],
  chatModel = "gpt-5.5"
): Promise<void> {
  const engines = surfaces.filter((s) => s === "gemini_search" || s === "chatgpt_search");
  // 1. Find every (prompt, engine) that needs a follow-up (target consensus-missing).
  const targets: Array<{ query: Query; surface: Surface; host: SurfaceRun; location: Location }> = [];
  for (const query of queries) {
    if (!INSIGHT_CATEGORIES.includes(query.category)) continue;
    for (const surface of engines) {
      const group = runs.filter((r) => r.queryId === query.id && r.surface === surface);
      if (!group.some((r) => !r.rawAnswer.startsWith("Provider error:"))) continue;
      const host = group.find((r) => r.runNumber === 1) ?? group[0];
      if (!host || host.missingInsight) continue; // once per prompt; idempotent
      const rank = consensusTargetRank(group);
      if (rank && rank <= 5) continue; // shows up across the 5 rounds → no follow-up needed
      const location = locations.find((l) => l.id === host.locationId) ?? ({ id: host.locationId, label: host.locationLabel } as Location);
      targets.push({ query, surface, host, location });
    }
  }
  // 2. Fire the diagnostics with bounded concurrency. Each writes a DISTINCT host run's
  // missingInsight (no shared state), so parallelizing is safe and ~5x faster.
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, targets.length) }, async () => {
      while (cursor < targets.length) {
        const { query, surface, host, location } = targets[cursor++];
        try {
          const answer = surface === "chatgpt_search"
            ? await diagnoseChatGptMissingRecommendation({ company, location, query, originalAnswer: host.rawAnswer, model: chatModel })
            : await diagnoseGeminiMissingRecommendation({ company, location, query, surface: "gemini_search", originalAnswer: host.rawAnswer });
          host.missingInsight = { question: `Why did you not recommend ${company.name}?`, answer, createdAt: new Date().toISOString() };
        } catch (error) {
          host.missingInsight = { question: `Why did you not recommend ${company.name}?`, answer: `Diagnostic unavailable: ${error instanceof Error ? error.message : "Unknown error"}`, createdAt: new Date().toISOString() };
        }
      }
    })
  );
}
