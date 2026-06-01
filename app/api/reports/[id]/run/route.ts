import { NextResponse } from "next/server";
import { runSurface, runTargetedSentimentTask } from "@/lib/runner";
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

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
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
  report.runs = [];
  report.targetedSentiment = [];
  await writeDb(db);

  // Serialized incremental persistence: checkpoint progress without overlapping writes,
  // so a disconnect/restart mid-run never loses what's already completed.
  let writeChain: Promise<void> = Promise.resolve();
  const persist = () => {
    writeChain = writeChain.then(() => writeDb(db)).catch(() => {});
    return writeChain;
  };

  // Expand to the full task list, then run with bounded concurrency.
  type Task = { location: Location; query: Query; surface: Surface; runNumber: number };
  const tasks: Task[] = [];
  for (const location of locations) {
    for (const query of report.queries) {
      for (const surface of query.surfaces) {
        for (let runNumber = 1; runNumber <= report.repeatRuns; runNumber += 1) {
          tasks.push({ location, query, surface, runNumber });
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

  // Targeted sentiment (once per location/surface) — also concurrent.
  const sentimentTasks = locations.flatMap((location) =>
    (["gemini_maps", "chatgpt_search"] as const).map((surface) => ({ location, surface }))
  );
  await runPool(sentimentTasks, CONCURRENCY, async ({ location, surface }) => {
    try {
      const sentimentRun = await withRetry(() => runTargetedSentimentTask({ company, location, surface }));
      report.targetedSentiment?.push(sentimentRun);
    } catch (error) {
      report.targetedSentiment?.push({
        id: createId("targeted_sentiment"),
        surface,
        prompt: "Targeted sentiment unavailable",
        rawAnswer: `Provider error: ${error instanceof Error ? error.message : "Unknown error"}`,
        sentiment: "neutral",
        summary: "Targeted sentiment task failed.",
        createdAt: new Date().toISOString()
      });
    }
  });

  report.status = "complete";
  report.completedAt = new Date().toISOString();
  await writeDb(db);

  return NextResponse.json(report);
}
