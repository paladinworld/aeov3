import { NextResponse } from "next/server";
import { runSurface } from "@/lib/runner";
import { diagnoseGeminiMissingRecommendation } from "@/lib/providers/gemini";
import { diagnoseChatGptMissingRecommendation } from "@/lib/providers/openai";
import { runCitations } from "@/lib/citations";
import { citationDomain, classifyDomains } from "@/lib/domain-classifier";
import { readDb, writeDb } from "@/lib/store";
import { Location, Query, SurfaceRun } from "@/lib/types";

// One-off maintenance endpoint for the Maps-removal migration:
//  (1) NEAR-ME FIX: the 3 "near me" prompts had no city, so Search grounding
//      (which has no location param) couldn't localize them. Re-localize the text
//      ("... in {City, ST}") and re-run them on the scored surfaces.
//  (2) INSIGHT REGEN: the "why weren't you recommended" insight used to be computed
//      on the Maps answer; now we ask the SAME follow-up on the Search answer for the
//      eligible prompts where the company is missing — so the Google panel matches ChatGPT.
// Idempotent-ish: it skips prompts that already carry a fresh near-me suffix / a
// gemini_search insight, so re-running won't duplicate work.

const CONCURRENCY = Math.max(1, Number(process.env.AUDIT_CONCURRENCY) || 6);
const isErr = (a: unknown) => String(a).startsWith("Provider error:");
const INSIGHT_CATEGORIES = ["Core General", "Repair & Maintenance", "Reviews & Price"];
const NEARME_OLD = new Set(["HVAC company near me", "24 hour HVAC repair near me", "AC tune up near me"]);
const SCORED_SURFACES = ["gemini_search", "chatgpt_search"] as const;

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index]);
      }
    })
  );
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 2500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await readDb();
  const report = db.reports.find((item) => item.id === id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const company = db.companies.find((item) => item.id === report.companyId);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  // The market this report was run against.
  const locId = report.runs[0]?.locationId;
  const location: Location = company.locations.find((l) => l.id === locId) ?? company.locations.find((l) => l.isPrimary) ?? company.locations[0];

  report.status = "running";
  await writeDb(db);

  // ── (1) NEAR-ME: re-localize + re-run ───────────────────────────────────
  const nearMeQueries = report.queries.filter((q) => NEARME_OLD.has(q.text));
  let nearMeReran = 0;
  for (const query of nearMeQueries) {
    const repeats = Math.max(1, report.runs.filter((r) => r.queryId === query.id && r.surface === "gemini_search").length || 5);
    query.text = `${query.text} in ${location.label}`; // localize so Search grounding can place it
    // Drop ALL old runs for this prompt (incl. stale Maps runs) and re-run scored surfaces.
    report.runs = report.runs.filter((r) => r.queryId !== query.id);
    const tasks = SCORED_SURFACES.flatMap((surface) =>
      Array.from({ length: repeats }, (_, i) => ({ surface, runNumber: i + 1 }))
    );
    await runPool(tasks, CONCURRENCY, async (t) => {
      try {
        const run = await withRetry(() => runSurface({ company, location, query, surface: t.surface, runNumber: t.runNumber }));
        run.queryText = query.text;
        report.runs.push(run);
      } catch (error) {
        report.runs.push({
          id: `${query.id}-${t.surface}-${t.runNumber}-err`,
          queryId: query.id,
          queryText: query.text,
          locationId: location.id,
          locationLabel: location.label,
          surface: t.surface,
          runNumber: t.runNumber,
          rawAnswer: `Provider error: ${error instanceof Error ? error.message : "Unknown error"}`,
          mentions: [],
          citations: [],
          createdAt: new Date().toISOString()
        });
      }
    });
    nearMeReran += 1;
  }
  await writeDb(db);

  // ── (2) INSIGHT REGEN: ask "why not recommended" on BOTH engines, for the primary
  //    prompts where the company is missing from that engine's CONSENSUS top 5 (so it
  //    matches exactly what the expanded panel shows as "not ranked"). ──
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const consensusMissing = (queryId: string, surface: string): boolean => {
    const live = report.runs.filter((r) => r.queryId === queryId && r.surface === surface && !isErr(r.rawAnswer));
    const groups = new Map<string, { isTarget: boolean; count: number; ranks: number[] }>();
    for (const run of live) {
      const seen = new Set<string>();
      for (const m of run.mentions || []) {
        const key = m.isTarget ? "__t" : norm(m.companyName);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const g = groups.get(key) ?? { isTarget: Boolean(m.isTarget), count: 0, ranks: [] };
        g.count += 1;
        g.ranks.push(m.rank);
        groups.set(key, g);
      }
    }
    const ranked = Array.from(groups.values())
      .map((g) => ({ isTarget: g.isTarget, count: g.count, avg: g.ranks.reduce((a, b) => a + b, 0) / g.ranks.length }))
      .sort((a, b) => b.count - a.count || a.avg - b.avg);
    const idx = ranked.findIndex((r) => r.isTarget);
    return !(idx >= 0 && idx < 5);
  };

  const ENGINES: Array<{ surface: "gemini_search" | "chatgpt_search"; diagnose: (originalAnswer: string, query: Query) => Promise<string> }> = [
    { surface: "gemini_search", diagnose: (originalAnswer, query) => diagnoseGeminiMissingRecommendation({ company, location, query, surface: "gemini_search", originalAnswer }) },
    { surface: "chatgpt_search", diagnose: (originalAnswer, query) => diagnoseChatGptMissingRecommendation({ company, location, query, originalAnswer }) }
  ];
  const jobs: Array<{ r1: SurfaceRun; query: Query; diagnose: (a: string, q: Query) => Promise<string> }> = [];
  for (const query of report.queries) {
    if (!INSIGHT_CATEGORIES.includes(query.category)) continue;
    for (const eng of ENGINES) {
      const r1 = report.runs.find((r) => r.queryId === query.id && r.surface === eng.surface && r.runNumber === 1);
      if (!r1 || isErr(r1.rawAnswer) || r1.missingInsight) continue;
      if (!consensusMissing(query.id, eng.surface)) continue; // present in top 5 → no "why" needed
      jobs.push({ r1, query, diagnose: eng.diagnose });
    }
  }
  let insightsAdded = 0;
  await runPool(jobs, CONCURRENCY, async (job) => {
    try {
      const answer = await withRetry(() => job.diagnose(job.r1.rawAnswer, job.query));
      job.r1.missingInsight = { question: `Why did you not recommend ${company.name}?`, answer, createdAt: new Date().toISOString() };
      insightsAdded += 1;
    } catch {
      /* leave without an insight rather than store an error string */
    }
  });

  // Re-classify cited domains across the (now-updated) run set.
  try {
    const domains = new Set<string>();
    for (const run of report.runs) for (const c of runCitations(run)) { const d = citationDomain(c); if (d) domains.add(d); }
    report.domainTypes = await classifyDomains([...domains]);
  } catch { /* non-fatal */ }

  report.status = "complete";
  report.completedAt = new Date().toISOString();
  await writeDb(db);

  return NextResponse.json({ id, nearMeReran, insightsAdded, runs: report.runs.length });
}
