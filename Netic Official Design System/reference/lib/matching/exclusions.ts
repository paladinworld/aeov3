/**
 * Auto-exclusion rules for ServiceTitan job types.
 * Ported from job_type_pipeline/pipeline/matching/exclusions.py
 */

const EXCLUSION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\binstall\b/i, reason: "Installation (handled separately)" },
  { pattern: /\bconstruction\b/i, reason: "Construction" },
  { pattern: /\bcommercial\b/i, reason: "Commercial" },
  { pattern: /\bnew construction\b/i, reason: "New construction" },
  { pattern: /\bretrofit\b/i, reason: "Retrofit/Installation" },
  { pattern: /\bproject\b/i, reason: "Project work" },
  { pattern: /\bsales\b/i, reason: "Sales" },
  { pattern: /\binspection\b/i, reason: "Inspection" },
  { pattern: /\bpermit\b/i, reason: "Permit" },
  { pattern: /\bcode compliance\b/i, reason: "Code compliance" },
];

// Exceptions: patterns that should NOT be excluded even if they match above
const EXCEPTION_PATTERNS: RegExp[] = [
  /\binstall warranty\b/i,
  /\binstall call back\b/i,
  /\binstallation assessment\b/i,
];

export function getExclusionReason(jobTypeName: string): string | null {
  // Check exceptions first
  for (const exception of EXCEPTION_PATTERNS) {
    if (exception.test(jobTypeName)) {
      return null;
    }
  }

  for (const { pattern, reason } of EXCLUSION_PATTERNS) {
    if (pattern.test(jobTypeName)) {
      return reason;
    }
  }

  return null;
}

/**
 * Auto-detect trade from ServiceTitan job type name.
 */
export function detectTrade(
  jobTypeName: string
): "HVAC" | "PLUMBING" | "ELECTRICAL" | null {
  const name = jobTypeName.toUpperCase();
  if (name.startsWith("HVAC") || name.includes("HEATING") || name.includes("COOLING") || name.includes("FURNACE") || name.includes("A/C")) {
    return "HVAC";
  }
  if (name.startsWith("PLUMB") || name.includes("PLUMBING") || name.includes("DRAIN") || name.includes("SEWER") || name.includes("WATER HEATER")) {
    return "PLUMBING";
  }
  if (name.startsWith("ELEC") || name.includes("ELECTRICAL") || name.includes("WIRING") || name.includes("PANEL") || name.includes("GENERATOR")) {
    return "ELECTRICAL";
  }
  return null;
}

/**
 * Auto-detect workflow from ServiceTitan job type name.
 */
export function detectWorkflow(jobTypeName: string, trade: string | null): string | null {
  const name = jobTypeName.toLowerCase();

  if (name.includes("estimate") || name.includes("replacement")) {
    if (trade === "HVAC") return "ESTIMATION_REPLACEMENT";
    if (trade === "PLUMBING") return "PLUMBING_ESTIMATION";
    if (trade === "ELECTRICAL") return "ELECTRIC_ESTIMATION";
    return null;
  }

  if (name.includes("maintenance") || name.includes("tune-up") || name.includes("tune up") || name.includes("club")) {
    if (trade === "HVAC") return "HVAC-TUNE-UP";
    if (trade === "PLUMBING") return "PLUMBING_MAINTENANCE";
    if (trade === "ELECTRICAL") return "ELECTRIC_MAINTENANCE";
    return null;
  }

  // Default to service workflow
  if (trade === "HVAC") return "HVAC";
  if (trade === "PLUMBING") return "PLUMBING";
  if (trade === "ELECTRICAL") return "ELECTRIC";
  return null;
}
