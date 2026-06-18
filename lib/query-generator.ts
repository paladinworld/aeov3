import { Company, Query, QueryCategory, QueryIntent, Service, Surface } from "./types";
import { id } from "./store";

// Surfaces each prompt is run against (this is what actually gets queried, and it
// drives audit cost: surfaces × repeatRuns). Derived from the CSV's Geo Param:
//  - LOCAL    (Geo = Yes / Local Pack / Hybrid): a local pack exists → include Gemini Maps.
//  - NATIONAL (Geo = No, e.g. brand & symptom prompts): no local pack → skip Maps.
// google_ai_overview = Google AI Mode (via DataForSEO) — a scored engine, so every prompt
// includes it; it's collected for both local and national queries.
const LOCAL: Surface[] = ["gemini_maps", "gemini_search", "google_ai_overview", "chatgpt_search"];
const NATIONAL: Surface[] = ["gemini_search", "google_ai_overview", "chatgpt_search"];

type PromptSpec = {
  text: string; // {place} is replaced with the report's primary "City, ST"
  category: QueryCategory; // the CSV "Bucket" — the dashboard's prompt type
  intent: QueryIntent; // funnel/intent cue, shown as the per-prompt badge only
  priority: "high" | "medium" | "low";
  service: Service | "General HVAC";
  geo: boolean; // true = local (includes Gemini Maps); false = national (no Maps)
};

