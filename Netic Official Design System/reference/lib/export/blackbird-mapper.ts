import type { JobType, Tenant, ConfigVersion, StandardConfig } from "@prisma/client";
import type {
  BlackbirdJobType,
  BlackbirdWorkflow,
  BlackbirdTrade,
  BlackbirdTenantConfig,
} from "@/types";

function mapJobType(jt: JobType): BlackbirdJobType {
  // Build names[] array: [displayName, ...alternativeKeywords]
  // This is the critical field — consumed by screen-job-type-v3.ts:78
  const names: string[] = [];
  if (jt.displayName) names.push(jt.displayName);
  if (jt.alternativeKeywords) {
    const keywords = jt.alternativeKeywords
      .split(";")
      .map((k) => k.trim())
      .filter(Boolean);
    names.push(...keywords);
  }
  // Always include stName as a fallback name
  if (!names.includes(jt.stName)) {
    names.push(jt.stName);
  }

  return {
    id: jt.stJobTypeId ?? 0,
    isLlmAssignable: jt.isBookable,
    stName: jt.stName,
    names,
    displayName: jt.displayName || undefined,
    isSchedulerEnabled: jt.isSchedulerEnabled || undefined,
    isTGLEnabled: jt.isTglEnabled || undefined,
    isCXRBookable: jt.isBookable || undefined,
    isOwedMaintenanceCampaignEligible: jt.isMembershipEligible || undefined,
    membersOnly: jt.isMemberOnly || undefined,
    noCancel: jt.noCancel || undefined,
    noReschedule: jt.noReschedule || undefined,
    shouldEscalate: jt.shouldEscalate || undefined,
    doNotAssignTechnician: jt.doNotAssignTech || undefined,
    disableGlobalQuestions: jt.disableGlobalQuestions || undefined,
    isCommercial: jt.isCommercial || undefined,
  };
}

export function buildTenantConfig(
  tenant: Tenant,
  version: ConfigVersion,
  jobTypes: JobType[],
  standardConfig: StandardConfig | null
): BlackbirdTenantConfig {
  // Separate bookable vs excluded job types
  const bookable = jobTypes.filter(
    (jt) => jt.matchStatus !== "excluded" && jt.stJobTypeId != null
  );
  const excluded = jobTypes.filter((jt) => jt.matchStatus === "excluded");

  // Group bookable by trade → workflow
  const tradeMap = new Map<string, Map<string, JobType[]>>();
  for (const jt of bookable) {
    const trade = jt.stTrade || "HVAC";
    const workflow = jt.stWorkflow || trade;
    if (!tradeMap.has(trade)) tradeMap.set(trade, new Map());
    const wfMap = tradeMap.get(trade)!;
    if (!wfMap.has(workflow)) wfMap.set(workflow, []);
    wfMap.get(workflow)!.push(jt);
  }

  // Group excluded by trade for unsupportedJobTypes
  const excludedByTrade = new Map<string, string[]>();
  for (const jt of excluded) {
    const trade = jt.stTrade || "HVAC";
    if (!excludedByTrade.has(trade)) excludedByTrade.set(trade, []);
    excludedByTrade.get(trade)!.push(jt.displayName || jt.stName);
  }

  const trades: BlackbirdTrade[] = [];
  Array.from(tradeMap.entries()).forEach(([tradeId, wfMap]) => {
    const workflows: BlackbirdWorkflow[] = [];
    Array.from(wfMap.entries()).forEach(([wfId, types]) => {
      workflows.push({
        id: wfId,
        jobTypes: types.map(mapJobType),
      });
    });
    trades.push({
      id: tradeId,
      workflows,
      unsupportedJobTypes: excludedByTrade.get(tradeId),
    });
  });

  return {
    tenant: {
      id: tenant.slug,
      name: tenant.name,
      longName: tenant.longName,
    },
    trades,
    cancelReasons: (standardConfig?.cancellationReasons as any[]) || [],
    transferRules: (standardConfig?.transferRules as any[]) || [],
    jobQuestions: (standardConfig?.jobTypeQuestions as any[]) || [],
    version: {
      number: version.version,
      confirmedAt: version.confirmedAt?.toISOString() || new Date().toISOString(),
      confirmedBy: version.confirmedBy || "system",
    },
  };
}
