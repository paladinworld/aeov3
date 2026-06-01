"use client";

import { cn } from "@/lib/utils";

interface TradeTabsProps {
  trades: string[];
  selected: string;
  onSelect: (trade: string) => void;
  counts?: Record<string, number>;
}

const TRADE_COLORS: Record<string, string> = {
  HVAC: "bg-blue-50 text-blue-700 border-blue-200 data-[active=true]:bg-blue-100 data-[active=true]:border-blue-400",
  PLUMBING: "bg-cyan-50 text-cyan-700 border-cyan-200 data-[active=true]:bg-cyan-100 data-[active=true]:border-cyan-400",
  ELECTRICAL: "bg-amber-50 text-amber-700 border-amber-200 data-[active=true]:bg-amber-100 data-[active=true]:border-amber-400",
};

export function TradeTabs({ trades, selected, onSelect, counts }: TradeTabsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect("all")}
        data-active={selected === "all"}
        className={cn(
          "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
          selected === "all"
            ? "bg-foreground text-background border-foreground"
            : "bg-muted text-muted-foreground border-transparent hover:bg-muted-hover"
        )}
      >
        All{counts ? ` (${Object.values(counts).reduce((a, b) => a + b, 0)})` : ""}
      </button>
      {trades.map((trade) => (
        <button
          key={trade}
          onClick={() => onSelect(trade)}
          data-active={selected === trade}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
            TRADE_COLORS[trade] || "bg-muted text-muted-foreground border-transparent"
          )}
        >
          {trade}
          {counts?.[trade] != null && ` (${counts[trade]})`}
        </button>
      ))}
    </div>
  );
}

export function TradeBadge({ trade }: { trade: string }) {
  const colors: Record<string, string> = {
    HVAC: "bg-blue-50 text-blue-600",
    PLUMBING: "bg-cyan-50 text-cyan-600",
    ELECTRICAL: "bg-amber-50 text-amber-600",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        colors[trade] || "bg-muted text-muted-foreground"
      )}
    >
      {trade}
    </span>
  );
}
