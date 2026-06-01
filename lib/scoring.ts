import { Citation, CompanyMention, Report, VisibilitySummary } from "./types";

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
    const runCitationDomains = new Set<string>();

    for (const mention of run.mentions) {
      if (!mention.isTarget) {
        addCompetitorMention(competitorGroups, mention);
      }

      for (const citation of mention.citations) {
        const domain = displayCitationDomain(citation);
        if (domain) {
          runCitationDomains.add(domain);
        }
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

function canonicalCompanyName(name: string) {
  const tokens = companyTokens(name);
  return tokens.join("") || name.toLowerCase().replace(/[^a-z0-9]/g, "");
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
    "llc"
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
