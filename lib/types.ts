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

export type QueryCategory =
  | "Core Local Service"
  | "Emergency Repair"
  | "Trust & Reviews"
  | "Price & Financing"
  | "Replacement & Tune-Up";

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
  locations: Location[];
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
  locationIds: string[];
  repeatRuns: number;
  queries: Query[];
  runs: SurfaceRun[];
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
