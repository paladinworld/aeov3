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

// ── Plumbing (residential + light commercial — e.g. TLC Plumbing) ──────────────
// Same locked-static contract as the other verticals: 34 prompts, edits here are the
// official list. Mirrors the Pest Control category mix (Core 10 / R&M 9 / Reviews 6 /
// Product 2 / Consideration 4 / Symptom 3) so cross-vertical results stay comparable.
const PLUMBING_PROMPTS: PromptSpec[] = [
  // Core General
  { text: "best plumber in {place}", category: "Core General", intent: "best", priority: "high", service: "General plumbing", geo: true },
  { text: "plumber near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "General plumbing", geo: true },
  { text: "best plumbing company in {place}", category: "Core General", intent: "best", priority: "high", service: "General plumbing", geo: true },
  { text: "emergency plumber in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency plumbing", geo: true },
  { text: "24 hour plumber near me in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency plumbing", geo: true },
  { text: "same day plumbing repair in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency plumbing", geo: true },
  { text: "licensed plumber in {place}", category: "Core General", intent: "best", priority: "medium", service: "General plumbing", geo: true },
  { text: "local plumbing company in {place}", category: "Core General", intent: "best", priority: "medium", service: "General plumbing", geo: true },
  { text: "residential plumber in {place}", category: "Core General", intent: "best", priority: "medium", service: "General plumbing", geo: true },
  { text: "commercial plumber in {place}", category: "Core General", intent: "best", priority: "low", service: "Commercial plumbing", geo: true },

  // Repair & Maintenance
  { text: "water heater repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Water heater", geo: true },
  { text: "water heater installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Water heater", geo: true },
  { text: "tankless water heater installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Water heater", geo: true },
  { text: "drain cleaning in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Drain cleaning", geo: true },
  { text: "clogged drain repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Drain cleaning", geo: true },
  { text: "sewer line repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Sewer line", geo: true },
  { text: "slab leak repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Leak repair", geo: true },
  { text: "toilet repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Fixtures", geo: true },
  { text: "repipe specialist in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Repipe", geo: true },

  // Reviews & Price
  { text: "top rated plumber in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "General plumbing", geo: true },
  { text: "which plumbers in {place} have the best reviews", category: "Reviews & Price", intent: "review", priority: "high", service: "General plumbing", geo: true },
  { text: "most trusted plumbing company in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "General plumbing", geo: true },
  { text: "how much does a plumber cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "General plumbing", geo: true },
  { text: "water heater replacement cost in {place}", category: "Reviews & Price", intent: "price", priority: "medium", service: "Water heater", geo: true },
  { text: "affordable plumber in {place}", category: "Reviews & Price", intent: "price", priority: "low", service: "General plumbing", geo: true },

  // Product / Brand
  { text: "best plumber to install a Rinnai tankless water heater in {place}", category: "Product / Brand", intent: "best", priority: "medium", service: "Water heater", geo: true },
  { text: "plumber to install a Navien tankless water heater in {place}", category: "Product / Brand", intent: "best", priority: "low", service: "Water heater", geo: true },

  // Consideration
  { text: "how to choose a plumber", category: "Consideration", intent: "comparison", priority: "medium", service: "General plumbing", geo: false },
  { text: "what to look for in a plumbing company", category: "Consideration", intent: "comparison", priority: "medium", service: "General plumbing", geo: false },
  { text: "questions to ask a plumber before hiring", category: "Consideration", intent: "comparison", priority: "medium", service: "General plumbing", geo: false },
  { text: "is it worth hiring a professional plumber", category: "Consideration", intent: "comparison", priority: "low", service: "General plumbing", geo: false },

  // Symptom / Problem
  { text: "why is my water heater leaking", category: "Symptom / Problem", intent: "problem", priority: "high", service: "Water heater", geo: false },
  { text: "how to fix low water pressure in the house", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "General plumbing", geo: false },
  { text: "sewer smell in house who do I call in {place}", category: "Symptom / Problem", intent: "emergency", priority: "medium", service: "Sewer line", geo: true },
];

// ── Roofing (residential + light commercial — e.g. DaBella) ───────────────────
// Locked-static, 34 prompts, same category mix as Pest/Plumbing (Core 10 / R&M 9 /
// Reviews 6 / Product 2 / Consideration 4 / Symptom 3) for cross-vertical comparability.
const ROOFING_PROMPTS: PromptSpec[] = [
  // Core General
  { text: "best roofing company in {place}", category: "Core General", intent: "best", priority: "high", service: "General roofing", geo: true },
  { text: "roofer near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "General roofing", geo: true },
  { text: "best roofer in {place}", category: "Core General", intent: "best", priority: "high", service: "General roofing", geo: true },
  { text: "roofing contractor in {place}", category: "Core General", intent: "best", priority: "high", service: "General roofing", geo: true },
  { text: "emergency roof repair in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency roofing", geo: true },
  { text: "24 hour roof repair near me in {place}", category: "Core General", intent: "emergency", priority: "medium", service: "Emergency roofing", geo: true },
  { text: "licensed roofing contractor in {place}", category: "Core General", intent: "best", priority: "medium", service: "General roofing", geo: true },
  { text: "local roofing company in {place}", category: "Core General", intent: "best", priority: "medium", service: "General roofing", geo: true },
  { text: "residential roofing company in {place}", category: "Core General", intent: "best", priority: "medium", service: "Residential roofing", geo: true },
  { text: "commercial roofing company in {place}", category: "Core General", intent: "best", priority: "low", service: "Commercial roofing", geo: true },

  // Repair & Maintenance
  { text: "roof repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Roof repair", geo: true },
  { text: "roof replacement in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Roof replacement", geo: true },
  { text: "new roof installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Roof replacement", geo: true },
  { text: "metal roof installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Metal roofing", geo: true },
  { text: "asphalt shingle roof replacement in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Shingle roofing", geo: true },
  { text: "flat roof repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Flat roofing", geo: true },
  { text: "roof leak repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Leak repair", geo: true },
  { text: "storm damage roof repair in {place}", category: "Repair & Maintenance", intent: "emergency", priority: "high", service: "Storm damage", geo: true },
  { text: "roof inspection in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Roof inspection", geo: true },

  // Reviews & Price
  { text: "top rated roofing company in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "General roofing", geo: true },
  { text: "which roofing companies in {place} have the best reviews", category: "Reviews & Price", intent: "review", priority: "high", service: "General roofing", geo: true },
  { text: "most trusted roofer in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "General roofing", geo: true },
  { text: "how much does a new roof cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "Roof replacement", geo: true },
  { text: "roof replacement cost in {place}", category: "Reviews & Price", intent: "price", priority: "medium", service: "Roof replacement", geo: true },
  { text: "affordable roofing company in {place}", category: "Reviews & Price", intent: "price", priority: "low", service: "General roofing", geo: true },

  // Product / Brand
  { text: "best roofer to install GAF shingles in {place}", category: "Product / Brand", intent: "best", priority: "medium", service: "Shingle roofing", geo: true },
  { text: "CertainTeed roofing installer in {place}", category: "Product / Brand", intent: "best", priority: "low", service: "Shingle roofing", geo: true },

  // Consideration
  { text: "how to choose a roofing contractor", category: "Consideration", intent: "comparison", priority: "medium", service: "General roofing", geo: false },
  { text: "what to look for in a roofing company", category: "Consideration", intent: "comparison", priority: "medium", service: "General roofing", geo: false },
  { text: "questions to ask a roofer before hiring", category: "Consideration", intent: "comparison", priority: "medium", service: "General roofing", geo: false },
  { text: "how to pay for a new roof", category: "Consideration", intent: "comparison", priority: "low", service: "General roofing", geo: false },

  // Symptom / Problem
  { text: "signs you need a new roof", category: "Symptom / Problem", intent: "problem", priority: "high", service: "Roof replacement", geo: false },
  { text: "why is my roof leaking", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Leak repair", geo: false },
  { text: "hail damage on roof who do I call in {place}", category: "Symptom / Problem", intent: "emergency", priority: "medium", service: "Storm damage", geo: true },
];

// ── Windows (replacement windows + install — e.g. DaBella) ────────────────────
// Locked-static, 34 prompts, same category mix as the other home-services verticals.
// Windows is install/replace-driven (not emergency), so no emergency-intent prompts.
const WINDOWS_PROMPTS: PromptSpec[] = [
  // Core General
  { text: "best window replacement company in {place}", category: "Core General", intent: "best", priority: "high", service: "Window replacement", geo: true },
  { text: "window replacement near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "Window replacement", geo: true },
  { text: "best window installation company in {place}", category: "Core General", intent: "best", priority: "high", service: "Window installation", geo: true },
  { text: "replacement windows in {place}", category: "Core General", intent: "best", priority: "high", service: "Window replacement", geo: true },
  { text: "window company near me in {place}", category: "Core General", intent: "near_me", priority: "medium", service: "General windows", geo: true },
  { text: "local window replacement company in {place}", category: "Core General", intent: "best", priority: "medium", service: "Window replacement", geo: true },
  { text: "licensed window installer in {place}", category: "Core General", intent: "best", priority: "medium", service: "Window installation", geo: true },
  { text: "residential window replacement in {place}", category: "Core General", intent: "best", priority: "medium", service: "Window replacement", geo: true },
  { text: "energy efficient window installation in {place}", category: "Core General", intent: "best", priority: "medium", service: "Energy efficient windows", geo: true },
  { text: "vinyl window replacement in {place}", category: "Core General", intent: "best", priority: "low", service: "Vinyl windows", geo: true },

  // Repair & Maintenance
  { text: "window installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Window installation", geo: true },
  { text: "double pane window replacement in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Window replacement", geo: true },
  { text: "double hung window installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Window installation", geo: true },
  { text: "bay window installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Specialty windows", geo: true },
  { text: "egress window installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Specialty windows", geo: true },
  { text: "storm window installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Storm windows", geo: true },
  { text: "window glass replacement in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Glass replacement", geo: true },
  { text: "broken window repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Window repair", geo: true },
  { text: "patio door installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Doors", geo: true },

  // Reviews & Price
  { text: "top rated window replacement company in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "Window replacement", geo: true },
  { text: "which window companies in {place} have the best reviews", category: "Reviews & Price", intent: "review", priority: "high", service: "General windows", geo: true },
  { text: "most trusted window installer in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "Window installation", geo: true },
  { text: "how much does window replacement cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "Window replacement", geo: true },
  { text: "cost to replace windows in {place}", category: "Reviews & Price", intent: "price", priority: "medium", service: "Window replacement", geo: true },
  { text: "affordable window replacement in {place}", category: "Reviews & Price", intent: "price", priority: "low", service: "Window replacement", geo: true },

  // Product / Brand
  { text: "best company to install Andersen windows in {place}", category: "Product / Brand", intent: "best", priority: "medium", service: "Window installation", geo: true },
  { text: "Pella window installer in {place}", category: "Product / Brand", intent: "best", priority: "low", service: "Window installation", geo: true },

  // Consideration
  { text: "how to choose a window replacement company", category: "Consideration", intent: "comparison", priority: "medium", service: "General windows", geo: false },
  { text: "what to look for in a window installer", category: "Consideration", intent: "comparison", priority: "medium", service: "General windows", geo: false },
  { text: "questions to ask before replacing windows", category: "Consideration", intent: "comparison", priority: "medium", service: "General windows", geo: false },
  { text: "are replacement windows worth it", category: "Consideration", intent: "comparison", priority: "low", service: "General windows", geo: false },

  // Symptom / Problem
  { text: "signs you need new windows", category: "Symptom / Problem", intent: "problem", priority: "high", service: "Window replacement", geo: false },
  { text: "how to fix a drafty window", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Window repair", geo: false },
  { text: "foggy window between panes who do I call in {place}", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Glass replacement", geo: true },
];

// ── Foundation (foundation repair + waterproofing — e.g. VFS) ─────────────────
// Locked-static, 34 prompts, same category mix as the other home-services verticals.
const FOUNDATION_PROMPTS: PromptSpec[] = [
  // Core General
  { text: "best foundation repair company in {place}", category: "Core General", intent: "best", priority: "high", service: "Foundation repair", geo: true },
  { text: "foundation repair near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "Foundation repair", geo: true },
  { text: "best foundation repair contractor in {place}", category: "Core General", intent: "best", priority: "high", service: "Foundation repair", geo: true },
  { text: "foundation repair company in {place}", category: "Core General", intent: "best", priority: "high", service: "Foundation repair", geo: true },
  { text: "foundation repair specialist near me in {place}", category: "Core General", intent: "near_me", priority: "medium", service: "Foundation repair", geo: true },
  { text: "local foundation repair company in {place}", category: "Core General", intent: "best", priority: "medium", service: "Foundation repair", geo: true },
  { text: "licensed foundation contractor in {place}", category: "Core General", intent: "best", priority: "medium", service: "Foundation repair", geo: true },
  { text: "residential foundation repair in {place}", category: "Core General", intent: "best", priority: "medium", service: "Foundation repair", geo: true },
  { text: "commercial foundation repair in {place}", category: "Core General", intent: "best", priority: "low", service: "Commercial foundation", geo: true },
  { text: "structural repair company in {place}", category: "Core General", intent: "best", priority: "medium", service: "Structural repair", geo: true },

  // Repair & Maintenance
  { text: "foundation crack repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Crack repair", geo: true },
  { text: "basement waterproofing in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Waterproofing", geo: true },
  { text: "crawl space repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Crawl space", geo: true },
  { text: "crawl space encapsulation in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Crawl space", geo: true },
  { text: "house leveling in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "House leveling", geo: true },
  { text: "pier and beam foundation repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Pier & beam", geo: true },
  { text: "slab foundation repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Slab repair", geo: true },
  { text: "sump pump installation in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Waterproofing", geo: true },
  { text: "foundation inspection in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Foundation inspection", geo: true },

  // Reviews & Price
  { text: "top rated foundation repair company in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "Foundation repair", geo: true },
  { text: "which foundation repair companies in {place} have the best reviews", category: "Reviews & Price", intent: "review", priority: "high", service: "Foundation repair", geo: true },
  { text: "most trusted foundation repair company in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "Foundation repair", geo: true },
  { text: "how much does foundation repair cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "Foundation repair", geo: true },
  { text: "foundation repair cost in {place}", category: "Reviews & Price", intent: "price", priority: "medium", service: "Foundation repair", geo: true },
  { text: "affordable foundation repair in {place}", category: "Reviews & Price", intent: "price", priority: "low", service: "Foundation repair", geo: true },

  // Product / Brand
  { text: "helical pier foundation repair in {place}", category: "Product / Brand", intent: "best", priority: "medium", service: "Piering", geo: true },
  { text: "push pier foundation installation in {place}", category: "Product / Brand", intent: "best", priority: "low", service: "Piering", geo: true },

  // Consideration
  { text: "how to choose a foundation repair company", category: "Consideration", intent: "comparison", priority: "medium", service: "Foundation repair", geo: false },
  { text: "what to look for in a foundation repair contractor", category: "Consideration", intent: "comparison", priority: "medium", service: "Foundation repair", geo: false },
  { text: "questions to ask a foundation repair company before hiring", category: "Consideration", intent: "comparison", priority: "medium", service: "Foundation repair", geo: false },
  { text: "is foundation repair worth it", category: "Consideration", intent: "comparison", priority: "low", service: "Foundation repair", geo: false },

  // Symptom / Problem
  { text: "signs of foundation problems", category: "Symptom / Problem", intent: "problem", priority: "high", service: "Foundation repair", geo: false },
  { text: "cracks in walls and foundation what to do", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Crack repair", geo: false },
  { text: "my foundation is settling who do I call in {place}", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Foundation repair", geo: true },
];

// The prompt set per vertical. A new vertical = a new array here + an entry in this map.
// ── Residential Water Treatment (34 prompts, locked). Softeners, filtration, RO, well water. ──
const WATER_TREATMENT_PROMPTS: PromptSpec[] = [
  // Core General
  { text: "best water treatment company in {place}", category: "Core General", intent: "best", priority: "high", service: "Water treatment", geo: true },
  { text: "water treatment company near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "Water treatment", geo: true },
  { text: "best water softener company in {place}", category: "Core General", intent: "best", priority: "high", service: "Water softener", geo: true },
  { text: "water softener installation in {place}", category: "Core General", intent: "best", priority: "high", service: "Water softener", geo: true },
  { text: "whole house water filtration in {place}", category: "Core General", intent: "best", priority: "medium", service: "Whole house filtration", geo: true },
  { text: "best water filtration company in {place}", category: "Core General", intent: "best", priority: "high", service: "Water filtration", geo: true },
  { text: "reverse osmosis system installation in {place}", category: "Core General", intent: "best", priority: "medium", service: "Reverse osmosis", geo: true },
  { text: "well water treatment company in {place}", category: "Core General", intent: "best", priority: "medium", service: "Well water treatment", geo: true },
  { text: "local water treatment company in {place}", category: "Core General", intent: "best", priority: "medium", service: "Water treatment", geo: true },
  { text: "licensed water treatment company in {place}", category: "Core General", intent: "best", priority: "low", service: "Water treatment", geo: true },

  // Repair & Maintenance
  { text: "water softener repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Water softener", geo: true },
  { text: "water softener maintenance in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Water softener", geo: true },
  { text: "water filter replacement in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Water filtration", geo: true },
  { text: "reverse osmosis system repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Reverse osmosis", geo: true },
  { text: "water treatment system service in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Water treatment", geo: true },
  { text: "water softener salt delivery in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Water softener", geo: true },
  { text: "emergency water treatment repair in {place}", category: "Repair & Maintenance", intent: "emergency", priority: "low", service: "Water treatment", geo: true },
  { text: "water testing service in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Water testing", geo: true },
  { text: "water quality testing near me in {place}", category: "Repair & Maintenance", intent: "near_me", priority: "medium", service: "Water testing", geo: true },

  // Reviews & Price
  { text: "top rated water treatment company in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "Water treatment", geo: true },
  { text: "which water treatment companies in {place} have the best reviews", category: "Reviews & Price", intent: "review", priority: "high", service: "Water treatment", geo: true },
  { text: "most trusted water softener company in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "Water softener", geo: true },
  { text: "how much does a water softener cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "Water softener", geo: true },
  { text: "water softener system cost in {place}", category: "Reviews & Price", intent: "price", priority: "medium", service: "Water softener", geo: true },
  { text: "water treatment company in {place} with financing", category: "Reviews & Price", intent: "price", priority: "low", service: "Water treatment", geo: true },

  // Product / Brand
  { text: "best company to install a Culligan water softener in {place}", category: "Product / Brand", intent: "best", priority: "medium", service: "Water softener", geo: true },
  { text: "salt free water softener installation in {place}", category: "Product / Brand", intent: "best", priority: "low", service: "Water softener", geo: true },

  // Consideration
  { text: "how to choose a water treatment company", category: "Consideration", intent: "comparison", priority: "medium", service: "Water treatment", geo: false },
  { text: "water softener vs water filtration system", category: "Consideration", intent: "comparison", priority: "medium", service: "Water treatment", geo: false },
  { text: "is a whole house water filter worth it", category: "Consideration", intent: "comparison", priority: "low", service: "Whole house filtration", geo: false },
  { text: "questions to ask before buying a water softener", category: "Consideration", intent: "comparison", priority: "medium", service: "Water softener", geo: false },

  // Symptom / Problem
  { text: "hard water problems in my house who to call in {place}", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Water softener", geo: true },
  { text: "signs you need a water softener", category: "Symptom / Problem", intent: "problem", priority: "high", service: "Water softener", geo: false },
  { text: "why does my tap water smell bad", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Water filtration", geo: false },
];

// ── Water Heater (34 prompts, locked). Install, repair, replacement, tankless. ──
const WATER_HEATER_PROMPTS: PromptSpec[] = [
  // Core General
  { text: "best water heater company in {place}", category: "Core General", intent: "best", priority: "high", service: "Water heater", geo: true },
  { text: "water heater installation near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "Water heater installation", geo: true },
  { text: "water heater replacement in {place}", category: "Core General", intent: "best", priority: "high", service: "Water heater replacement", geo: true },
  { text: "best water heater installation company in {place}", category: "Core General", intent: "best", priority: "high", service: "Water heater installation", geo: true },
  { text: "tankless water heater installation in {place}", category: "Core General", intent: "best", priority: "high", service: "Tankless water heater", geo: true },
  { text: "new water heater installation in {place}", category: "Core General", intent: "best", priority: "medium", service: "Water heater installation", geo: true },
  { text: "gas water heater installation in {place}", category: "Core General", intent: "best", priority: "medium", service: "Gas water heater", geo: true },
  { text: "electric water heater installation in {place}", category: "Core General", intent: "best", priority: "medium", service: "Electric water heater", geo: true },
  { text: "local water heater company in {place}", category: "Core General", intent: "best", priority: "medium", service: "Water heater", geo: true },
  { text: "licensed water heater installer in {place}", category: "Core General", intent: "best", priority: "low", service: "Water heater installation", geo: true },

  // Repair & Maintenance
  { text: "water heater repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Water heater repair", geo: true },
  { text: "emergency water heater repair in {place}", category: "Repair & Maintenance", intent: "emergency", priority: "high", service: "Water heater repair", geo: true },
  { text: "same day water heater repair in {place}", category: "Repair & Maintenance", intent: "emergency", priority: "high", service: "Water heater repair", geo: true },
  { text: "tankless water heater repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Tankless water heater", geo: true },
  { text: "water heater maintenance in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Water heater repair", geo: true },
  { text: "water heater flush service in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Water heater repair", geo: true },
  { text: "hot water heater repair near me in {place}", category: "Repair & Maintenance", intent: "near_me", priority: "high", service: "Water heater repair", geo: true },
  { text: "water heater leak repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Water heater repair", geo: true },
  { text: "water heater installation and repair in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Water heater", geo: true },

  // Reviews & Price
  { text: "top rated water heater company in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "Water heater", geo: true },
  { text: "which water heater companies in {place} have the best reviews", category: "Reviews & Price", intent: "review", priority: "high", service: "Water heater", geo: true },
  { text: "most trusted water heater installer in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "Water heater installation", geo: true },
  { text: "how much does water heater replacement cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "Water heater replacement", geo: true },
  { text: "tankless water heater cost in {place}", category: "Reviews & Price", intent: "price", priority: "medium", service: "Tankless water heater", geo: true },
  { text: "water heater company in {place} with financing", category: "Reviews & Price", intent: "price", priority: "low", service: "Water heater", geo: true },

  // Product / Brand
  { text: "best company to install a Rinnai tankless water heater in {place}", category: "Product / Brand", intent: "best", priority: "medium", service: "Tankless water heater", geo: true },
  { text: "heat pump water heater installation in {place}", category: "Product / Brand", intent: "best", priority: "low", service: "Heat pump water heater", geo: true },

  // Consideration
  { text: "how to choose a water heater installation company", category: "Consideration", intent: "comparison", priority: "medium", service: "Water heater installation", geo: false },
  { text: "tankless vs tank water heater", category: "Consideration", intent: "comparison", priority: "medium", service: "Tankless water heater", geo: false },
  { text: "is a tankless water heater worth it", category: "Consideration", intent: "comparison", priority: "low", service: "Tankless water heater", geo: false },
  { text: "questions to ask before replacing a water heater", category: "Consideration", intent: "comparison", priority: "medium", service: "Water heater replacement", geo: false },

  // Symptom / Problem
  { text: "no hot water who do I call in {place}", category: "Symptom / Problem", intent: "problem", priority: "high", service: "Water heater repair", geo: true },
  { text: "signs you need a new water heater", category: "Symptom / Problem", intent: "problem", priority: "high", service: "Water heater replacement", geo: false },
  { text: "water heater leaking what to do", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Water heater repair", geo: false },
];

// ── Restoration & Cleaning (water/fire/mold damage restoration, remediation, cleaning). ──
// SERVPRO, ServiceMaster, PuroClean, Rainbow, etc. Emergency-heavy, insurance-driven. Same
// 6-bucket shape as the other verticals; Core General / Repair & Maintenance / Reviews & Price
// are the scored primaries.
const RESTORATION_PROMPTS: PromptSpec[] = [
  // Core General
  { text: "best water damage restoration company in {place}", category: "Core General", intent: "best", priority: "high", service: "Water damage restoration", geo: true },
  { text: "water damage restoration near me in {place}", category: "Core General", intent: "near_me", priority: "high", service: "Water damage restoration", geo: true },
  { text: "best restoration company in {place}", category: "Core General", intent: "best", priority: "high", service: "General restoration", geo: true },
  { text: "emergency water damage restoration in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency restoration", geo: true },
  { text: "24 hour water damage restoration in {place}", category: "Core General", intent: "emergency", priority: "high", service: "Emergency restoration", geo: true },
  { text: "fire damage restoration company in {place}", category: "Core General", intent: "best", priority: "high", service: "Fire damage restoration", geo: true },
  { text: "flood cleanup company in {place}", category: "Core General", intent: "best", priority: "high", service: "Flood cleanup", geo: true },
  { text: "water damage cleanup in {place}", category: "Core General", intent: "best", priority: "medium", service: "Water damage restoration", geo: true },
  { text: "same day water extraction in {place}", category: "Core General", intent: "emergency", priority: "medium", service: "Water extraction", geo: true },
  { text: "disaster restoration company in {place}", category: "Core General", intent: "best", priority: "medium", service: "General restoration", geo: true },
  { text: "storm damage restoration in {place}", category: "Core General", intent: "best", priority: "medium", service: "Storm damage", geo: true },
  { text: "water removal service in {place}", category: "Core General", intent: "best", priority: "medium", service: "Water extraction", geo: true },
  { text: "property damage restoration contractor in {place}", category: "Core General", intent: "best", priority: "low", service: "General restoration", geo: true },
  { text: "commercial water damage restoration in {place}", category: "Core General", intent: "best", priority: "low", service: "Commercial restoration", geo: true },

  // Repair & Maintenance (specific remediation / cleaning services)
  { text: "mold remediation in {place}", category: "Repair & Maintenance", intent: "best", priority: "high", service: "Mold remediation", geo: true },
  { text: "sewage cleanup in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Sewage cleanup", geo: true },
  { text: "basement flood cleanup in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Flood cleanup", geo: true },
  { text: "smoke and soot damage cleanup in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Fire damage restoration", geo: true },
  { text: "air duct cleaning in {place}", category: "Repair & Maintenance", intent: "best", priority: "medium", service: "Air duct cleaning", geo: true },
  { text: "carpet cleaning in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Carpet cleaning", geo: true },
  { text: "biohazard cleanup in {place}", category: "Repair & Maintenance", intent: "best", priority: "low", service: "Biohazard cleanup", geo: true },

  // Reviews & Price
  { text: "top rated water damage restoration company in {place}", category: "Reviews & Price", intent: "review", priority: "high", service: "Water damage restoration", geo: true },
  { text: "which restoration company in {place} has the best reviews", category: "Reviews & Price", intent: "review", priority: "high", service: "General restoration", geo: true },
  { text: "most trusted restoration company in {place}", category: "Reviews & Price", intent: "review", priority: "medium", service: "General restoration", geo: true },
  { text: "how much does water damage restoration cost in {place}", category: "Reviews & Price", intent: "price", priority: "high", service: "Water damage restoration", geo: true },
  { text: "does insurance cover water damage restoration in {place}", category: "Reviews & Price", intent: "price", priority: "medium", service: "General restoration", geo: true },
  { text: "affordable water damage restoration in {place}", category: "Reviews & Price", intent: "price", priority: "low", service: "Water damage restoration", geo: true },

  // Consideration
  { text: "how to choose a water damage restoration company", category: "Consideration", intent: "comparison", priority: "medium", service: "General restoration", geo: false },
  { text: "what to look for in a restoration company", category: "Consideration", intent: "comparison", priority: "medium", service: "General restoration", geo: false },
  { text: "questions to ask a water damage restoration company before hiring", category: "Consideration", intent: "comparison", priority: "medium", service: "General restoration", geo: false },
  { text: "should I use my insurance company's preferred restoration vendor", category: "Consideration", intent: "comparison", priority: "low", service: "General restoration", geo: false },

  // Product / Brand (certification-driven for restoration)
  { text: "IICRC certified water damage restoration company in {place}", category: "Product / Brand", intent: "best", priority: "medium", service: "Water damage restoration", geo: true },
  { text: "certified mold remediation specialist in {place}", category: "Product / Brand", intent: "best", priority: "low", service: "Mold remediation", geo: true },

  // Symptom / Problem
  { text: "what to do after water damage in your home", category: "Symptom / Problem", intent: "problem", priority: "high", service: "Water damage restoration", geo: false },
  { text: "my basement flooded who do I call in {place}", category: "Symptom / Problem", intent: "emergency", priority: "high", service: "Flood cleanup", geo: true },
  { text: "how to tell if there is mold behind my walls", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Mold remediation", geo: false },
  { text: "ceiling water stain what should I do", category: "Symptom / Problem", intent: "problem", priority: "medium", service: "Water damage restoration", geo: false }
];

const PROMPTS_BY_VERTICAL: Record<string, PromptSpec[]> = {
  "HVAC": HVAC_PROMPTS,
  "Tree Care": TREE_CARE_PROMPTS,
  "Commercial Landscaping": COMMERCIAL_LANDSCAPING_PROMPTS,
  "Pest Control": PEST_CONTROL_PROMPTS,
  "Plumbing": PLUMBING_PROMPTS,
  "Roofing": ROOFING_PROMPTS,
  "Windows": WINDOWS_PROMPTS,
  "Foundation": FOUNDATION_PROMPTS,
  "Water Treatment": WATER_TREATMENT_PROMPTS,
  "Water Heater": WATER_HEATER_PROMPTS,
  "Restoration": RESTORATION_PROMPTS
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
