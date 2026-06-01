"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

export interface JobTypeData {
  id: string;
  stJobTypeId: number | null;
  stName: string;
  stBusinessUnitIds: string | null;
  stTrade: string | null;
  stWorkflow: string | null;
  matchedModelName: string | null;
  matchConfidence: string | null;
  matchStatus: string;
  exclusionReason: string | null;
  displayName: string | null;
  alternativeKeywords: string | null;
  customerNotes: string | null;
  customerEdited: boolean;
  isBookable: boolean;
  isSchedulerEnabled: boolean;
  isTglEnabled: boolean;
  isMembershipEligible: boolean;
  isCommercial: boolean;
  isMemberOnly: boolean;
  noCancel: boolean;
  noReschedule: boolean;
  shouldEscalate: boolean;
  doNotAssignTech: boolean;
  disableGlobalQuestions: boolean;
  price: number | null;
  sortOrder: number;
}

export interface GroupedJobTypes {
  trade: string;
  workflows: {
    workflow: string;
    jobTypes: JobTypeData[];
  }[];
}

export function useJobTypes(configVersionId: string) {
  const [jobTypes, setJobTypes] = useState<JobTypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/job-types?versionId=${configVersionId}`);
      if (!res.ok) throw new Error("Failed to fetch job types");
      const data = await res.json();
      setJobTypes(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [configVersionId]);

  useEffect(() => {
    fetchJobTypes();
  }, [fetchJobTypes]);

  // Group by trade → workflow (memoized)
  const grouped = useMemo(() => {
    const result: GroupedJobTypes[] = [];
    const tradeMap = new Map<string, Map<string, JobTypeData[]>>();

    for (const jt of jobTypes) {
      const trade = jt.stTrade || "Unknown";
      const workflow = jt.stWorkflow || "Unknown";

      if (!tradeMap.has(trade)) tradeMap.set(trade, new Map());
      const workflowMap = tradeMap.get(trade)!;
      if (!workflowMap.has(workflow)) workflowMap.set(workflow, []);
      workflowMap.get(workflow)!.push(jt);
    }

    Array.from(tradeMap.entries()).forEach(([trade, workflowMap]) => {
      const workflows: GroupedJobTypes["workflows"] = [];
      Array.from(workflowMap.entries()).forEach(([workflow, types]) => {
        workflows.push({ workflow, jobTypes: types });
      });
      result.push({ trade, workflows });
    });

    return result;
  }, [jobTypes]);

  // Items needing attention (memoized)
  const needsAttention = useMemo(
    () =>
      jobTypes.filter(
        (jt) =>
          jt.matchStatus === "no_match" ||
          (jt.matchStatus === "matched" && jt.matchConfidence === "low")
      ),
    [jobTypes]
  );

  const stats = useMemo(
    () => ({
      total: jobTypes.length,
      matched: jobTypes.filter((jt) => jt.matchStatus === "matched").length,
      excluded: jobTypes.filter((jt) => jt.matchStatus === "excluded").length,
      noMatch: jobTypes.filter((jt) => jt.matchStatus === "no_match").length,
      pending: jobTypes.filter((jt) => jt.matchStatus === "pending").length,
      manual: jobTypes.filter((jt) => jt.matchStatus === "manual").length,
    }),
    [jobTypes]
  );

  return {
    jobTypes,
    grouped,
    needsAttention,
    stats,
    loading,
    error,
    refetch: fetchJobTypes,
    setJobTypes,
  };
}
