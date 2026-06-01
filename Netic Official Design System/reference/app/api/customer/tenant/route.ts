import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCustomer, unauthorized } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const session = await requireCustomer();
  if (!session) return unauthorized();

  const tenantId = session.user.tenantId;
  if (!tenantId) return unauthorized();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
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

  const latestVersion = tenant.configVersions[0];
  const stats = latestVersion
    ? {
        total: latestVersion.jobTypes.length,
        matched: latestVersion.jobTypes.filter((j) => j.matchStatus === "matched" || j.matchStatus === "manual").length,
        excluded: latestVersion.jobTypes.filter((j) => j.matchStatus === "excluded").length,
        noMatch: latestVersion.jobTypes.filter((j) => j.matchStatus === "no_match").length,
        pending: latestVersion.jobTypes.filter((j) => j.matchStatus === "pending").length,
        lowConfidence: latestVersion.jobTypes.filter((j) => j.matchConfidence === "low").length,
        customerEdited: latestVersion.jobTypes.filter((j) => j.customerEdited).length,
      }
    : null;

  return NextResponse.json({
    tenant: { name: tenant.name, longName: tenant.longName, slug: tenant.slug },
    latestVersionId: latestVersion?.id,
    stats,
  });
}
