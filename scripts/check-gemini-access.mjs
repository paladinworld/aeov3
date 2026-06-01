import { readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnvLocal();

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY in .env.local or environment.");
  process.exit(1);
}

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const checks = [
  {
    name: "Google Search Grounding",
    body: {
      contents: [
        {
          role: "user",
          parts: [{ text: "What are the top HVAC companies in San Jose, CA? Cite sources." }]
        }
      ],
      tools: [{ googleSearch: {} }]
    },
    sourceKey: "web"
  },
  {
    name: "Google Maps Grounding",
    body: {
      contents: [
        {
          role: "user",
          parts: [{ text: "Which HVAC contractors near me are relevant for AC repair?" }]
        }
      ],
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: { latitude: 37.3382, longitude: -121.8863 }
        }
      }
    },
    sourceKey: "maps"
  }
];

for (const check of checks) {
  await runCheck(check);
}

async function runCheck(check) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(check.body)
  });

  const json = await response.json();

  if (!response.ok) {
    console.log(`FAIL ${check.name}`);
    console.log(`HTTP ${response.status}: ${json?.error?.message ?? "Unknown error"}`);
    return;
  }

  const metadata = json?.candidates?.[0]?.groundingMetadata;
  const chunks = metadata?.groundingChunks ?? [];
  const matchedChunks = chunks.filter((chunk) => chunk?.[check.sourceKey]);

  if (matchedChunks.length > 0) {
    console.log(`PASS ${check.name}`);
    console.log(`Grounding chunks: ${matchedChunks.length}`);
    console.log(`First source: ${sourceLabel(matchedChunks[0])}`);
    return;
  }

  console.log(`WARN ${check.name}`);
  console.log("Request succeeded, but no matching grounding chunks were returned.");
}

function sourceLabel(chunk) {
  const source = chunk.web ?? chunk.maps ?? {};
  return source.title || source.uri || source.placeId || "source returned";
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
