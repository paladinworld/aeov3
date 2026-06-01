"use client";

import { X } from "lucide-react";

interface BulkEditBarProps {
  selectedCount: number;
  selectedIds: string[];
  onBulkUpdate: (ids: string[], updates: Record<string, any>) => void;
  onClearSelection: () => void;
}

export function BulkEditBar({
  selectedCount,
  selectedIds,
  onBulkUpdate,
  onClearSelection,
}: BulkEditBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-foreground text-background rounded-lg shadow-lg px-4 py-3">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
        <div className="h-4 w-px bg-background/20" />
        <button
          onClick={() => onBulkUpdate(selectedIds, { isBookable: true })}
          className="text-xs rounded px-3 py-1.5 bg-background/10 hover:bg-background/20 transition-colors"
        >
          Set Bookable
        </button>
        <button
          onClick={() => onBulkUpdate(selectedIds, { isBookable: false })}
          className="text-xs rounded px-3 py-1.5 bg-background/10 hover:bg-background/20 transition-colors"
        >
          Set Not Bookable
        </button>
        <button
          onClick={() =>
            onBulkUpdate(selectedIds, { isSchedulerEnabled: true })
          }
          className="text-xs rounded px-3 py-1.5 bg-background/10 hover:bg-background/20 transition-colors"
        >
          Enable Scheduler
        </button>
        <button
          onClick={() =>
            onBulkUpdate(selectedIds, {
              matchStatus: "excluded",
              isBookable: false,
            })
          }
          className="text-xs rounded px-3 py-1.5 bg-background/10 hover:bg-background/20 transition-colors"
        >
          Exclude All
        </button>
        <div className="h-4 w-px bg-background/20" />
        <button
          onClick={onClearSelection}
          className="p-1 rounded hover:bg-background/20 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
