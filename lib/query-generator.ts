import { Company, Query, QueryCategory, QueryIntent, Service, Surface } from "./types";
import { id } from "./store";

const webSurfaces: Surface[] = ["gemini_search", "chatgpt_search"];
const localSurfaces: Surface[] = ["gemini_maps", "chatgpt_search"];
const allSurfaces: Surface[] = ["gemini_maps", "gemini_search", "chatgpt_search"];

type QueryDraft = Omit<Query, "id">;

export function generateHvacQueries(company: Company): Query[] {
  const primary = company.locations.find((location) => location.isPrimary) ?? company.locations[0];
  const city = primary?.city || "your city";
  const state = primary?.state || "";
  const place = `${city}${state ? `, ${state}` : ""}`;
  const services = prioritizeServices(company.services);
  const drafts: QueryDraft[] = [
    ...coreLocalQueries(place, city),
    ...emergencyQueries(place, city),
    ...trustQueries(place, city),
    ...priceQueries(place, city),
    ...lifecycleQueries(place, city)
  ];

  for (const service of services.slice(0, 7)) {
    drafts.push(...serviceQueries(service, place, city));
  }

  const evaluated = dedupeDrafts(drafts)
    .filter((query) => evaluateQuery(query).pass)
    .sort((a, b) => scoreQuery(b) - scoreQuery(a));

  return balanceQueries(evaluated).map((query) => ({
    id: id("query"),
    ...query
  }));
}

function coreLocalQueries(place: string, city: string): QueryDraft[] {
  return [
    q("best HVAC company in {place}", "General HVAC", "Core Local Service", "best", "high", "head", allSurfaces, place, city),
    q("HVAC contractors near me", "General HVAC", "Core Local Service", "near_me", "high", "head", localSurfaces, place, city),
    q("AC repair {city}", "AC repair", "Core Local Service", "best", "high", "head", allSurfaces, place, city),
    q("furnace repair {city}", "Furnace repair", "Core Local Service", "best", "high", "head", allSurfaces, place, city),
    q("top rated HVAC contractors in {place}", "General HVAC", "Core Local Service", "best", "high", "mid_tail", allSurfaces, place, city),
    q("best heating and air conditioning company in {place}", "General HVAC", "Core Local Service", "best", "high", "mid_tail", allSurfaces, place, city),
    q("licensed HVAC contractor in {place}", "General HVAC", "Core Local Service", "comparison", "medium", "mid_tail", webSurfaces, place, city),
    q("heating and cooling company near me", "General HVAC", "Core Local Service", "near_me", "high", "head", localSurfaces, place, city),
    q("reliable HVAC company in {place}", "General HVAC", "Core Local Service", "best", "high", "mid_tail", allSurfaces, place, city),
    q("best AC and heating company in {place}", "General HVAC", "Core Local Service", "best", "high", "mid_tail", webSurfaces, place, city),
    q("who is the best HVAC company to call in {place}", "General HVAC", "Core Local Service", "comparison", "high", "long_tail", webSurfaces, place, city)
  ];
}

function emergencyQueries(place: string, city: string): QueryDraft[] {
  return [
    q("emergency HVAC repair {city}", "Emergency HVAC", "Emergency Repair", "emergency", "high", "head", allSurfaces, place, city),
    q("24 hour AC repair near me", "Emergency HVAC", "Emergency Repair", "emergency", "high", "head", localSurfaces, place, city),
    q("same day AC repair in {place}", "Emergency HVAC", "Emergency Repair", "emergency", "high", "mid_tail", allSurfaces, place, city),
    q("who should I call if my AC stops working in {city}", "Emergency HVAC", "Emergency Repair", "emergency", "high", "long_tail", localSurfaces, place, city),
    q("best emergency HVAC company in {place} for no heat at night", "Emergency HVAC", "Emergency Repair", "emergency", "medium", "long_tail", allSurfaces, place, city)
  ];
}

function trustQueries(place: string, city: string): QueryDraft[] {
  return [
    q("top rated HVAC company {city}", "General HVAC", "Trust & Reviews", "review", "high", "head", allSurfaces, place, city),
    q("HVAC company reviews {city}", "General HVAC", "Trust & Reviews", "review", "medium", "head", webSurfaces, place, city),
    q("most trusted HVAC company in {place}", "General HVAC", "Trust & Reviews", "review", "high", "mid_tail", webSurfaces, place, city),
    q("which HVAC companies in {place} have the best reviews", "General HVAC", "Trust & Reviews", "review", "high", "mid_tail", webSurfaces, place, city),
    q("HVAC contractor in {place} known for honest diagnostics", "General HVAC", "Trust & Reviews", "review", "medium", "long_tail", webSurfaces, place, city)
  ];
}

