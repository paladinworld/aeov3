"use client";

import { useMemo } from "react";
import { useJobTypes } from "../job-mapping/hooks/useJobTypes";
import { TradeBadge } from "./TradeTabs";
import { Mail } from "lucide-react";

interface CustomerExcludedListProps {
  configVersionId: string;
}

const REASON_LABELS: Record<string, string> = {
  "Not handled by Netic agent": "Outside Netic scope",
  "commercial": "Commercial",
  "Commercial": "Commercial",
  "Installation (handled separately)": "Installation",
  "Construction": "Construction",
  "New construction": "New construction",
  "Retrofit/Installation": "Installation",
  "Project work": "Project work",
  "Sales": "Sales",
  "Inspection": "Inspection",
  "Customer excluded": "Excluded by you",
};

export function CustomerExcludedList({
  configVersionId,
}: CustomerExcludedListProps) {
  const { jobTypes, loading, error } = useJobTypes(configVersionId);

  const excludedItems = useMemo(
    () => jobTypes.filter((jt) => jt.matchStatus === "excluded"),
    [jobTypes]
  );

  // Group by trade
  const grouped = useMemo(() => {
    const map = new Map<string, typeof excludedItems>();
    for (const jt of excludedItems) {
      const trade = jt.stTrade || "Other";
      if (!map.has(trade)) map.set(trade, []);
      map.get(trade)!.push(jt);
    }
    return Array.from(map.entries());
  }, [excludedItems]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Failed to load job types.
      </div>
    );
  }

  if (excludedItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No excluded job types.
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        These <strong>{excludedItems.length}</strong> job types are not handled
        by Netic. They were identified as outside the AI agent&apos;s scope.
      </p>

      <div className="border rounded-lg overflow-hidden">
        {grouped.map(([trade, items]) => (
          <div key={trade}>
            {/* Trade header */}
            <div className="px-4 py-2 bg-muted/30 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {trade}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                ({items.length})
              </span>
            </div>

            {/* Items */}
            {items.map((jt, i) => (
              <div
                key={jt.id}
                className={`flex items-center justify-between px-4 py-2.5 ${
                  i < items.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-foreground/70">
                    {jt.stName}
                  </span>
                </div>
                <span className="text-xs rounded-full px-2.5 py-0.5 bg-muted text-muted-foreground">
                  {REASON_LABELS[jt.exclusionReason || ""] ||
                    jt.exclusionReason ||
                    "Excluded"}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-6 border rounded-lg p-4 bg-information-50 flex items-start gap-3">
        <Mail className="h-5 w-5 text-information mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">
            Think something here should be included?
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Contact your Netic team and we&apos;ll update the configuration for
            you.
          </p>
        </div>
      </div>
    </div>
  );
}
