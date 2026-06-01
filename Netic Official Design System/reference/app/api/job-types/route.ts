import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorized, forbidden } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get("versionId");

  if (!versionId) {
    return NextResponse.json(
      { error: "versionId is required" },
      { status: 400 }
    );
  }

  // Verify ownership: the version must belong to the user's tenant (for customers)
  if (session.user.role === "customer") {
    const version = await prisma.configVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.tenantId !== session.user.tenantId) {
      return forbidden();
    }
  }

  const jobTypes = await prisma.jobType.findMany({
    where: { configVersionId: versionId },
    orderBy: [
      { stTrade: "asc" },
      { stWorkflow: "asc" },
      { sortOrder: "asc" },
    ],
  });

  return NextResponse.json(jobTypes);
}
