import { Company, Location, Surface, SurfaceRun, Query } from "../types";
import { id } from "../store";

const domains = ["google.com", "yelp.com", "angi.com", "bbb.org", "nextdoor.com", "company-site.com"];

export function mockSurfaceRun(params: {
  company: Company;
  location: Location;
  query: Query;
  surface: Surface;
  runNumber: number;
}): SurfaceRun {
  const { company, location, query, surface, runNumber } = params;
  const competitors = company.competitors.length
    ? company.competitors
    : ["Service Champions", "Fuse HVAC", "Aquinas HVAC", "IRBIS HVAC"];
  const seed = stableNumber(`${query.text}:${surface}:${runNumber}:${location.city}`);
  const includeTarget = seed % 100 < targetProbability(surface);
  const names = includeTarget ? [company.name, ...competitors] : competitors;
  const ordered = names
    .map((name, index) => ({ name, score: stableNumber(`${name}:${seed}`) + index }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return {
    id: id("run"),
    queryId: query.id,
    queryText: query.text,
    locationId: location.id,
    locationLabel: location.label,
    surface,
    runNumber,
    rawAnswer: `${surface} demo answer for "${query.text}" in ${location.label}.`,
    mentions: ordered.map((item, index) => ({
      companyName: item.name,
      rank: index + 1,
      sentiment: "positive",
      summary:
        item.name === company.name
          ? "Mentioned as a relevant local HVAC provider, usually because of service coverage and reputation signals."
          : "Mentioned for local relevance, review volume, or directory presence.",
      isTarget: item.name === company.name,
      citations: makeCitations(item.name, seed + index)
    })),
    createdAt: new Date().toISOString()
  };
}

function targetProbability(surface: Surface) {
  switch (surface) {
    case "gemini_maps":
      return 45;
    case "gemini_search":
      return 35;
    case "chatgpt_search":
      return 40;
    case "google_ai_overview":
      return 28;
  }
}

function makeCitations(companyName: string, seed: number) {
  return [0, 1].map((offset) => {
    const domain = domains[(seed + offset) % domains.length];
    return {
      title: `${companyName} reference on ${domain}`,
      url: `https://${domain}/search?q=${encodeURIComponent(companyName)}`,
      domain
    };
  });
}

function stableNumber(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
