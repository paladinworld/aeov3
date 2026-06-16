export type Service =
  | "AC repair"
  | "AC installation"
  | "Furnace repair"
  | "Furnace installation"
  | "Heat pump repair"
  | "Ductless mini split"
  | "Indoor air quality"
  | "Duct cleaning"
  | "Emergency HVAC"
  | "Maintenance/tune-up";

export type Surface =
  | "gemini_maps"
  | "gemini_search"
  | "chatgpt_search"
  | "google_ai_overview";

// The locked V3 HVAC prompt buckets (the CSV "Bucket" column). This is the
// prompt-type taxonomy the dashboard groups by. Add a vertical's buckets here.
export type QueryCategory =
  | "Core General"
  | "Repair & Maintenance"
  | "Reviews & Price"
  | "Product / Brand"
  | "Consideration"
  | "Symptom / Problem";

export type QueryIntent =
  | "near_me"
  | "best"
  | "emergency"
  | "review"
  | "comparison"
  | "problem"
  | "price";

export type Location = {
  id: string;
  label: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  isPrimary: boolean;
};

export type Company = {
  id: string;
  name: string;
  website: string;
  googleBusinessProfileUrl?: string;
  services: Service[];
  competitors: string[];
  // Service areas the report is run against (the markets where customers search).
  // The dropdown switches between these; each area is its own report.
  locations: Location[];
  // Where the business is physically based (GBP / HQ). Display-only reference —
  // NOT what the report is scored on. May differ from the target service area.
  headquarters?: Location;
  createdAt: string;
};

export type Query = {
  id: string;
  text: string;
  service: Service | "General HVAC";
  category: QueryCategory;
  intent: QueryIntent;
  priority: "high" | "medium" | "low";
  queryDepth: "head" | "mid_tail" | "long_tail";
  longTail: boolean;
  surfaces: Surface[];
};

export type Citation = {
  title: string;
  url: string;
  domain: string;
};

export type MissingRecommendationInsight = {
  question: string;
  answer: string;
  createdAt: string;
};

export type CompanyMention = {
  companyName: string;
  rank: number;
  sentiment: "positive" | "neutral" | "negative";
  summary: string;
  citations: Citation[];
  isTarget: boolean;
};

export type SurfaceRun = {
  id: string;
  queryId: string;
  queryText: string;
  locationId: string;
  locationLabel: string;
  surface: Surface;
  runNumber: number;
  rawAnswer: string;
  mentions: CompanyMention[];
  // The run's distinct cited sources, stored ONCE here (new runs). Older runs left
  // this undefined and duplicated the same list on every mention — read both via
  // runCitations() in lib/citations.ts.
  citations?: Citation[];
  missingInsight?: MissingRecommendationInsight;
  createdAt: string;
};

export type TargetedSentimentRun = {
  id: string;
  surface: Extract<Surface, "gemini_maps" | "chatgpt_search">;
  prompt: string;
  rawAnswer: string;
  sentiment: "positive" | "neutral" | "negative";
  summary: string;
  createdAt: string;
};

export type Report = {
  id: string;
  companyId: string;
  vertical?: string; // service vertical (HVAC | Plumbing | Electrical…); absent = "HVAC". Toggled in the sidebar.
  locationIds: string[];
  repeatRuns: number;
  queries: Query[];
  runs: SurfaceRun[];
  runCount?: number; // set on the lightweight GET /api/reports list (runs are stripped there)
  domainTypes?: Record<string, string>; // citation domain -> kind (platform|contractor|manufacturer|other), classified at audit time
  targetedSentiment?: TargetedSentimentRun[];
  status: "draft" | "running" | "complete" | "failed";
  createdAt: string;
  completedAt?: string;
};

export type AuditJobStatus = "queued" | "running" | "complete" | "failed" | "canceled";

export type AuditRun = {
  id: string;
  reportId: string;
  companyId: string;
  status: AuditJobStatus;
  repeatRuns: number;
  concurrency: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  options: Record<string, unknown>;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

export type AuditCheckJob = {
  id: string;
  auditRunId: string;
  reportId: string;
  companyId: string;
  locationId: string;
  queryId: string;
  queryText: string;
  surface: Surface;
  runNumber: number;
  status: AuditJobStatus;
  attempts: number;
  maxAttempts: number;
  result?: SurfaceRun;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

export type Database = {
  companies: Company[];
  reports: Report[];
};

export type VisibilitySummary = {
  totalRuns: number;
  targetMentions: number;
  mentionRate: number;
  topThreeRate: number;
  averageRank: number | null;
  competitorCounts: Array<{ name: string; count: number }>;
  citationCounts: Array<{ name: string; count: number }>;
  categoryCounts: Array<{ name: string; count: number }>;
  longTailCount: number;
  surfaceScores: Array<{
    surface: Surface;
    runs: number;
    mentionRate: number;
    averageRank: number | null;
  }>;
};