function priceQueries(place: string, city: string): QueryDraft[] {
  return [
    q("affordable HVAC repair {city}", "General HVAC", "Price & Financing", "price", "medium", "head", webSurfaces, place, city),
    q("HVAC repair cost {city}", "General HVAC", "Price & Financing", "price", "medium", "head", webSurfaces, place, city),
    q("HVAC company in {place} with financing", "General HVAC", "Price & Financing", "price", "medium", "mid_tail", webSurfaces, place, city),
    q("best HVAC company in {place} for a second opinion before replacing my system", "General HVAC", "Price & Financing", "comparison", "high", "long_tail", allSurfaces, place, city),
    q("who offers fair HVAC repair pricing in {city} without surprise fees", "General HVAC", "Price & Financing", "price", "medium", "long_tail", webSurfaces, place, city)
  ];
}

function lifecycleQueries(place: string, city: string): QueryDraft[] {
  return [
    q("AC tune up near me", "Maintenance/tune-up", "Replacement & Tune-Up", "best", "medium", "head", localSurfaces, place, city),
    q("best HVAC maintenance plan in {place}", "Maintenance/tune-up", "Replacement & Tune-Up", "comparison", "medium", "mid_tail", webSurfaces, place, city),
    q("HVAC company for older homes in {place}", "General HVAC", "Core Local Service", "problem", "medium", "mid_tail", webSurfaces, place, city),
    q("HVAC company for uneven heating and cooling in {city}", "General HVAC", "Core Local Service", "problem", "medium", "mid_tail", webSurfaces, place, city),
    q("best HVAC company for a two-story house with uneven temperatures in {place}", "General HVAC", "Core Local Service", "problem", "medium", "long_tail", webSurfaces, place, city),
    q("HVAC contractor in {place} for improving airflow in an older home", "General HVAC", "Core Local Service", "problem", "medium", "long_tail", allSurfaces, place, city)
  ];
}

function serviceQueries(service: Service, place: string, city: string): QueryDraft[] {
  switch (service) {
    case "AC repair":
      return [
        q("AC repair near me", service, "Core Local Service", "near_me", "high", "head", localSurfaces, place, city),
        q("best AC repair company in {place}", service, "Core Local Service", "best", "high", "mid_tail", allSurfaces, place, city),
        q("AC blowing warm air repair {city}", service, "Core Local Service", "problem", "high", "mid_tail", webSurfaces, place, city),
        q("who can fix an AC that keeps short cycling in {city}", service, "Core Local Service", "problem", "medium", "long_tail", webSurfaces, place, city),
        q("my AC is running but the house is not getting cold in {city}", service, "Core Local Service", "problem", "high", "long_tail", webSurfaces, place, city)
      ];
    case "Furnace repair":
      return [
        q("furnace repair near me", service, "Core Local Service", "near_me", "high", "head", localSurfaces, place, city),
        q("best furnace repair company in {place}", service, "Core Local Service", "best", "high", "mid_tail", allSurfaces, place, city),
        q("furnace blowing cold air repair {city}", service, "Core Local Service", "problem", "high", "mid_tail", webSurfaces, place, city),
        q("my furnace turns on then shuts off after a few minutes in {city}", service, "Core Local Service", "problem", "high", "long_tail", webSurfaces, place, city),
        q("who fixes furnace ignition problems in {place}", service, "Core Local Service", "problem", "medium", "mid_tail", webSurfaces, place, city)
      ];
    case "Heat pump repair":
      return [
        q("heat pump repair {city}", service, "Core Local Service", "best", "medium", "head", webSurfaces, place, city),
        q("best heat pump repair company in {place}", service, "Core Local Service", "best", "medium", "mid_tail", webSurfaces, place, city),
        q("heat pump stuck in auxiliary heat repair {city}", service, "Core Local Service", "problem", "medium", "mid_tail", webSurfaces, place, city),
        q("who repairs heat pumps that are icing up in {place}", service, "Core Local Service", "problem", "medium", "long_tail", webSurfaces, place, city)
      ];
    case "AC installation":
      return [
        q("AC installation {city}", service, "Replacement & Tune-Up", "best", "medium", "head", webSurfaces, place, city),
        q("best AC replacement company in {place}", service, "Replacement & Tune-Up", "comparison", "medium", "mid_tail", webSurfaces, place, city),
        q("who installs high efficiency air conditioners in {city}", service, "Replacement & Tune-Up", "comparison", "medium", "long_tail", webSurfaces, place, city)
      ];
    case "Furnace installation":
      return [
        q("furnace installation {city}", service, "Replacement & Tune-Up", "best", "medium", "head", webSurfaces, place, city),
        q("best furnace replacement company in {place}", service, "Replacement & Tune-Up", "comparison", "medium", "mid_tail", webSurfaces, place, city),
        q("who installs high efficiency furnaces in {city}", service, "Replacement & Tune-Up", "comparison", "medium", "long_tail", webSurfaces, place, city)
      ];
    case "Ductless mini split":
      return [
        q("mini split installer {city}", service, "Replacement & Tune-Up", "best", "medium", "head", webSurfaces, place, city),
        q("best ductless mini split installer in {place}", service, "Replacement & Tune-Up", "comparison", "medium", "mid_tail", webSurfaces, place, city),
        q("mini split installer for garage or ADU in {city}", service, "Replacement & Tune-Up", "comparison", "low", "long_tail", webSurfaces, place, city)
      ];
    case "Indoor air quality":
      return [
        q("indoor air quality HVAC company {city}", service, "Core Local Service", "problem", "medium", "mid_tail", webSurfaces, place, city),
        q("HVAC company for allergies and air filtration in {place}", service, "Core Local Service", "problem", "medium", "long_tail", webSurfaces, place, city)
      ];
    case "Duct cleaning":
      return [
        q("air duct cleaning {city}", service, "Replacement & Tune-Up", "best", "medium", "head", webSurfaces, place, city),
        q("best duct cleaning company in {place}", service, "Replacement & Tune-Up", "comparison", "medium", "mid_tail", webSurfaces, place, city),
        q("is air duct cleaning worth it and who should I use in {city}", service, "Replacement & Tune-Up", "comparison", "low", "long_tail", webSurfaces, place, city)
      ];
    case "Maintenance/tune-up":
      return [
        q("AC tune up {city}", service, "Replacement & Tune-Up", "best", "medium", "head", webSurfaces, place, city),
        q("HVAC maintenance plan {city}", service, "Replacement & Tune-Up", "comparison", "medium", "mid_tail", webSurfaces, place, city),
        q("best HVAC company in {place} for annual maintenance and priority service", service, "Replacement & Tune-Up", "comparison", "medium", "long_tail", webSurfaces, place, city)
      ];
    case "Emergency HVAC":
      return [];
  }
}

