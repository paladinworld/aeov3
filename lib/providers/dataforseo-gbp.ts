// Google Business Profile rating + review count for a company, via DataForSEO Google Maps.
// Used by MARKET reports to sit "reviews & rating" next to AI visibility — showing that
// review dominance ≠ AI recommendations. One call per company. Reuses google-aio's auth +
// location resolution (city, with the 40501 state-level fallback).
import { Location } from "../types";
import { DFS_BASE, DFS_INVALID_LOCATION, dfsAuthHeader, dfsLocationName, dfsStateLocation } from "./google-aio";

const MAPS_PATH = "/v3/serp/google/maps/live/advanced";

export async function fetchGbp(name: string, location: Location): Promise<{ rating: number | null; reviews: number | null }> {
  const auth = dfsAuthHeader();
  if (!auth) return { rating: null, reviews: null };
  const call = async (location_name: string) => {
    const res = await fetch(DFS_BASE + MAPS_PATH, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword: name, location_name, language_code: "en" }]),
    });
    return (await res.json())?.tasks?.[0];
  };
  try {
    let task = await call(dfsLocationName(location));
    if (task?.status_code === DFS_INVALID_LOCATION) {
      const state = dfsStateLocation(location);
      if (state) task = await call(state);
    }
    const items = (task?.result?.[0]?.items || []) as Array<Record<string, unknown>>;
    // First maps result carrying a rating — that's the business's GBP.
    const hit = items.find((x) => x && (x as { rating?: unknown }).rating) as { rating?: { value?: number; votes_count?: number } } | undefined;
    const rating = typeof hit?.rating?.value === "number" ? hit.rating.value : null;
    const reviews = typeof hit?.rating?.votes_count === "number" ? hit.rating.votes_count : null;
    return { rating, reviews };
  } catch {
    return { rating: null, reviews: null };
  }
}
