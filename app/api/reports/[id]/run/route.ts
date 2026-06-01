import { NextResponse } from "next/server";
import { runSurface, runTargetedSentimentTask } from "@/lib/runner";
import { id as createId, readDb, writeDb } from "@/lib/store";

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

  let completedRuns = 0;

  for (const location of locations) {
    for (const query of report.queries) {
      for (const surface of query.surfaces) {
        for (let runNumber = 1; runNumber <= report.repeatRuns; runNumber += 1) {
          try {
            const run = await runSurface({
              company,
              location,
              query,
              surface,
              runNumber
            });
            report.runs.push(run);
          } catch (error) {
            report.runs.push({
              id: createId("run"),
              queryId: query.id,
              queryText: query.text,
              locationId: location.id,
              locationLabel: location.label,
              surface,
              runNumber,
              rawAnswer: `Provider error: ${error instanceof Error ? error.message : "Unknown error"}`,
              mentions: [],
              createdAt: new Date().toISOString()
            });
          }

          completedRuns += 1;
          if (completedRuns % 5 === 0) {
            await writeDb(db);
          }
        }
      }
    }
  }

  for (const location of locations) {
    for (const surface of ["gemini_maps", "chatgpt_search"] as const) {
      try {
        const sentimentRun = await runTargetedSentimentTask({
          company,
          location,
          surface
        });
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
    }
  }

  report.status = "complete";
  report.completedAt = new Date().toISOString();
  await writeDb(db);

  return NextResponse.json(report);
}
