export type TenantStatus = "draft" | "matching" | "review" | "confirmed" | "live";

export type VersionStatus = "draft" | "review" | "confirmed" | "live" | "archived";

export type MatchStatus = "pending" | "matched" | "no_match" | "excluded" | "manual";

export type MatchConfidence = "high" | "medium" | "low";

export type Trade = "HVAC" | "PLUMBING" | "ELECTRICAL";

// Blackbird-compatible output types
export interface BlackbirdJobType {
  id: number;
  isLlmAssignable: boolean;
  stName: string;
  names: string[];
  displayName?: string;
  isSchedulerEnabled?: boolean;
  isTGLEnabled?: boolean;
  isCXRBookable?: boolean;
  isOwedMaintenanceCampaignEligible?: boolean;
  membersOnly?: boolean;
  noCancel?: boolean;
  noReschedule?: boolean;
  shouldEscalate?: boolean;
  doNotAssignTechnician?: boolean;
  disableGlobalQuestions?: boolean;
  isCommercial?: boolean;
}

export interface BlackbirdWorkflow {
  id: string;
  jobTypes: BlackbirdJobType[];
}

export interface BlackbirdTrade {
  id: string;
  workflows: BlackbirdWorkflow[];
  unsupportedJobTypes?: string[];
}

export interface BlackbirdTenantConfig {
  tenant: {
    id: string;
    name: string;
    longName: string;
  };
  trades: BlackbirdTrade[];
  cancelReasons: Array<{
    reason: string;
    isLlmAssignable: boolean;
    noReschedule?: boolean;
  }>;
  transferRules: Array<{
    rule: string;
    description: string;
  }>;
  jobQuestions: Array<{
    trade: string;
    workflow: string;
    questions: string[];
  }>;
  version: {
    number: number;
    confirmedAt: string;
    confirmedBy: string;
  };
}

// Customer-facing column labels (for display)
export const CUSTOMER_COLUMNS = {
  isBookable: {
    label: "Netic Books This",
    tooltip:
      "When enabled, the Netic AI agent can schedule this type of job for your customers.",
  },
  isSchedulerEnabled: {
    label: "Online Scheduler",
    tooltip:
      "When enabled, customers can book this job type through your online self-serve scheduling page.",
  },
  noCancel: {
    label: "Allow Cancel",
    tooltip:
      "When enabled, Netic can process cancellation requests for this job type. When disabled, cancel requests are transferred to your team.",
    inverted: true,
  },
  noReschedule: {
    label: "Allow Reschedule",
    tooltip:
      "When enabled, Netic can process reschedule requests for this job type. When disabled, reschedule requests are transferred to your team.",
    inverted: true,
  },
  isMembershipEligible: {
    label: "Membership Booking",
    tooltip:
      "Enable for job types associated with membership maintenance visits (e.g., annual tune-ups).",
  },
} as const;
