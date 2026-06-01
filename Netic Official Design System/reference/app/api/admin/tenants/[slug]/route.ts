import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/api-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.slug },
    include: {
      configVersions: {
        orderBy: { version: "desc" },
        include: {
          _count: { select: { jobTypes: true } },
          jobTypes: {
            select: {
              matchStatus: true,
              matchConfidence: true,
              customerEdited: true,
            },
          },
        },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Compute stats for the latest version
  const latestVersion = tenant.configVersions[0];
  const stats = latestVersion
    ? {
        total: latestVersion.jobTypes.length,
        matched: latestVersion.jobTypes.filter((j) => j.matchStatus === "matched").length,
        excluded: latestVersion.jobTypes.filter((j) => j.matchStatus === "excluded").length,
        noMatch: latestVersion.jobTypes.filter((j) => j.matchStatus === "no_match").length,
        pending: latestVersion.jobTypes.filter((j) => j.matchStatus === "pending").length,
        manual: latestVersion.jobTypes.filter((j) => j.matchStatus === "manual").length,
        customerEdited: latestVersion.jobTypes.filter((j) => j.customerEdited).length,
        lowConfidence: latestVersion.jobTypes.filter((j) => j.matchConfidence === "low").length,
      }
    : null;

  return NextResponse.json({
    ...tenant,
    configVersions: tenant.configVersions.map(({ jobTypes, ...v }) => v),
    stats,
    latestVersionId: latestVersion?.id,
  });
}
