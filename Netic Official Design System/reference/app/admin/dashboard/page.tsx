import Link from "next/link";
import { prisma } from "@/lib/db";
import { Plus } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  matching: "bg-information-50 text-information",
  review: "bg-warning/10 text-warning",
  confirmed: "bg-success/10 text-success",
  live: "bg-primary/10 text-primary",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const where: any = {};
  if (searchParams.status && searchParams.status !== "all") {
    where.status = searchParams.status;
  }
  if (searchParams.q) {
    where.name = { contains: searchParams.q, mode: "insensitive" };
  }

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          configVersions: true,
        },
      },
      configVersions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          _count: { select: { jobTypes: true } },
        },
      },
    },
  });

  const statuses = ["all", "draft", "matching", "review", "confirmed", "live"];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage tenant onboarding configurations
          </p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Tenant
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/dashboard?status=${s}${searchParams.q ? `&q=${searchParams.q}` : ""}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              (searchParams.status || "all") === s
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Tenant table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Name
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Job Types
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Contact
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-12 text-muted-foreground"
                >
                  No tenants found. Create your first tenant to get started.
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => {
                const latestVersion = tenant.configVersions[0];
                const jobTypeCount = latestVersion?._count.jobTypes ?? 0;

                return (
                  <tr
                    key={tenant.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tenants/${tenant.slug}`}
                        className="font-medium text-sm hover:text-primary transition-colors"
                      >
                        {tenant.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {tenant.longName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[tenant.status] || STATUS_COLORS.draft}`}
                      >
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {jobTypeCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {tenant.contactEmail || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {tenant.updatedAt.toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
