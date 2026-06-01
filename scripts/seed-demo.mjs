/**
 * Seed the Hoffmann Brothers demo account into the local file store (data/db.json).
 *
 * Runs fully offline: with DEMO_MODE=true (the default in .env.local) every AI
 * provider falls back to the deterministic mock, so no API keys are required.
 *
 * Usage:
 *   1. Start the dev server:  npm run dev
 *   2. In another terminal:   node scripts/seed-demo.mjs
 *
 * Pass a different base URL as the first arg if not on :3000.
 */

const BASE = process.argv[2] || "http://localhost:3000";
const json = (response) => response.json();

async function main() {
  const company = await fetch(`${BASE}/api/companies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Hoffmann Brothers",
      website: "https://www.hoffmannbros.com",
      googleBusinessProfileUrl: "https://maps.google.com/?cid=hoffmannbrothers",
      services: [
        "AC repair",
        "AC installation",
        "Furnace repair",
        "Furnace installation",
        "Heat pump repair",
        "Ductless mini split",
        "Indoor air quality",
        "Duct cleaning",
        "Emergency HVAC",
        "Maintenance/tune-up"
      ],
      competitors: [
        "Jerry Kelly Heating & Air Conditioning",
        "Scott-Lee Heating Company",
        "Galmiche & Sons Heating & Cooling",
        "Vitt Heating & Cooling",
        "Classic Aire Care",
        "Welsch Heating & Cooling"
      ],
      locations: [
        { label: "St. Louis, MO", city: "St. Louis", state: "MO", latitude: 38.627, longitude: -90.1994, isPrimary: true },
        { label: "Nashville, TN", city: "Nashville", state: "TN", isPrimary: false }
      ]
    })
  }).then(json);

  console.log("company:", company.id, company.name);

  const report = await fetch(`${BASE}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId: company.id, locationIds: company.locations.map((l) => l.id), repeatRuns: 1, queryLimit: 28 })
  }).then(json);

  console.log("report:", report.id, "queries:", report.queries.length);

  const run = await fetch(`${BASE}/api/reports/${report.id}/run`, { method: "POST" }).then(json);
  console.log("run complete:", run.status, "runs:", run.runs.length);
}

main().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
