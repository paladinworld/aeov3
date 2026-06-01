import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TenantHeader } from "./tenant-header";
import { JobMappingEditor } from "@/components/job-mapping/JobMappingEditor";

export default async function TenantDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.slug },
    include: {
      configVersions: {
        orderBy: { version: "desc" },
        include: {
          _count: { select: { jobTypes: true } },
        },
      },
    },
  });

  if (!tenant) notFound();

  const latestVersion = tenant.configVersions[0];

  return (
    <div className="p-8">
      <TenantHeader tenant={tenant} latestVersion={latestVersion} />

      {latestVersion ? (
        <div className="mt-8">
          <JobMappingEditor
            configVersionId={latestVersion.id}
            tenantSlug={tenant.slug}
            readOnly={latestVersion.status === "confirmed" || latestVersion.status === "live"}
          />
        </div>
      ) : (
        <div className="mt-8 text-center py-12 border rounded-lg bg-muted/30">
          <p className="text-muted-foreground">
            No configuration version found. This shouldn&apos;t happen.
          </p>
        </div>
      )}
    </div>
  );
}
