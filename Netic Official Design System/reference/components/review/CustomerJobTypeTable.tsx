"use client";

import { useState, useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import { useJobTypes } from "../job-mapping/hooks/useJobTypes";
import { useJobTypeMutation } from "../job-mapping/hooks/useJobTypeMutation";
import { BooleanToggle } from "../job-mapping/BooleanToggle";
import { Tooltip } from "../job-mapping/Tooltip";
import { TradeTabs, TradeBadge } from "./TradeTabs";

interface CustomerJobTypeTableProps {
  configVersionId: string;
}

export function CustomerJobTypeTable({
  configVersionId,
}: CustomerJobTypeTableProps) {
  const { jobTypes, loading, error, setJobTypes } =
    useJobTypes(configVersionId);
  const { updateJobType } = useJobTypeMutation(setJobTypes);

  const [tradeFilter, setTradeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState("");

  // Only show matched/manual items (not excluded, not no_match)
  const activeItems = useMemo(
    () =>
      jobTypes.filter(
        (jt) => jt.matchStatus === "matched" || jt.matchStatus === "manual"
      ),
    [jobTypes]
  );

  const trades = useMemo(
    () => Array.from(new Set(activeItems.map((jt) => jt.stTrade || "Other"))),
    [activeItems]
  );

  const tradeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const jt of activeItems) {
      const t = jt.stTrade || "Other";
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [activeItems]);

  const filtered = useMemo(() => {
    return activeItems
      .filter((jt) => {
        if (tradeFilter !== "all" && (jt.stTrade || "Other") !== tradeFilter)
          return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            jt.stName.toLowerCase().includes(q) ||
            jt.displayName?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by trade, then alphabetical
        const tradeCompare = (a.stTrade || "").localeCompare(b.stTrade || "");
        if (tradeCompare !== 0) return tradeCompare;
        return (a.displayName || a.stName).localeCompare(
          b.displayName || b.stName
        );
      });
  }, [activeItems, tradeFilter, searchQuery]);

  const startEditName = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  }, []);

  const saveName = useCallback(
    (id: string) => {
      setEditingId(null);
      const jt = jobTypes.find((j) => j.id === id);
      if (jt && editValue !== (jt.displayName || jt.stName)) {
        updateJobType(id, { displayName: editValue });
      }
    },
    [editValue, jobTypes, updateJobType]
  );

  const startEditPrice = useCallback(
    (id: string, currentPrice: number | null) => {
      setEditingPriceId(id);
      setPriceValue(currentPrice != null ? String(currentPrice) : "");
    },
    []
  );

  const savePrice = useCallback(
    (id: string) => {
      setEditingPriceId(null);
      const parsed = priceValue ? parseFloat(priceValue) : null;
      const jt = jobTypes.find((j) => j.id === id);
      if (jt && parsed !== jt.price) {
        updateJobType(id, { price: parsed } as any);
      }
    },
    [priceValue, jobTypes, updateJobType]
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
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

  return (
    <div>
      {/* Trade tabs + search */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <TradeTabs
          trades={trades}
          selected={tradeFilter}
          onSelect={setTradeFilter}
          counts={tradeCounts}
        />
        {activeItems.length > 20 && (
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Job Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground w-24">
                <span className="flex items-center gap-1">
                  Price
                  <Tooltip text="The price quoted to customers for this job type" />
                </span>
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Bookable
                  <Tooltip text="When ON, the Netic AI agent can schedule this job type" />
                </span>
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Scheduler
                  <Tooltip text="When ON, customers can self-book this job online" />
                </span>
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Cancel
                  <Tooltip text="When ON, Netic handles cancellations. OFF = transferred to your team" />
                </span>
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Reschedule
                  <Tooltip text="When ON, Netic handles reschedules. OFF = transferred to your team" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((jt) => (
              <tr
                key={jt.id}
                className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                {/* Job Type — display name + ST name underneath */}
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <TradeBadge trade={jt.stTrade || "Other"} />
                    <div className="min-w-0">
                      {editingId === jt.id ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveName(jt.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="w-full rounded border border-input bg-background px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() =>
                            startEditName(
                              jt.id,
                              jt.displayName || jt.stName
                            )
                          }
                          className="text-sm font-medium text-left hover:text-primary transition-colors"
                        >
                          {jt.displayName || jt.stName}
                        </button>
                      )}
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        {jt.stName}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Price */}
                <td className="px-4 py-3">
                  {editingPriceId === jt.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={priceValue}
                      onChange={(e) => setPriceValue(e.target.value)}
                      onBlur={() => savePrice(jt.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingPriceId(null);
                      }}
                      className="w-20 rounded border border-input bg-background px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => startEditPrice(jt.id, jt.price)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {jt.price != null ? `$${jt.price.toFixed(2)}` : "—"}
                    </button>
                  )}
                </td>

                {/* Toggles */}
                <td className="text-center px-3 py-3">
                  <BooleanToggle
                    value={jt.isBookable}
                    onChange={(v) => updateJobType(jt.id, { isBookable: v })}
                  />
                </td>
                <td className="text-center px-3 py-3">
                  <BooleanToggle
                    value={jt.isSchedulerEnabled}
                    onChange={(v) =>
                      updateJobType(jt.id, { isSchedulerEnabled: v })
                    }
                    disabled={!jt.isBookable}
                  />
                </td>
                <td className="text-center px-3 py-3">
                  <BooleanToggle
                    value={!jt.noCancel}
                    onChange={(v) => updateJobType(jt.id, { noCancel: !v })}
                  />
                </td>
                <td className="text-center px-3 py-3">
                  <BooleanToggle
                    value={!jt.noReschedule}
                    onChange={(v) =>
                      updateJobType(jt.id, { noReschedule: !v })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No job types found.
          </div>
        )}
      </div>
    </div>
  );
}
