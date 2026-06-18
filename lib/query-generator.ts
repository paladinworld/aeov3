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
  service: string; // a service label (HVAC Service, "General HVAC", or a vertical's own)
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

// ── Tree Care (residential — e.g. Davey) ──────────────────────────────────────
// Reuses the 6 shared buckets so the dashboard's primary/secondary split works:
// Core General + Repair & Maintenance + Reviews & Price = primary high-intent.
const TREE_CARE_PROMPTS: PromptSpec[] = [
  { text: "best tree service in {place}", category: "Core General", intent: "best", priority: "high", service: "General Tree Care", geo: true },
  { text: "tree removal company near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "Tree removal", geo: true },
  { text: "best arborist in {place}", category: "Core General", intent: "best", priority: "high", service: "General Tree Care", geo: true },
  { text: "tree removal in {place}", category: "Core General", intent: "best", priority: "high", service: "Tree removal", geo: true },
  { text: "emergency tree removal in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency tree service", geo: true },
  { text: "24 hour tree service near me in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency tree service", geo: true },
  { text: "storm damage tree removal in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency tree service", geo: true },
  { text: "certified arborist in {place}", category: "Core General", intent: "best", priority: "medium", service: "General Tree Care", geo: true },
  { text: "licensed and insured tree service in {place}", category: "Core General", intent: "best", priority: "medium", service: "General Tree Care", geo: true },
  { text: "tree service company in {place}", category: "Core General", intent: "best", priority: "medium", service: "General Tree Care", geo: true },
  { text: "tree trimming in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Tree trimming", geo: true },
  { text: "tree pruning service in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Tree pruning", geo: true },
  { text: "stump grinding in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Stump grinding", geo: true },
  { text: "stump removal in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Stump grinding", geo: true },
  { text: "tree cabling and bracing in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Tree support", geo: true },
  { text: "shrub trimming and care in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Shrub care", geo: true },
  { text: "tree fertilization in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Tree health", geo: true },
  { text: "tree disease treatment in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Tree health", geo: true },
  { text: "top rated tree service in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "General Tree Care", geo: true },
  { text: "which tree service in {place} has the best reviews", category: "Reviews & Price", intent: "review", priority: "high", service: "General Tree Care", geo: true },
  { text: "most trusted tree care company in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "General Tree Care", geo: true },
  { text: "how much does tree removal cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "Tree removal", geo: true },
  { text: "average cost to remove a large tree in {place}", category: "Reviews & Price", intent: "price", priority: "medium", service: "Tree removal", geo: true },
  { text: "affordable tree service in {place}", category: "Reviews & Price", intent: "price", priority: "low", service: "General Tree Care", geo: true },
  { text: "how to choose a tree removal company", category: "Consideration", intent: "comparison", priority: "medium", service: "General Tree Care", geo: false },
  { text: "what to look for when hiring an arborist", category: "Consideration", intent: "comparison", priority: "medium", service: "General Tree Care", geo: false },
  { text: "questions to ask before hiring a tree service", category: "Consideration", intent: "comparison", priority: "medium", service: "General Tree Care", geo: false },
  { text: "do I need a certified arborist to remove a tree", category: "Consideration", intent: "comparison", priority: "low", service: "General Tree Care", geo: false },
  { text: "is it worth hiring a professional to remove a tree", category: "Consideration", intent: "comparison", priority: "low", service: "Tree removal", geo: false },
  { text: "how do I know if my tree is dying", category: "Symptom / Problem", intent: "problem", priority: "high", service: "Tree health", geo: false },
  { text: "signs a tree needs to be removed", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Tree removal", geo: false },
  { text: "my tree is leaning is it dangerous", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Emergency tree service", geo: false },
  { text: "tree roots damaging my foundation what should I do", category: "Symptom / Problem", intent: "problem", priority: "low", service: "Tree removal", geo: false },
  { text: "large dead branches hanging over my house who do I call in {place}", category: "Symptom / Problem", intent: "emergency", priority: "high", service: "Emergency tree service", geo: true },
];

// ── Commercial Landscaping (B2B — e.g. Yellowstone) ───────────────────────────
const COMMERCIAL_LANDSCAPING_PROMPTS: PromptSpec[] = [
  { text: "best commercial landscaping company in {place}", category: "Core General", intent: "best", priority: "high", service: "Commercial landscaping", geo: true },
  { text: "commercial landscaping companies near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "Commercial landscaping", geo: true },
  { text: "commercial grounds maintenance in {place}", category: "Core General", intent: "best", priority: "high", service: "Grounds maintenance", geo: true },
  { text: "HOA landscaping company in {place}", category: "Core General", intent: "best", priority: "high", service: "HOA landscaping", geo: true },
  { text: "commercial lawn care service in {place}", category: "Core General", intent: "best", priority: "medium", service: "Commercial lawn care", geo: true },
  { text: "commercial landscape maintenance in {place}", category: "Core General", intent: "best", priority: "high", service: "Landscape maintenance", geo: true },
  { text: "best commercial landscape contractor in {place}", category: "Core General", intent: "best", priority: "medium", service: "Commercial landscaping", geo: true },
  { text: "property management landscaping in {place}", category: "Core General", intent: "best", priority: "medium", service: "Commercial landscaping", geo: true },
  { text: "office park landscaping in {place}", category: "Core General", intent: "best", priority: "low", service: "Commercial landscaping", geo: true },
  { text: "landscaping for apartment complexes in {place}", category: "Core General", intent: "best", priority: "low", service: "Commercial landscaping", geo: true },
  { text: "commercial landscape maintenance contract in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Landscape maintenance", geo: true },
  { text: "commercial irrigation management in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Irrigation", geo: true },
  { text: "commercial irrigation repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Irrigation", geo: true },
  { text: "seasonal landscape enhancements in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Enhancements", geo: true },
  { text: "commercial tree care service in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Commercial tree care", geo: true },
  { text: "commercial lawn fertilization in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Commercial lawn care", geo: true },
  { text: "commercial snow and ice removal in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Snow & ice", geo: true },
  { text: "top rated commercial landscaping company in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "Commercial landscaping", geo: true },
  { text: "most trusted commercial landscaper in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "Commercial landscaping", geo: true },
  { text: "how much does commercial landscaping cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "Commercial landscaping", geo: true },
  { text: "commercial landscape maintenance cost in {place}", category: "Reviews & Price", intent: "price", priority: "medium", service: "Landscape maintenance", geo: true },
  { text: "commercial landscaping pricing in {place}", category: "Reviews & Price", intent: "price", priority: "low", service: "Commercial landscaping", geo: true },
  { text: "how to choose a commercial landscaping company", category: "Consideration", intent: "comparison", priority: "medium", service: "Commercial landscaping", geo: false },
  { text: "what to look for in a commercial landscape contractor", category: "Consideration", intent: "comparison", priority: "medium", service: "Commercial landscaping", geo: false },
  { text: "questions to ask before hiring a commercial landscaper", category: "Consideration", intent: "comparison", priority: "medium", service: "Commercial landscaping", geo: false },
  { text: "how to choose an HOA landscaping company", category: "Consideration", intent: "comparison", priority: "medium", service: "HOA landscaping", geo: false },
  { text: "what should be included in a commercial landscape maintenance contract", category: "Consideration", intent: "comparison", priority: "low", service: "Landscape maintenance", geo: false },
  { text: "in-house vs outsourced commercial landscaping", category: "Consideration", intent: "comparison", priority: "low", service: "Commercial landscaping", geo: false },
  { text: "best national commercial landscaping companies", category: "Product / Brand", intent: "comparison", priority: "low", service: "Commercial landscaping", geo: false },
];

// ── Pest Control (residential — e.g. Moxie) ───────────────────────────────────
const PEST_CONTROL_PROMPTS: PromptSpec[] = [
  { text: "best pest control company in {place}", category: "Core General", intent: "best", priority: "high", service: "General pest control", geo: true },
  { text: "pest control near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "General pest control", geo: true },
  { text: "exterminator near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "General pest control", geo: true },
  { text: "best exterminator in {place}", category: "Core General", intent: "best", priority: "high", service: "General pest control", geo: true },
  { text: "residential pest control in {place}", category: "Core General", intent: "best", priority: "medium", service: "General pest control", geo: true },
  { text: "emergency pest control in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency pest control", geo: true },
  { text: "same day pest control in {place}", category: "Core General", intent: "emergency", priority: "medium", service: "Emergency pest control", geo: true },
  { text: "pest control service in {place}", category: "Core General", intent: "best", priority: "medium", service: "General pest control", geo: true },
  { text: "local pest control company in {place}", category: "Core General", intent: "best", priority: "medium", service: "General pest control", geo: true },
  { text: "licensed exterminator in {place}", category: "Core General", intent: "best", priority: "low", service: "General pest control", geo: true },
  { text: "termite treatment in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Termite control", geo: true },
  { text: "termite inspection in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Termite control", geo: true },
  { text: "mosquito control in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Mosquito control", geo: true },
  { text: "bed bug treatment in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Bed bug control", geo: true },
  { text: "rodent control in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Rodent control", geo: true },
  { text: "ant control in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Ant control", geo: true },
  { text: "cockroach exterminator in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Cockroach control", geo: true },
  { text: "wasp and hornet removal in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Stinging insects", geo: true },
  { text: "quarterly pest control service in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "General pest control", geo: true },
  { text: "top rated pest control company in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "General pest control", geo: true },
  { text: "which pest control company in {place} has the best reviews", category: "Reviews & Price", intent: "review", priority: "high", service: "General pest control", geo: true },
  { text: "most trusted exterminator in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "General pest control", geo: true },
  { text: "how much does pest control cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "General pest control", geo: true },
  { text: "average cost of monthly pest control in {place}", category: "Reviews & Price", intent: "price", priority: "medium", service: "General pest control", geo: true },
  { text: "affordable pest control in {place}", category: "Reviews & Price", intent: "price", priority: "low", service: "General pest control", geo: true },
  { text: "how to choose a pest control company", category: "Consideration", intent: "comparison", priority: "medium", service: "General pest control", geo: false },
  { text: "what to look for in an exterminator", category: "Consideration", intent: "comparison", priority: "medium", service: "General pest control", geo: false },
  { text: "questions to ask a pest control company before hiring", category: "Consideration", intent: "comparison", priority: "medium", service: "General pest control", geo: false },
  { text: "is professional pest control worth it", category: "Consideration", intent: "comparison", priority: "low", service: "General pest control", geo: false },
  { text: "monthly vs quarterly pest control", category: "Consideration", intent: "comparison", priority: "low", service: "General pest control", geo: false },
  { text: "how do I know if I have termites", category: "Symptom / Problem", intent: "problem", priority: "high", service: "Termite control", geo: false },
  { text: "signs of a bed bug infestation", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Bed bug control", geo: false },
  { text: "how to get rid of ants in the house", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Ant control", geo: false },
  { text: "mice in my house who do I call in {place}", category: "Symptom / Problem", intent: "emergency", priority: "medium", service: "Rodent control", geo: true },
];

// The prompt set per vertical. A new vertical = a new array here + an entry in this map.
const PROMPTS_BY_VERTICAL: Record<string, PromptSpec[]> = {
  "HVAC": HVAC_PROMPTS,
  "Tree Care": TREE_CARE_PROMPTS,
  "Commercial Landscaping": COMMERCIAL_LANDSCAPING_PROMPTS,
  "Pest Control": PEST_CONTROL_PROMPTS
};

// Shared builder: substitutes the company's primary "City, ST" into each prompt and
// assigns surfaces from the geo flag (LOCAL includes Maps; NATIONAL doesn't).
function buildQueries(company: Company, prompts: PromptSpec[]): Query[] {
  const primary = company.locations.find((location) => location.isPrimary) ?? company.locations[0];
  const city = primary?.city || "your city";
  const state = primary?.state || "";
  const place = `${city}${state ? `, ${state}` : ""}`;

  return prompts.map((spec) => {
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
      surfaces: spec.geo ? LOCAL : NATIONAL
    };
  });
}

// Generate the prompt set for a report's vertical (defaults to HVAC). This is the single
// entry point the report-create route uses, so every vertical flows through one path.
export function generateQueries(company: Company, vertical?: string): Query[] {
  return buildQueries(company, PROMPTS_BY_VERTICAL[vertical || "HVAC"] ?? HVAC_PROMPTS);
}

// Back-compat alias (HVAC-only callers).
export function generateHvacQueries(company: Company): Query[] {
  return buildQueries(company, HVAC_PROMPTS);
}

// queryDepth is metadata only now (the static list isn't scored/balanced); kept so
// longTailCount and any depth display stay meaningful. Simple word-count heuristic.
function queryDepth(text: string): "head" | "mid_tail" | "long_tail" {
  const words = text.trim().split(/\s+/).length;
  if (words <= 5) return "head";
  if (words <= 8) return "mid_tail";
  return "long_tail";
}
