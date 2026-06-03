import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Citation } from "./types";

// Company-agnostic citation domain category. The app maps `contractor` to
// Competitor (or Owned for the audited company); manufacturer/other -> Others.
export type DomainKind = "platform" | "contractor" | "manufacturer" | "other";

const dataDir = path.join(process.cwd(), "data");
const mapPath = path.join(dataDir, "domain-types.json");

// Drop subdomains so reviews.birdeye.com matches birdeye.com (naive last-two-labels; US-centric data).
function baseDomain(domain: string): string {
  const parts = domain.split(".");
  return parts.length <= 2 ? domain : parts.slice(-2).join(".");
}

function normalize(domain: string): string {
  return (domain || "").trim().toLowerCase().replace(/^www\./, "");
}

export function citationDomain(citation: Citation): string {
  const raw = citation.domain || citation.url || "";
  try {
    return normalize(new URL(raw).hostname);
  } catch {
    const m = raw.match(/[a-z0-9.-]+\.[a-z]{2,}/i);
    return m ? normalize(m[0]) : "";
  }
}

const PLATFORM = new Set([
  "angi.com", "bbb.org", "bestpickreports.com", "consumeraffairs.com", "diamondcertified.org", "bobvila.com",
  "consumerreports.org", "expertise.com", "facebook.com", "instagram.com", "forbes.com", "google.com",
  "homeadvisor.com", "houzz.com", "mapquest.com", "nextdoor.com", "quora.com", "reddit.com", "thisoldhouse.com",
  "thumbtack.com", "todayshomeowner.com", "tomsguide.com", "yelp.com", "youtube.com", "birdeye.com",
  "trustpilot.com", "yellowpages.com", "porch.com", "buildzoom.com", "manta.com", "chamberofcommerce.com",
  "apple.com", "bing.com", "linkedin.com", "glassdoor.com", "indeed.com", "tripadvisor.com", "superpages.com",
  "local.com", "citysearch.com", "homestars.com", "networx.com", "fixr.com", "dexknows.com", "ezlocal.com"
]);

const MANUFACTURER = new Set([
  "americanstandardair.com", "aprilaire.com", "bryant.com", "carrier.com", "daikincomfort.com", "goodmanmfg.com",
  "lennox.com", "mitsubishicomfort.com", "navieninc.com", "rheem.com", "ruud.com", "trane.com", "york.com",
  "amana-hac.com", "coleman-hvac.com", "payne.com", "heil-hvac.com", "tempstar.com"
]);

// Free, instant first pass. Returns null when the domain is unknown (needs AI).
export function heuristicKind(domain: string): DomainKind | null {
  const d = normalize(domain);
  if (!d) return null;
  if (d.endsWith(".gov") || d.endsWith(".edu")) return "platform";
  const base = baseDomain(d);
  if (PLATFORM.has(d) || PLATFORM.has(base)) return "platform";
  if (MANUFACTURER.has(d) || MANUFACTURER.has(base)) return "manufacturer";
  return null;
}

async function readMap(): Promise<Record<string, DomainKind>> {
  try {
    return JSON.parse(await readFile(mapPath, "utf8")) as Record<string, DomainKind>;
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, DomainKind>) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(mapPath, JSON.stringify(map, null, 2));
}

// One batched ChatGPT call to classify the unknown domains. Cheap + no web search needed.
async function classifyWithAI(domains: string[]): Promise<Record<string, DomainKind>> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || process.env.DEMO_MODE !== "false" || !domains.length) return {};

  const input = [
    "Classify each domain into exactly one category for a US home-services (HVAC/plumbing/electrical) context:",
    "- platform: directory, review, listing, editorial/news, social, or search site (e.g. yelp.com, angi.com, birdeye.com, reddit.com).",
    "- contractor: the website of an individual home-services company (HVAC/plumbing/electrical/etc.).",
    "- manufacturer: an equipment maker or brand (e.g. carrier.com, trane.com).",
    "- other: anything else (government, utility, unrelated).",
    "",
    "Return ONLY a JSON object mapping each domain string to its category. No prose.",
    "",
    "Domains:",
    ...domains.map((d) => "- " + d)
  ].join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", input })
    });
    if (!res.ok) return {};
    const json = (await res.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const text = json.output_text ?? (json.output ?? []).flatMap((o) => (o.content ?? []).map((c) => c.text ?? "")).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};
    const parsed = JSON.parse(match[0]) as Record<string, string>;
    const out: Record<string, DomainKind> = {};
    for (const [domain, value] of Object.entries(parsed)) {
      const k = String(value).toLowerCase();
      out[normalize(domain)] = k === "platform" || k === "manufacturer" || k === "other" ? (k as DomainKind) : "contractor";
    }
    return out;
  } catch {
    return {};
  }
}

// Resolve kinds for a set of domains: learned table -> heuristic -> AI. New
// (AI/defaulted) mappings are persisted to data/domain-types.json so future
// audits of any company reuse them.
export async function classifyDomains(domains: string[]): Promise<Record<string, DomainKind>> {
  const unique = Array.from(new Set(domains.map(normalize))).filter(Boolean);
  const map = await readMap();
  const result: Record<string, DomainKind> = {};
  const unknown: string[] = [];

  for (const d of unique) {
    if (map[d]) {
      result[d] = map[d];
      continue;
    }
    const h = heuristicKind(d);
    if (h) {
      result[d] = h;
      continue;
    }
    unknown.push(d);
  }

  if (unknown.length) {
    const ai = await classifyWithAI(unknown);
    for (const d of unknown) {
      const kind = ai[d] ?? "contractor"; // default unknown -> contractor (== legacy "Competitor")
      result[d] = kind;
      map[d] = kind;
    }
    await writeMap(map);
  }

  return result;
}
