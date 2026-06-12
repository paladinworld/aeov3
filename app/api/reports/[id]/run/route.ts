import { NextResponse } from "next/server";
import { runSurface } from "@/lib/runner";
import { runCitations } from "@/lib/citations";
import { citationDomain, classifyDomains } from "@/lib/domain-classifier";
import { id as createId, readDb, writeDb } from "@/lib/store";
import { Location, Query, Surface } from "@/lib/types";

// Tier 1 speedup: process the audit with bounded concurrency instead of one call
// at a time. Tune with AUDIT_CONCURRENCY. (Production-durable fan-out = Tier 2.)
const CONCURRENCY = Math.max(1, Number(process.env.AUDIT_CONCURRENCY) || 6);
const CHECKPOINT_EVERY = 20;

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length));
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

async function withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 2500): Promise<T> {
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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  // Optional body: { surfaces?: string[], repeats?: number } — surface-filtered re-run
  // (e.g. only chatgpt_search, keeping the existing Gemini data) and a repeat override.
  const body = (await request.json().catch(() => ({}))) as { surfaces?: string[]; repeats?: number };
  const onlySurfaces = Array.isArray(body.surfaces) && body.surfaces.length ? new Set(body.surfaces as Surface[]) : null;
  const repeatOverride = Number(body.repeats) > 0 ? Math.floor(Number(body.repeats)) : null;
  const db = await readDb();
  const report = db.reports.find((item) => item.id === id);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const company = db.companies.find((item) => item.id === report.companyId);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const locations = company.locations.filter((location) => report.locationIds.includes(location.id));
  report.status = "running";
  // Surface-filtered re-run wipes only the surfaces being redone (keeps e.g. Gemini); a full run wipes all.
  report.runs = onlySurfaces ? report.runs.filter((r) => !onlySurfaces.has(r.surface)) : [];
  if (!onlySurfaces) report.targetedSentiment = [];
  await writeDb(db);

  // Serialized incremental persistence: checkpoint progress without overlapping writes,
  // so a disconnect/restart mid-run never loses what's already completed.
  let writeChain: Promise<void> = Promise.resolve();
  const persist = () => {
    writeChain = writeChain.then(() => writeDb(db)).catch(() => {});
    return writeChain;
  };

  // Expand to the full task list, then run with bounded concurrency.
  type Task = { location: Location; query: Query; surface: Surface; runNumber: number; model?: string; searchContext?: "low" | "medium" | "high" };
  const tasks: Task[] = [];
  // gemini_maps (Google local pack) is excluded from the report (local SEO, not AI
  // visibility), so don't spend API calls / quota running it.
  const SKIP_SURFACES = new Set<Surface>(["gemini_maps"]);
  // ChatGPT cost/quality split by prompt importance. PRIMARY = the 3 high-intent
  // categories the Visibility Score is built on; SECONDARY = coverage-breadth prompts.
  //   model:   gpt-5.5 (most faithful) on primary, gpt-5 (cheaper) on secondary
  //   context: medium search budget on primary, low on secondary (the dominant cost lever)
  //   repeats: full repeats on primary to stabilize coverage; 1 on secondary
  // Per-call cost controls (reasoning:low, search_context_size) live in the provider.
  const PRIMARY = new Set(["Core General", "Repair & Maintenance", "Reviews & Price"]);
  const baseRepeats = repeatOverride ?? report.repeatRuns;
  for (const location of locations) {
    for (const query of report.queries) {
      for (const surface of query.surfaces) {
        if (SKIP_SURFACES.has(surface)) continue;
        if (onlySurfaces && !onlySurfaces.has(surface)) continue;
        const isChat = surface === "chatgpt_search";
        const isPrimary = PRIMARY.has(query.category);
        const model = isChat ? (isPrimary ? "gpt-5.5" : "gpt-5") : undefined;
        const searchContext: "medium" | "low" | undefined = isChat ? (isPrimary ? "medium" : "low") : undefined;
        const repeats = isChat && !isPrimary ? 1 : baseRepeats;
        for (let runNumber = 1; runNumber <= repeats; runNumber += 1) {
          tasks.push({ location, query, surface, runNumber, model, searchContext });
        }
      }
    }
  }

  let completed = 0;
  await runPool(tasks, CONCURRENCY, async (task) => {
    try {
      const run = await withRetry(() => runSurface({ company, ...task }));
      report.runs.push(run);
    } catch (error) {
      report.runs.push({
        id: createId("run"),
        queryId: task.query.id,
        queryText: task.query.text,
        locationId: task.location.id,
        locationLabel: task.location.label,
        surface: task.surface,
        runNumber: task.runNumber,
        rawAnswer: `Provider error: ${error instanceof Error ? error.message : "Unknown error"}`,
        mentions: [],
        createdAt: new Date().toISOString()
      });
    }
    completed += 1;
    if (completed % CHECKPOINT_EVERY === 0) persist();
  });
  await writeChain;

  // Classify the cited domains (platform/contractor/manufacturer/other) so the
  // dashboard can tag sources correctly. Learned mappings persist + reused across runs.
  try {
    const domains = new Set<string>();
    for (const run of report.runs) {
      for (const citation of runCitations(run)) {
        const domain = citationDomain(citation);
        if (domain) domains.add(domain);
      }
    }
    report.domainTypes = await classifyDomains([...domains]);
  } catch {
    // Non-fatal: the dashboard falls back to its built-in heuristic.
  }

  report.status = "complete";
  report.completedAt = new Date().toISOString();
  await writeDb(db);

  return NextResponse.json(report);
}
