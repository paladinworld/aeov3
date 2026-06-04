import { Citation, SurfaceRun } from "./types";

// A run's distinct cited sources.
//
// New runs store citations once at the run level (run.citations). Older runs stored
// the SAME citation list duplicated on every mention (≈10× bloat). This reads either
// shape: prefer run.citations, otherwise flatten + de-dupe the per-mention copies.
// Backward-compatible, so existing reports keep working without a backfill.
export function runCitations(run: SurfaceRun): Citation[] {
  if (run.citations) return run.citations;
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const mention of run.mentions) {
    for (const citation of mention.citations) {
      const key = citation.url || citation.domain || citation.title;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(citation);
    }
  }
  return out;
}
