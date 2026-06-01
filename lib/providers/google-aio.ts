import { Company, Location, Query, SurfaceRun } from "../types";
import { mockSurfaceRun } from "./mock";

export async function runGoogleAiOverview(params: {
  company: Company;
  location: Location;
  query: Query;
  runNumber: number;
}): Promise<SurfaceRun> {
  if (process.env.DEMO_MODE !== "false" || !process.env.GOOGLE_AIO_PROVIDER_API_KEY) {
    return mockSurfaceRun({ ...params, surface: "google_ai_overview" });
  }

  // TODO: Plug in selected SERP provider that exposes AI Overview text and citations.
  return mockSurfaceRun({ ...params, surface: "google_ai_overview" });
}