function q(
  template: string,
  service: Service | "General HVAC",
  category: QueryCategory,
  intent: QueryIntent,
  priority: "high" | "medium" | "low",
  queryDepth: "head" | "mid_tail" | "long_tail",
  surfaces: Surface[],
  place: string,
  city: string
): QueryDraft {
  return {
    text: template.replaceAll("{place}", place).replaceAll("{city}", city),
    service,
    category,
    intent,
    priority,
    queryDepth,
    longTail: queryDepth === "long_tail",
    surfaces
  };
}

function evaluateQuery(query: QueryDraft): { pass: boolean; reason?: string } {
  const text = query.text.trim();
  const lower = text.toLowerCase();
  const weirdPhrases = [
    "just moved",
    "worth calling first and why",
    "family with kids",
    "avoid, and which",
    "pros and cons of hiring"
  ];

  if (text.includes("{}") || /\s{2,}/.test(text)) {
    return { pass: false, reason: "Malformed placeholder or spacing" };
  }

  if (weirdPhrases.some((phrase) => lower.includes(phrase))) {
    return { pass: false, reason: "Contrived phrasing" };
  }

  if (query.queryDepth === "head" && text.split(/\s+/).length > 7) {
    return { pass: false, reason: "Head query too long" };
  }

  if (query.queryDepth === "long_tail" && text.split(/\s+/).length < 8) {
    return { pass: false, reason: "Long-tail query too short" };
  }

  if (!/(hvac|ac|air conditioner|furnace|heat pump|mini split|duct|air quality|heating|cooling)/i.test(text)) {
    return { pass: false, reason: "Missing HVAC context" };
  }

  return { pass: true };
}

function scoreQuery(query: QueryDraft) {
  const priorityScore = query.priority === "high" ? 3 : query.priority === "medium" ? 2 : 1;
  const depthScore = query.queryDepth === "head" ? 3 : query.queryDepth === "mid_tail" ? 2 : 1;
  const surfaceScore = query.surfaces.includes("gemini_maps") ? 1 : 0;
  return priorityScore * 10 + depthScore + surfaceScore;
}

function balanceQueries(queries: QueryDraft[]): QueryDraft[] {
  const targets = { head: 11, mid_tail: 14, long_tail: 15 };
  const selected: QueryDraft[] = [];
  const used = new Set<QueryDraft>();

  for (const depth of ["head", "mid_tail", "long_tail"] as const) {
    for (const query of queries.filter((query) => query.queryDepth === depth).slice(0, targets[depth])) {
      selected.push(query);
      used.add(query);
    }
  }

  // Top up to 40 from the next highest-scoring queries if a depth bucket fell short.
  if (selected.length < 40) {
    for (const query of queries) {
      if (selected.length >= 40) break;
      if (!used.has(query)) {
        selected.push(query);
        used.add(query);
      }
    }
  }

  return selected.slice(0, 40);
}

function dedupeDrafts(queries: QueryDraft[]) {
  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = query.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function prioritizeServices(services: Service[]) {
  const priority: Service[] = [
    "AC repair",
    "Emergency HVAC",
    "Furnace repair",
    "AC installation",
    "Furnace installation",
    "Heat pump repair",
    "Ductless mini split",
    "Indoor air quality",
    "Maintenance/tune-up",
    "Duct cleaning"
  ];

  return [
    ...priority.filter((service) => services.includes(service)),
    ...services.filter((service) => !priority.includes(service))
  ];
}
