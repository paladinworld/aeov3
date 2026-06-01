"use client";

import { useCallback } from "react";
import type { JobTypeData } from "./useJobTypes";

export function useJobTypeMutation(
  setJobTypes: React.Dispatch<React.SetStateAction<JobTypeData[]>>
) {
  const updateJobType = useCallback(
    async (id: string, updates: Partial<JobTypeData>) => {
      // Snapshot for rollback
      let snapshot: JobTypeData[] = [];
      setJobTypes((prev) => {
        snapshot = prev;
        return prev.map((jt) => (jt.id === id ? { ...jt, ...updates } : jt));
      });

      try {
        const res = await fetch(`/api/job-types/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!res.ok) throw new Error("Failed to update");
      } catch {
        // Revert on failure
        setJobTypes(snapshot);
        console.error("Failed to update job type", id);
      }
    },
    [setJobTypes]
  );

  const bulkUpdate = useCallback(
    async (ids: string[], updates: Partial<JobTypeData>) => {
      let snapshot: JobTypeData[] = [];
      setJobTypes((prev) => {
        snapshot = prev;
        return prev.map((jt) =>
          ids.includes(jt.id) ? { ...jt, ...updates } : jt
        );
      });

      try {
        const res = await fetch("/api/job-types/bulk", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, updates }),
        });

        if (!res.ok) throw new Error("Bulk update failed");
      } catch {
        setJobTypes(snapshot);
        console.error("Bulk update failed");
      }
    },
    [setJobTypes]
  );

  return { updateJobType, bulkUpdate };
}
