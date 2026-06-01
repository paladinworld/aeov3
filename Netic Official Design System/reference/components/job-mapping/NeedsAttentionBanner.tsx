"use client";

import { AlertTriangle } from "lucide-react";
import type { JobTypeData } from "./hooks/useJobTypes";

interface NeedsAttentionBannerProps {
  items: JobTypeData[];
  onUpdate: (id: string, updates: Partial<JobTypeData>) => void;
}

export function NeedsAttentionBanner({
  items,
  onUpdate,
}: NeedsAttentionBannerProps) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6 border border-warning/30 rounded-lg bg-warning/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <h3 className="font-medium text-sm">
          Needs Your Attention ({items.length} item{items.length > 1 ? "s" : ""})
        </h3>
      </div>
      <div className="space-y-3">
        {items.map((jt) => (
          <div
            key={jt.id}
            className="flex items-center justify-between bg-background rounded-md border p-3"
          >
            <div>
              <p className="text-sm font-medium">{jt.stName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {jt.matchStatus === "no_match"
                  ? "No matching model tenant job type found"
                  : `Low confidence match to "${jt.matchedModelName}"`}
              </p>
            </div>
            <div className="flex gap-2">
              {jt.matchStatus === "no_match" ? (
                <>
                  <button
                    onClick={() =>
                      onUpdate(jt.id, {
                        matchStatus: "excluded",
                        exclusionReason: "Customer excluded",
                      } as any)
                    }
                    className="text-xs rounded px-3 py-1.5 bg-muted text-muted-foreground hover:bg-muted-hover transition-colors"
                  >
                    Don&apos;t Handle
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() =>
                      onUpdate(jt.id, { matchConfidence: "high" } as any)
                    }
                    className="text-xs rounded px-3 py-1.5 bg-success/10 text-success hover:bg-success/20 transition-colors"
                  >
                    Accept Match
                  </button>
                  <button
                    onClick={() =>
                      onUpdate(jt.id, {
                        matchStatus: "excluded",
                        exclusionReason: "Customer excluded",
                      } as any)
                    }
                    className="text-xs rounded px-3 py-1.5 bg-muted text-muted-foreground hover:bg-muted-hover transition-colors"
                  >
                    Don&apos;t Handle
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
