"use client";

import { cn } from "@/lib/utils";

interface BooleanToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function BooleanToggle({
  value,
  onChange,
  disabled,
  label,
}: BooleanToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        value ? "bg-primary" : "bg-muted-foreground/20",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform",
          value ? "translate-x-[18px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}
