"use client";

import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  disabled,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      onClick={() => !disabled && onChange()}
      disabled={disabled}
      className={cn(
        "h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked || indeterminate
          ? "bg-primary border-primary text-primary-foreground"
          : "border-muted-foreground/40 bg-background",
        disabled && "opacity-40 cursor-not-allowed",
        !disabled && "cursor-pointer hover:border-primary"
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {indeterminate && !checked && (
        <Minus className="h-3.5 w-3.5" strokeWidth={3} />
      )}
    </button>
  );
}
