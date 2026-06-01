"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload, UserPlus, Copy, Check } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  matching: "bg-information-50 text-information",
  review: "bg-warning/10 text-warning",
  confirmed: "bg-success/10 text-success",
  live: "bg-primary/10 text-primary",
};

interface TenantHeaderProps {
  tenant: {
    id: string;
    name: string;
    longName: string;
    slug: string;
    status: string;
    contactEmail: string | null;
  };
  latestVersion: {
    id: string;
    version: number;
    status: string;
    _count: { jobTypes: number };
  } | null;
}

export function TenantHeader({ tenant, latestVersion }: TenantHeaderProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ email: "", name: "" });
  const [customerCredentials, setCustomerCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/admin/tenants/${tenant.slug}/import`, {
      method: "POST",
      body: formData,
    });

    setUploading(false);

    if (res.ok) {
      const data = await res.json();
      alert(
        `Imported ${data.imported} job types:\n- ${data.matched} matched\n- ${data.excluded} excluded\n- ${data.skipped} skipped`
      );
      router.refresh();
    } else {
      const data = await res.json();
      alert(`Import failed: ${data.error}`);
    }
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    const res = await fetch(
      `/api/admin/tenants/${tenant.slug}/create-customer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerForm),
      }
    );

    setCreating(false);

    if (res.ok) {
      const data = await res.json();
      setCustomerCredentials({ email: data.email, password: data.password });
    } else {
      const data = await res.json();
      alert(`Failed: ${data.error}`);
    }
  }

  function copyCredentials() {
    if (!customerCredentials) return;
    const text = `Login URL: ${window.location.origin}/login\nEmail: ${customerCredentials.email}\nPassword: ${customerCredentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{tenant.name}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[tenant.status] || STATUS_COLORS.draft}`}
            >
              {tenant.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {tenant.longName}
            {tenant.contactEmail && ` | ${tenant.contactEmail}`}
          </p>
          {latestVersion && (
            <p className="text-xs text-muted-foreground mt-1">
              Version {latestVersion.version} ({latestVersion.status}) |{" "}
              {latestVersion._count.jobTypes} job types
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {/* Import CSV */}
          <label className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary-hover transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            {uploading ? "Importing..." : "Import File"}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>

          {/* Create Customer Access */}
          {latestVersion && latestVersion._count.jobTypes > 0 && (
            <button
              onClick={() => setShowCreateCustomer(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Create Customer Access
            </button>
          )}
        </div>
      </div>

      {/* Create Customer Modal */}
      {showCreateCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border shadow-lg p-6 w-full max-w-md">
            {customerCredentials ? (
              // Show credentials
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Customer Access Created
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Share these credentials with the customer so they can log in
                  and review their configuration.
                </p>
                <div className="bg-muted rounded-md p-4 space-y-2 text-sm font-mono">
                  <div>
                    <span className="text-muted-foreground">URL: </span>
                    {typeof window !== "undefined"
                      ? window.location.origin
                      : ""}/login
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email: </span>
                    {customerCredentials.email}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Password: </span>
                    {customerCredentials.password}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={copyCredentials}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "Copied!" : "Copy All"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateCustomer(false);
                      setCustomerCredentials(null);
                      setCustomerForm({ email: "", name: "" });
                      router.refresh();
                    }}
                    className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary-hover transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              // Create form
              <form onSubmit={handleCreateCustomer}>
                <h3 className="text-lg font-semibold mb-4">
                  Create Customer Access
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a login for the customer to review and confirm their
                  configuration.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Customer Email
                    </label>
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          email: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="john@company.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerForm.name}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          name: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="John Smith"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create Access"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateCustomer(false)}
                    className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary-hover transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
