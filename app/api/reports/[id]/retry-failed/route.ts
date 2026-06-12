import { NextResponse } from "next/server";
import { runSurface } from "@/lib/runner";
import { runCitations } from "@/lib/citations";
import { citationDomain, classifyDomains } from "@/lib/domain-classifier";
import { readDb, writeDb } from "@/lib/store";

// Operational endpoint: re-run ONLY the runs that failed with a "Provider error:"
// (e.g. provider quota ran out mid-audit), reusing the existing runs. Unlike
// /run it does not wipe the good runs — it replaces each failed run in place.
const CONCURRENCY = Math.max(1, Number(process.env.AUDIT_CONCURRENCY) || 6);
const isProviderError = (answer: unknown) => String(answer).startsWith("Provider error:");

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
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const company = db.companies.find((item) => item.id === report.companyId);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  // The failed runs to redo; keep the good ones untouched. Skip gemini_maps errors —
  // Maps is excluded from the report, so retrying those calls just wastes quota.
  const failed = report.runs.filter((run) => isProviderError(run.rawAnswer) && run.surface !== "gemini_maps");
  const totalBefore = report.runs.length;
  if (!failed.length) {
    return NextResponse.json({ id, message: "No failed runs to retry", runs: totalBefore, retried: 0, stillFailing: 0 });
  }

  report.status = "running";
  report.runs = report.runs.filter((run) => !isProviderError(run.rawAnswer));
  await writeDb(db);

  let writeChain: Promise<void> = Promise.resolve();
  const persist = () => {
    writeChain = writeChain.then(() => writeDb(db)).catch(() => {});
    return writeChain;
  };

  let done = 0;
  let stillFailing = 0;
  await runPool(failed, CONCURRENCY, async (oldRun) => {
    const query = report.queries.find((q) => q.id === oldRun.queryId);
    const location = company.locations.find((l) => l.id === oldRun.locationId);
    if (!query || !location) {
      // Can't reconstruct the task — keep the original error run as-is.
      report.runs.push(oldRun);
      stillFailing += 1;
      return;
    }
    try {
      const run = await withRetry(() => runSurface({ company, location, query, surface: oldRun.surface, runNumber: oldRun.runNumber }));
      report.runs.push(run);
      if (isProviderError(run.rawAnswer)) stillFailing += 1;
    } catch (error) {
      report.runs.push({
        ...oldRun,
        rawAnswer: `Provider error: ${error instanceof Error ? error.message : "Unknown error"}`,
        mentions: [],
        createdAt: new Date().toISOString()
      });
      stillFailing += 1;
    }
    done += 1;
    if (done % 20 === 0) persist();
  });
  await writeChain;

  // Re-classify cited domains across the full (now-repaired) run set.
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
    // Non-fatal.
  }

  report.status = "complete";
  report.completedAt = new Date().toISOString();
  await writeDb(db);

  return NextResponse.json({ id, runs: report.runs.length, retried: failed.length, stillFailing });
}
