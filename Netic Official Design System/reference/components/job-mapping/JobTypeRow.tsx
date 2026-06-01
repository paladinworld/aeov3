"use client";

import { useState } from "react";
import { BooleanToggle } from "./BooleanToggle";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Checkbox } from "./Checkbox";
import type { JobTypeData } from "./hooks/useJobTypes";

interface JobTypeRowProps {
  jobType: JobTypeData;
  onUpdate: (id: string, updates: Partial<JobTypeData>) => void;
  selected: boolean;
  onToggleSelect: () => void;
  readOnly?: boolean;
  customerMode?: boolean;
}

export function JobTypeRow({
  jobType,
  onUpdate,
  selected,
  onToggleSelect,
  readOnly,
  customerMode,
}: JobTypeRowProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(
    jobType.displayName || jobType.stName
  );
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState(
    jobType.price != null ? String(jobType.price) : ""
  );

  const isExcluded = jobType.matchStatus === "excluded";
  const rowOpacity = isExcluded ? "opacity-50" : "";

  function handleNameBlur() {
    setEditingName(false);
    if (nameValue !== (jobType.displayName || jobType.stName)) {
      onUpdate(jobType.id, { displayName: nameValue });
    }
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setNameValue(jobType.displayName || jobType.stName);
      setEditingName(false);
    }
  }

  function handlePriceBlur() {
    setEditingPrice(false);
    const parsed = priceValue ? parseFloat(priceValue) : null;
    if (parsed !== jobType.price) {
      onUpdate(jobType.id, { price: parsed } as any);
    }
  }

  function handlePriceKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setPriceValue(jobType.price != null ? String(jobType.price) : "");
      setEditingPrice(false);
    }
  }

  return (
    <tr
      className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${rowOpacity} ${
        jobType.matchStatus === "no_match" ? "bg-destructive/5" : ""
      } ${jobType.matchConfidence === "low" ? "bg-warning/5" : ""}`}
    >
      {/* Checkbox */}
      <td className="px-3 py-2 w-12">
        <Checkbox
          checked={selected}
          onChange={onToggleSelect}
          disabled={isExcluded}
        />
      </td>

      {/* ST Name */}
      <td className="px-3 py-2 text-sm">
        <span className="text-muted-foreground">{jobType.stName}</span>
      </td>

      {/* Display Name (editable) */}
      <td className="px-3 py-2">
        {editingName && !readOnly ? (
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        ) : (
          <button
            onClick={() => !readOnly && !isExcluded && setEditingName(true)}
            className={`text-sm text-left ${!readOnly && !isExcluded ? "hover:text-primary cursor-pointer" : ""}`}
          >
            {jobType.displayName || jobType.stName}
          </button>
        )}
      </td>

      {/* Price (editable) */}
      <td className="px-3 py-2 w-24">
        {editingPrice && !readOnly ? (
          <input
            type="number"
            step="0.01"
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            onBlur={handlePriceBlur}
            onKeyDown={handlePriceKeyDown}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        ) : (
          <button
            onClick={() => !readOnly && !isExcluded && setEditingPrice(true)}
            className={`text-sm text-muted-foreground ${!readOnly && !isExcluded ? "hover:text-primary cursor-pointer" : ""}`}
          >
            {jobType.price != null ? `$${jobType.price.toFixed(2)}` : "—"}
          </button>
        )}
      </td>

      {/* Match info (admin only) */}
      {!customerMode && (
        <td className="px-3 py-2">
          <ConfidenceBadge
            confidence={jobType.matchConfidence}
            status={jobType.matchStatus}
          />
        </td>
      )}

      {/* Bookable */}
      <td className="px-3 py-2 text-center">
        <BooleanToggle
          value={jobType.isBookable}
          onChange={(v) => onUpdate(jobType.id, { isBookable: v })}
          disabled={readOnly || isExcluded}
          label="Netic Books This"
        />
      </td>

      {/* Scheduler */}
      <td className="px-3 py-2 text-center">
        <BooleanToggle
          value={jobType.isSchedulerEnabled}
          onChange={(v) => onUpdate(jobType.id, { isSchedulerEnabled: v })}
          disabled={readOnly || isExcluded || !jobType.isBookable}
          label="Online Scheduler"
        />
      </td>

      {/* Allow Cancel (inverted no_cancel) */}
      <td className="px-3 py-2 text-center">
        <BooleanToggle
          value={!jobType.noCancel}
          onChange={(v) => onUpdate(jobType.id, { noCancel: !v })}
          disabled={readOnly || isExcluded}
          label="Allow Cancel"
        />
      </td>

      {/* Allow Reschedule (inverted no_reschedule) */}
      <td className="px-3 py-2 text-center">
        <BooleanToggle
          value={!jobType.noReschedule}
          onChange={(v) => onUpdate(jobType.id, { noReschedule: !v })}
          disabled={readOnly || isExcluded}
          label="Allow Reschedule"
        />
      </td>

      {/* Notes */}
      <td className="px-3 py-2 text-sm text-muted-foreground max-w-[150px] truncate">
        {jobType.customerNotes || ""}
      </td>
    </tr>
  );
}
