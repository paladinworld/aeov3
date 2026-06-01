import { readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnvLocal();

const apiKey = process.env.BRIGHT_DATA_API_KEY;
const zone = process.env.BRIGHT_DATA_SERP_ZONE || "serp_api1";
const query = process.argv.slice(2).join(" ") || "best HVAC company in San Jose, CA";

if (!apiKey) {
  console.error("Missing BRIGHT_DATA_API_KEY in .env.local or environment.");
  process.exit(1);
}

const url = new URL("https://www.google.com/search");
url.searchParams.set("q", query);
url.searchParams.set("gl", "us");
url.searchParams.set("hl", "en");
url.searchParams.set("brd_ai_overview", "2");

const response = await fetch("https://api.brightdata.com/request", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    zone,
    url: url.toString(),
    format: "raw"
  })
});

const text = await response.text();

if (!response.ok) {
  console.log("FAIL Bright Data AI Overview");
  console.log(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  process.exit(0);
}

let json;
try {
  json = JSON.parse(text);
} catch {
  console.log("WARN Bright Data AI Overview");
  console.log("Response was not JSON.");
  console.log(text.slice(0, 500));
  process.exit(0);
}

const overview = findAiOverview(json);
const organic = Array.isArray(json.organic) ? json.organic : [];
const local = json.local_results || json.local_pack || json.places || [];

console.log("PASS Bright Data SERP request");
console.log(`Query: ${json.general?.query ?? query}`);
console.log(`Location: ${json.general?.location ?? "unknown"}`);
console.log(`AI Overview present: ${overview ? "yes" : "no"}`);
console.log(`Organic results: ${organic.length}`);
console.log(`Local results: ${Array.isArray(local) ? local.length : 0}`);

if (overview) {
  const overviewText = overview.text || overview.description || overview.answer || JSON.stringify(overview).slice(0, 500);
  console.log(`AI Overview preview: ${String(overviewText).slice(0, 300).replace(/\s+/g, " ")}`);
  const citations = collectUrls(overview);
  console.log(`AI Overview citation URLs: ${citations.length}`);
  if (citations[0]) console.log(`First citation: ${citations[0]}`);
}

function findAiOverview(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAiOverview(item);
      if (found) return found;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replaceAll("_", "");
    if (normalized.includes("aioverview") || normalized === "overview") {
      return child;
    }
  }

  for (const child of Object.values(value)) {
    const found = findAiOverview(child);
    if (found) return found;
  }

  return null;
}

function collectUrls(value, urls = []) {
  if (!value || typeof value !== "object") return urls;
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, urls);
    return urls;
  }

  for (const [key, child] of Object.entries(value)) {
    if ((key === "url" || key === "link" || key === "href") && typeof child === "string" && child.startsWith("http")) {
      urls.push(child);
    } else {
      collectUrls(child, urls);
    }
  }

  return Array.from(new Set(urls));
}

function loadDotEnvLocal() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index);
      const value = trimmed.slice(index + 1);
      process.env[key] ??= value;
    }
  } catch {
    // Environment variables may be provided by the shell or Vercel.
  }
}
