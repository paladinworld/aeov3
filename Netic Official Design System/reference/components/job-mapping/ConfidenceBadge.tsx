import { cn } from "@/lib/utils";

const CONFIDENCE_STYLES = {
  high: "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  low: "bg-destructive/10 text-destructive",
};

interface ConfidenceBadgeProps {
  confidence: string | null;
  status: string;
}

export function ConfidenceBadge({ confidence, status }: ConfidenceBadgeProps) {
  if (status === "excluded") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
        Excluded
      </span>
    );
  }

  if (status === "no_match") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
        No Match
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
        Pending
      </span>
    );
  }

  if (status === "manual") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-accent/10 text-accent">
        Manual
      </span>
    );
  }

  if (!confidence) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        CONFIDENCE_STYLES[confidence as keyof typeof CONFIDENCE_STYLES] ||
          CONFIDENCE_STYLES.medium
      )}
    >
      {confidence}
    </span>
  );
}
