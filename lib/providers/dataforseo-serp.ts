// Traditional Google SERP for a prompt — used by MARKET reports to put an "SEO" rank next to
// the AI engines. One call per prompt (deterministic; no repeats). Reuses google-aio's
// DataForSEO auth + city/state location resolution (incl. the 40501 state-level fallback).
import { Location, QuerySerp, SerpListing } from "../types";
import { DFS_BASE, DFS_INVALID_LOCATION, dfsAuthHeader, dfsLocationName, dfsStateLocation } from "./google-aio";

const ORGANIC_PATH = "/v3/serp/google/organic/live/advanced";

// Aggregator/directory hosts — flagged so the featured "SEO" rank can be company-sites-only.
const DIRECTORY_HOSTS = [
  "yelp.", "angi.", "angieslist.", "thumbtack.", "homeadvisor.", "bbb.org", "facebook.",
  "instagram.", "nextdoor.", "yellowpages.", "yellowbook.", "superpages.", "mapquest.",
  "houzz.", "porch.com", "networx.", "expertise.com", "chamberofcommerce.", "manta.",
  "birdeye.", "trustpilot.", "reddit.", "google.", "bing.", "apple.com", "justdial.",
  "buildzoom.", "dexknows.", "citysearch.", "local.com", "top10.com", "consumeraffairs.",
];
function isDirectory(domain: string): boolean {
  const d = (domain || "").toLowerCase();
  return DIRECTORY_HOSTS.some((h) => d.includes(h));
}

function parseItems(items: Array<Record<string, unknown>>): { organic: SerpListing[]; localPack: SerpListing[] } {
  const organic: SerpListing[] = [];
  const localPack: SerpListing[] = [];
  let orgRank = 0;
  let lpRank = 0;
  for (const it of items || []) {
    const type = String(it.type || "");
    if (type === "organic") {
      orgRank++;
      const domain = String(it.domain || "").replace(/^www\./, "").toLowerCase();
      organic.push({
        rank: orgRank,
        title: String(it.title || ""),
        url: String(it.url || ""),
        domain,
        isDirectory: isDirectory(domain),
      });
    } else if (type === "local_pack") {
      lpRank++;
      const url = String(it.url || it.domain || "");
      let domain = String(it.domain || "").replace(/^www\./, "").toLowerCase();
      if (!domain && url) { try { domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { /* keep */ } }
      localPack.push({ rank: lpRank, title: String(it.title || ""), url, domain, isDirectory: false });
    }
  }
  return { organic, localPack };
}

// Fetch the organic + local-pack SERP for one prompt. Mirrors the AI Mode location handling:
// try the precise city, and on a 40501 invalid-location, retry at the state level.
export async function fetchQuerySerp(queryId: string, keyword: string, location: Location): Promise<QuerySerp | null> {
  const auth = dfsAuthHeader();
  if (!auth) return null;
  const call = async (location_name: string) => {
    const response = await fetch(DFS_BASE + ORGANIC_PATH, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword, location_name, language_code: "en", device: "desktop", depth: 20 }]),
    });
    return (await response.json())?.tasks?.[0];
  };
  try {
    let task = await call(dfsLocationName(location));
    if (task?.status_code === DFS_INVALID_LOCATION) {
      const state = dfsStateLocation(location);
      if (state) task = await call(state);
    }
    const items = (task?.result?.[0]?.items || []) as Array<Record<string, unknown>>;
    const { organic, localPack } = parseItems(items);
    return { queryId, organic, localPack, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}
