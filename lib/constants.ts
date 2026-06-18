import { Service, Surface } from "./types";

export const HVAC_SERVICES: Service[] = [
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
];

export const SURFACE_LABELS: Record<Surface, string> = {
  gemini_maps: "Gemini",
  gemini_search: "Gemini",
  chatgpt_search: "ChatGPT Search",
  google_ai_overview: "Google AI Mode"
};
