"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { useJobTypes, type JobTypeData } from "./hooks/useJobTypes";
import { useJobTypeMutation } from "./hooks/useJobTypeMutation";
import { JobTypeRow } from "./JobTypeRow";
import { NeedsAttentionBanner } from "./NeedsAttentionBanner";
import { BulkEditBar } from "./BulkEditBar";
import { Checkbox } from "./Checkbox";
import { Tooltip } from "./Tooltip";

interface JobMappingEditorProps {
  configVersionId: string;
  tenantSlug: string;
  readOnly?: boolean;
  customerMode?: boolean;
}

const WORKFLOW_DISPLAY_NAMES: Record<string, string> = {
  HVAC: "Service",
  "HVAC-TUNE-UP": "Maintenance",
  ESTIMATION_REPLACEMENT: "Estimate",
  PLUMBING: "Service",
  PLUMBING_ESTIMATION: "Estimate",
  PLUMBING_MAINTENANCE: "Maintenance",
  ELECTRIC: "Service",
  ELECTRIC_ESTIMATION: "Estimate",
  ELECTRIC_MAINTENANCE: "Maintenance",
  Unknown: "Other",
};

const STATUS_FILTERS = [
  "all",
  "matched",
  "excluded",
  "no_match",
  "pending",
  "manual",
];

const COLUMN_TOOLTIPS = {
  stName: "The original job type name from ServiceTitan",
  displayName: "The name your customers will hear when the AI agent speaks",
  price: "The price quoted to customers for this job type",
  bookable:
    "When ON, the Netic AI agent can schedule this job type for your customers",
  scheduler:
    "When ON, customers can book this job type through your online scheduling page",
  allowCancel:
    "When ON, Netic handles cancellation requests. When OFF, they're transferred to your team",
  allowReschedule:
    "When ON, Netic handles reschedule requests. When OFF, they're transferred to your team",
};

