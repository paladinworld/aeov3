"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WizardClient } from "./wizard-client";

export default function WizardPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const step = parseInt(searchParams.get("step") || "1", 10);

  const [versionId, setVersionId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.tenantSlug) return;

    fetch("/api/customer/tenant")
      .then((res) => res.json())
      .then((data) => {
        setVersionId(data.latestVersionId);
        setTenantName(data.longName || data.name);
        setLoading(false);
      });
  }, [session]);

  if (loading || !versionId) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <WizardClient
      configVersionId={versionId}
      tenantName={tenantName}
      currentStep={step}
    />
  );
}
