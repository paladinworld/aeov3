"use client";

import { useMemo } from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { useJobTypes } from "../job-mapping/hooks/useJobTypes";
import { useJobTypeMutation } from "../job-mapping/hooks/useJobTypeMutation";
import { TradeBadge } from "./TradeTabs";

interface CustomerAttentionCardsProps {
  configVersionId: string;
}

export function CustomerAttentionCards({
  configVersionId,
}: CustomerAttentionCardsProps) {
  const { jobTypes, loading, error, setJobTypes } =
    useJobTypes(configVersionId);
  const { updateJobType } = useJobTypeMutation(setJobTypes);

  const attentionItems = useMemo(
    () =>
      jobTypes.filter(
        (jt) =>
          jt.matchStatus === "no_match" ||
          (jt.matchStatus === "matched" && jt.matchConfidence === "low")
      ),
    [jobTypes]
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
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

  if (attentionItems.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
        <h4 className="text-lg font-semibold mb-1">All items resolved!</h4>
        <p className="text-sm text-muted-foreground">
          No items need your attention. Continue to the next step.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <p className="text-sm">
          <strong>{attentionItems.length}</strong> item
          {attentionItems.length !== 1 ? "s" : ""} need
          {attentionItems.length === 1 ? "s" : ""} your input
        </p>
      </div>

      <div className="space-y-3">
        {attentionItems.map((jt) => (
          <div
            key={jt.id}
            className="border rounded-lg p-5 bg-background hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TradeBadge trade={jt.stTrade || "Other"} />
                  <h4 className="text-base font-semibold">{jt.stName}</h4>
                </div>

                {jt.matchStatus === "no_match" ? (
                  <p className="text-sm text-muted-foreground">
                    We couldn&apos;t find a matching job type in our system.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Low confidence match to{" "}
                    <span className="font-medium text-foreground">
                      &quot;{jt.matchedModelName}&quot;
                    </span>
                  </p>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                {jt.matchStatus === "matched" &&
                  jt.matchConfidence === "low" && (
                    <button
                      onClick={() =>
                        updateJobType(jt.id, {
                          matchConfidence: "high",
                        } as any)
                      }
                      className="rounded-md px-4 py-2 text-sm font-medium bg-success/10 text-success hover:bg-success/20 transition-colors"
                    >
                      Accept Match
                    </button>
                  )}
                <button
                  onClick={() =>
                    updateJobType(jt.id, {
                      matchStatus: "excluded",
                      isBookable: false,
                    } as any)
                  }
                  className="rounded-md px-4 py-2 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted-hover transition-colors"
                >
                  Exclude This
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
