import { Citation, CompanyMention, Report, VisibilitySummary } from "./types";
import { runCitations } from "./citations";

type CompetitorGroup = {
  displayName: string;
  count: number;
};

export function summarizeReport(report: Report): VisibilitySummary {
  const targetMentions = report.runs.flatMap((run) =>
    run.mentions.filter((mention) => mention.isTarget)
  );
  const topThreeMentions = targetMentions.filter((mention) => mention.rank <= 3);
  const competitorGroups = new Map<string, CompetitorGroup>();
  const citationCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  for (const query of report.queries) {
    const category = normalizeCategory(query.category);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  for (const run of report.runs) {
    for (const mention of run.mentions) {
      if (!mention.isTarget) {
        addCompetitorMention(competitorGroups, mention);
      }
    }

    const runCitationDomains = new Set<string>();
    for (const citation of runCitations(run)) {
      const domain = displayCitationDomain(citation);
      if (domain) {
        runCitationDomains.add(domain);
      }
    }

    for (const domain of runCitationDomains) {
      citationCounts.set(domain, (citationCounts.get(domain) ?? 0) + 1);
    }
  }

  const surfaceScores = Array.from(new Set(report.runs.map((run) => run.surface))).map((surface) => {
    const runs = report.runs.filter((run) => run.surface === surface);
    const mentions = runs.flatMap((run) => run.mentions.filter((mention) => mention.isTarget));
    return {
      surface,
      runs: runs.length,
      mentionRate: runs.length ? mentions.length / runs.length : 0,
      averageRank: average(mentions.map((mention) => mention.rank))
    };
  });

  return {
    totalRuns: report.runs.length,
    targetMentions: targetMentions.length,
    mentionRate: report.runs.length ? targetMentions.length / report.runs.length : 0,
    topThreeRate: report.runs.length ? topThreeMentions.length / report.runs.length : 0,
    averageRank: average(targetMentions.map((mention) => mention.rank)),
    competitorCounts: topCompetitorCounts(competitorGroups),
    citationCounts: topCounts(citationCounts),
    categoryCounts: topCounts(categoryCounts),
    longTailCount: report.queries.filter((query) => query.longTail).length,
    surfaceScores
  };
}

function addCompetitorMention(groups: Map<string, CompetitorGroup>, mention: CompanyMention) {
  const key = canonicalCompanyName(mention.companyName);
  const existing = groups.get(key);

  if (existing) {
    existing.count += 1;
    if (mention.companyName.length > existing.displayName.length) {
      existing.displayName = mention.companyName;
    }
    return;
  }

  groups.set(key, {
    displayName: mention.companyName,
    count: 1
  });
}

// Generic marketing words that are NOT brand-distinctive even alone — never key a company
// on one of these (would over-merge "Best Air" + "Best Plumbing", etc.).
const GENERIC_SOLO = new Set(["quality", "premier", "elite", "choice", "value", "budget", "national", "first", "best", "plus", "select", "prime", "local", "family", "comfort", "master", "masters"]);
function canonicalCompanyName(name: string) {
  const tokens = companyTokens(name);
  // >=2 tokens: join them. A single DISTINCTIVE token (>=4 chars, not generic) keys on that
  // token so "Esser Air Conditioning and Heating" and "Esser Air" merge into one row. A lone
  // generic/short token (e.g. "one") falls back to the full name so distinct companies that
  // merely share it (Pure One Water vs Service One) stay separate.
  if (tokens.length >= 2) return tokens.join("");
  if (tokens.length === 1 && tokens[0].length >= 4 && !GENERIC_SOLO.has(tokens[0])) return tokens[0];
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function companyTokens(value: string) {
  const stopwords = new Set([
    "a",
    "ac",
    "air",
    "and",
    "conditioning",
    "the",
    "hvac",
    "heat",
    "heating",
    "cooling",
    "plumbing",
    "electric",
    "electrical",
    "services",
    "service",
    "company",
    "home",
    "homes",
    "inc",
    "llc",
    // Non-HVAC vertical generics (keep in sync with gemini.ts + DashboardClient).
    "pest", "control", "exterminating", "exterminators", "exterminator", "termite", "termites",
    "tree", "trees", "arborist", "lawn", "landscape", "landscapes", "landscaping", "grounds",
    "garden", "gardens", "care", "expert", "experts", "pros", "group",
    // Home-services vertical generics (foundation / roofing / plumbing / windows) — keep in sync with gemini.ts.
    "foundation", "foundations", "solutions", "solution", "structural", "waterproofing",
    "basement", "crawl", "crawlspace", "pier", "piering", "leveling", "inspection",
    "inspections", "repair", "repairs", "roof", "roofing", "roofer", "roofers",
    "restoration", "construction", "contractor", "contractors", "exterior", "exteriors",
    "siding", "gutter", "gutters", "plumber", "plumbers", "window", "windows",
    "installation", "replacement", "remodeling", "water", "florida", "treatment", "softener", "softeners", "softening", "filtration", "filter", "filters", "purification", "pure", "reverse", "osmosis", "h2o", "heater", "heaters", "tankless", "well"
  ]);

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3 && !stopwords.has(token));
}

function displayCitationDomain(citation: Citation) {
  const domain = canonicalDomain(citation.domain || citation.url);
  if (domain && !isInfrastructureDomain(domain)) return domain;

  const titleDomain = canonicalDomain(citation.title);
  if (titleDomain && looksLikeDomain(titleDomain) && !isInfrastructureDomain(titleDomain)) {
    return titleDomain;
  }

  return "";
}

function canonicalDomain(value: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
  }
}

function looksLikeDomain(value: string) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value);
}

function isInfrastructureDomain(domain: string) {
  return [
    "maps.google.com",
    "google.com",
    "vertexaisearch.cloud.google.com",
    "google-maps-place"
  ].includes(domain);
}

function topCompetitorCounts(groups: Map<string, CompetitorGroup>) {
  return Array.from(groups.values())
    .map((group) => ({ name: group.displayName, count: group.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function topCounts(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function normalizeCategory(category: string) {
  if (category === "Core Local" || category === "Symptom Diagnosis" || category === "Property-Specific Needs") return "Core Local Service";
  if (category === "Replacement & Installation" || category === "Maintenance & Prevention") return "Replacement & Tune-Up";
  return category;
}
