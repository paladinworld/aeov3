"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface TenantData {
  tenant: { name: string; longName: string };
  latestVersionId: string;
  stats: {
    total: number;
    matched: number;
    excluded: number;
    noMatch: number;
    pending: number;
    lowConfidence: number;
  };
}

export default function ReviewDashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.tenantSlug) return;

    fetch("/api/customer/tenant")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [session]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Could not load configuration data.
      </div>
    );
  }

  const needsAttention = (data.stats.noMatch || 0) + (data.stats.lowConfidence || 0);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">
          Welcome, {session?.user?.name || "there"}
        </h2>
        <p className="text-muted-foreground mt-2">
          Review your Netic AI agent configuration for{" "}
          <strong>{data.tenant?.longName || data.tenant?.name}</strong>. Go
          through each section and confirm when everything looks right.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-background border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-sm font-medium text-muted-foreground">
              Configured
            </span>
          </div>
          <p className="text-3xl font-semibold">{data.stats.matched}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Job types that Netic&apos;s AI agent will handle for your customers
          </p>
        </div>

        <div className="bg-background border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Excluded
            </span>
          </div>
          <p className="text-3xl font-semibold">{data.stats.excluded}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Job types outside Netic&apos;s scope (commercial, installations, etc.)
          </p>
        </div>

        <div className="bg-background border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle
              className={`h-5 w-5 ${needsAttention > 0 ? "text-warning" : "text-success"}`}
            />
            <span className="text-sm font-medium text-muted-foreground">
              Needs Input
            </span>
          </div>
          <p className="text-3xl font-semibold">{needsAttention}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {needsAttention > 0
              ? "Items that couldn't be automatically matched and need your review"
              : "All items resolved"}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <Link
          href="/review/wizard?step=1"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
        >
          Start Review
        </Link>
      </div>
    </div>
  );
}