// ── The locked V3 HVAC prompt set (40 prompts, from "AI Visibility Prompts - V3.csv"). ──
// This is the single source of truth for which prompts every NEW HVAC audit runs — it is
// intentionally static so results stay comparable across companies and over time. Editing
// the official HVAC list means editing THIS array. A new vertical should get its own list
// + its own buckets in QueryCategory (lib/types.ts), not be mixed in here.
const HVAC_PROMPTS: PromptSpec[] = [
  // Core General
  { text: "best HVAC company in {place}", category: "Core General", intent: "best", priority: "high", service: "General HVAC", geo: true },
  { text: "HVAC company near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "General HVAC", geo: true },
  { text: "best heating and cooling company in {place}", category: "Core General", intent: "best", priority: "high", service: "General HVAC", geo: true },
  { text: "best heating and air conditioning company in {place}", category: "Core General", intent: "best", priority: "medium", service: "General HVAC", geo: true },
  { text: "who is the best HVAC company to call in {place}", category: "Core General", intent: "best", priority: "high", service: "General HVAC", geo: true },
  { text: "most reliable HVAC company in {place}", category: "Core General", intent: "best", priority: "medium", service: "General HVAC", geo: true },
  { text: "emergency HVAC repair in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency HVAC", geo: true },
  { text: "24 hour HVAC repair near me in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency HVAC", geo: true },
  { text: "same day AC repair in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency HVAC", geo: true },
  { text: "AC installation in {place}", category: "Core General", intent: "best", priority: "high", service: "AC installation", geo: true },
  { text: "new furnace installation in {place}", category: "Core General", intent: "best", priority: "medium", service: "Furnace installation", geo: true },
  { text: "HVAC system replacement company in {place}", category: "Core General", intent: "best", priority: "medium", service: "General HVAC", geo: true },
  { text: "heat pump installation in {place}", category: "Core General", intent: "best", priority: "low", service: "General HVAC", geo: true },
  { text: "mini split installation in {place}", category: "Core General", intent: "best", priority: "low", service: "Ductless mini split", geo: true },
  { text: "licensed HVAC contractor in {place}", category: "Core General", intent: "best", priority: "medium", service: "General HVAC", geo: true },

  // Repair & Maintenance
  { text: "AC repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "AC repair", geo: true },
  { text: "furnace repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Furnace repair", geo: true },
  { text: "heat pump repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Heat pump repair", geo: true },
  { text: "AC tune up near me in {place}", category: "Repair & Maintenance", intent: "near_me", priority: "medium", service: "Maintenance/tune-up", geo: true },
  { text: "HVAC maintenance plan in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Maintenance/tune-up", geo: true },

  // Reviews & Price
  { text: "top rated HVAC company in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "General HVAC", geo: true },
  { text: "which HVAC companies in {place} have the best reviews", category: "Reviews & Price", intent: "review", priority: "high", service: "General HVAC", geo: true },
  { text: "most trusted HVAC company in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "General HVAC", geo: true },
  { text: "how much does AC replacement cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "General HVAC", geo: true },
  { text: "HVAC company in {place} with financing", category: "Reviews & Price", intent: "price", priority: "low", service: "General HVAC", geo: true },

  // Product / Brand
  { text: "best company to install a Lennox AC system in {place}", category: "Product / Brand", intent: "best", priority: "medium", service: "AC installation", geo: true },
  { text: "factory authorized Carrier dealer in {place}", category: "Product / Brand", intent: "best", priority: "medium", service: "General HVAC", geo: true },
  { text: "experienced Mitsubishi mini split installer in {place}", category: "Product / Brand", intent: "best", priority: "low", service: "Ductless mini split", geo: true },
  { text: "most reliable central air conditioner brand", category: "Product / Brand", intent: "comparison", priority: "low", service: "General HVAC", geo: false },
  { text: "Carrier vs Trane vs Lennox which is better", category: "Product / Brand", intent: "comparison", priority: "medium", service: "General HVAC", geo: false },

  // Consideration
  { text: "how to choose a good HVAC company", category: "Consideration", intent: "comparison", priority: "medium", service: "General HVAC", geo: false },
  { text: "what questions should I ask before hiring an HVAC company", category: "Consideration", intent: "comparison", priority: "medium", service: "General HVAC", geo: false },
  { text: "how do I know if an HVAC company is trustworthy", category: "Consideration", intent: "comparison", priority: "medium", service: "General HVAC", geo: false },
  { text: "should I get a second opinion before replacing my HVAC system", category: "Consideration", intent: "comparison", priority: "medium", service: "General HVAC", geo: false },
  { text: "is it worth repairing or replacing an old air conditioner", category: "Consideration", intent: "comparison", priority: "medium", service: "AC repair", geo: false },

  // Symptom / Problem
  { text: "why is my AC blowing warm air", category: "Symptom / Problem", intent: "problem", priority: "high", service: "AC repair", geo: false },
  { text: "my furnace turns on then shuts off after a few minutes", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Furnace repair", geo: false },
  { text: "my AC runs but the house is not getting cold", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "AC repair", geo: false },
  { text: "upstairs is hot and downstairs is cold in a two story house", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "General HVAC", geo: false },
  { text: "no heat in the middle of the night who do I call in {place}", category: "Symptom / Problem", intent: "emergency", priority: "high", service: "Emergency HVAC", geo: true },
];

export function generateHvacQueries(company: Company): Query[] {
  const primary = company.locations.find((location) => location.isPrimary) ?? company.locations[0];
  const city = primary?.city || "your city";
  const state = primary?.state || "";
  const place = `${city}${state ? `, ${state}` : ""}`;

  return HVAC_PROMPTS.map((spec) => {
    const text = spec.text.replaceAll("{place}", place);
    const depth = queryDepth(text);
    return {
      id: id("query"),
      text,
      service: spec.service,
      category: spec.category,
      intent: spec.intent,
      priority: spec.priority,
      queryDepth: depth,
      longTail: depth === "long_tail",
      surfaces: spec.geo ? LOCAL : NATIONAL,
    };
  });
}

// queryDepth is metadata only now (the static list isn't scored/balanced); kept so
// longTailCount and any depth display stay meaningful. Simple word-count heuristic.
function queryDepth(text: string): "head" | "mid_tail" | "long_tail" {
  const words = text.trim().split(/\s+/).length;
  if (words <= 5) return "head";
  if (words <= 8) return "mid_tail";
  return "long_tail";
}