export function JobMappingEditor({
  configVersionId,
  tenantSlug,
  readOnly = false,
  customerMode = false,
}: JobMappingEditorProps) {
  const {
    jobTypes,
    grouped,
    needsAttention,
    stats,
    loading,
    error,
    setJobTypes,
  } = useJobTypes(configVersionId);
  const { updateJobType, bulkUpdate } = useJobTypeMutation(setJobTypes);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [businessUnitFilter, setBusinessUnitFilter] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["HVAC", "PLUMBING", "ELECTRICAL"])
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Extract unique business units
  const businessUnits = useMemo(() => {
    const buSet = new Set<string>();
    for (const jt of jobTypes) {
      if (jt.stBusinessUnitIds) {
        jt.stBusinessUnitIds.split(",").forEach((bu) => {
          const trimmed = bu.trim();
          if (trimmed) buSet.add(trimmed);
        });
      }
    }
    return Array.from(buSet).sort();
  }, [jobTypes]);

  // Filter job types
  const filteredGrouped = useMemo(() => {
    return grouped
      .filter((g) => tradeFilter === "all" || g.trade === tradeFilter)
      .map((group) => ({
        ...group,
        workflows: group.workflows.map((wf) => ({
          ...wf,
          jobTypes: wf.jobTypes.filter((jt) => {
            if (statusFilter !== "all" && jt.matchStatus !== statusFilter)
              return false;
            if (
              businessUnitFilter !== "all" &&
              (!jt.stBusinessUnitIds ||
                !jt.stBusinessUnitIds.includes(businessUnitFilter))
            )
              return false;
            if (searchQuery) {
              const q = searchQuery.toLowerCase();
              return (
                jt.stName.toLowerCase().includes(q) ||
                jt.displayName?.toLowerCase().includes(q) ||
                jt.matchedModelName?.toLowerCase().includes(q)
              );
            }
            return true;
          }),
        })),
      }))
      .filter((g) => g.workflows.some((wf) => wf.jobTypes.length > 0));
  }, [grouped, searchQuery, statusFilter, tradeFilter, businessUnitFilter]);

  // Section selection helpers
  function getSelectableIdsInTrade(trade: string): string[] {
    const group = filteredGrouped.find((g) => g.trade === trade);
    if (!group) return [];
    return group.workflows.flatMap((wf) =>
      wf.jobTypes
        .filter((jt) => jt.matchStatus !== "excluded")
        .map((jt) => jt.id)
    );
  }

  function getSelectableIdsInWorkflow(
    trade: string,
    workflow: string
  ): string[] {
    const group = filteredGrouped.find((g) => g.trade === trade);
    if (!group) return [];
    const wf = group.workflows.find((w) => w.workflow === workflow);
    if (!wf) return [];
    return wf.jobTypes
      .filter((jt) => jt.matchStatus !== "excluded")
      .map((jt) => jt.id);
  }

  function isAllSelected(ids: string[]): boolean {
    return ids.length > 0 && ids.every((id) => selectedIds.has(id));
  }

  function isSomeSelected(ids: string[]): boolean {
    return ids.some((id) => selectedIds.has(id)) && !isAllSelected(ids);
  }

  function toggleSection(ids: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected(ids)) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Failed to load job types: {error}
      </div>
    );
  }

  if (jobTypes.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/30">
        <p className="text-muted-foreground mb-2">
          No job types imported yet.
        </p>
        <p className="text-sm text-muted-foreground">
          Upload a ServiceTitan CSV or Excel file to get started.
        </p>
      </div>
    );
  }

  const trades = Array.from(
    new Set(jobTypes.map((jt) => jt.stTrade || "Unknown"))
  );

  return (
    <div>
      {/* Stats bar */}
      <div className="flex gap-4 mb-4 text-sm">
        <span>
          <strong>{stats.total}</strong> total
        </span>
        <span className="text-success">
          <strong>{stats.matched}</strong> matched
        </span>
        <span className="text-muted-foreground">
          <strong>{stats.excluded}</strong> excluded
        </span>
        {stats.noMatch > 0 && (
          <span className="text-destructive">
            <strong>{stats.noMatch}</strong> no match
          </span>
        )}
        {stats.pending > 0 && (
          <span className="text-warning">
            <strong>{stats.pending}</strong> pending
          </span>
        )}
      </div>

      {/* Needs attention */}
      <NeedsAttentionBanner items={needsAttention} onUpdate={updateJobType} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search job types..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Trade filter */}
        <select
          value={tradeFilter}
          onChange={(e) => setTradeFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Trades</option>
          {trades.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Business Unit filter */}
        {businessUnits.length > 0 && (
          <select
            value={businessUnitFilter}
            onChange={(e) => setBusinessUnitFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All Business Units</option>
            {businessUnits.map((bu) => (
              <option key={bu} value={bu}>
                BU: {bu}
              </option>
            ))}
          </select>
        )}

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All Status" : s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {customerMode && (
        <p className="text-xs text-muted-foreground mb-4 bg-information-50 px-3 py-2 rounded-md">
          Tip: Click any toggle to change a setting. Changes save
          automatically. Click a display name or price to edit it.
        </p>
      )}

      {/* Grouped table */}
      <div className="space-y-4">
        {filteredGrouped.map((tradeGroup) => {
          const tradeIds = getSelectableIdsInTrade(tradeGroup.trade);

          return (
            <div
              key={tradeGroup.trade}
              className="border rounded-lg overflow-hidden"
            >
              {/* Trade header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors">
                <Checkbox
                  checked={isAllSelected(tradeIds)}
                  indeterminate={isSomeSelected(tradeIds)}
                  onChange={() => toggleSection(tradeIds)}
                  disabled={tradeIds.length === 0}
                />
                <button
                  onClick={() => toggleGroup(tradeGroup.trade)}
                  className="flex items-center gap-2 flex-1"
                >
                  {expandedGroups.has(tradeGroup.trade) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium text-sm">
                    {tradeGroup.trade}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    (
                    {tradeGroup.workflows.reduce(
                      (sum, wf) => sum + wf.jobTypes.length,
                      0
                    )}{" "}
                    items)
                  </span>
                </button>
              </div>

              {expandedGroups.has(tradeGroup.trade) && (
                <div>
                  {tradeGroup.workflows.map((wfGroup) => {
                    if (wfGroup.jobTypes.length === 0) return null;
                    const wfKey = `${tradeGroup.trade}-${wfGroup.workflow}`;
                    const wfIds = getSelectableIdsInWorkflow(
                      tradeGroup.trade,
                      wfGroup.workflow
                    );

                    return (
                      <div key={wfKey}>
                        {/* Workflow sub-header */}
                        <div className="flex items-center gap-3 px-4 py-2 bg-muted/20 border-t">
                          <Checkbox
                            checked={isAllSelected(wfIds)}
                            indeterminate={isSomeSelected(wfIds)}
                            onChange={() => toggleSection(wfIds)}
                            disabled={wfIds.length === 0}
                          />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {WORKFLOW_DISPLAY_NAMES[wfGroup.workflow] ||
                              wfGroup.workflow}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({wfGroup.jobTypes.length})
                          </span>
                        </div>

                        {/* Table */}
                        <table className="w-full">
                          <thead>
                            <tr className="border-t bg-muted/10">
                              <th className="w-12 px-3 py-2" />
                              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  ST Job Type
                                  <Tooltip text={COLUMN_TOOLTIPS.stName} />
                                </span>
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  Display Name
                                  <Tooltip
                                    text={COLUMN_TOOLTIPS.displayName}
                                  />
                                </span>
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-24">
                                <span className="flex items-center gap-1.5">
                                  Price
                                  <Tooltip text={COLUMN_TOOLTIPS.price} />
                                </span>
                              </th>
                              {!customerMode && (
                                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                                  Match
                                </th>
                              )}
                              <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  Bookable
                                  <Tooltip text={COLUMN_TOOLTIPS.bookable} />
                                </span>
                              </th>
                              <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  Scheduler
                                  <Tooltip text={COLUMN_TOOLTIPS.scheduler} />
                                </span>
                              </th>
                              <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  Allow Cancel
                                  <Tooltip
                                    text={COLUMN_TOOLTIPS.allowCancel}
                                  />
                                </span>
                              </th>
                              <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  Allow Resched.
                                  <Tooltip
                                    text={COLUMN_TOOLTIPS.allowReschedule}
                                  />
                                </span>
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                                Notes
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {wfGroup.jobTypes.map((jt) => (
                              <JobTypeRow
                                key={jt.id}
                                jobType={jt}
                                onUpdate={updateJobType}
                                selected={selectedIds.has(jt.id)}
                                onToggleSelect={() => toggleSelect(jt.id)}
                                readOnly={readOnly}
                                customerMode={customerMode}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bulk edit bar */}
      <BulkEditBar
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        onBulkUpdate={bulkUpdate}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  );
}
