import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorized, forbidden } from "@/lib/api-auth";
import { z } from "zod";

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  updates: z.object({
    isBookable: z.boolean().optional(),
    isSchedulerEnabled: z.boolean().optional(),
    isTglEnabled: z.boolean().optional(),
    isMembershipEligible: z.boolean().optional(),
    noCancel: z.boolean().optional(),
    noReschedule: z.boolean().optional(),
    shouldEscalate: z.boolean().optional(),
    matchStatus: z
      .enum(["pending", "matched", "no_match", "excluded", "manual"])
      .optional(),
  }),
});

export async function PUT(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const body = await req.json();
  const parsed = bulkUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { ids, updates } = parsed.data;

  // Verify ownership and version status by checking the first job type
  const sample = await prisma.jobType.findFirst({
    where: { id: { in: ids } },
    include: { configVersion: true },
  });

  if (!sample) {
    return NextResponse.json({ error: "No job types found" }, { status: 404 });
  }

  // Customer ownership check
  if (
    session.user.role === "customer" &&
    sample.configVersion.tenantId !== session.user.tenantId
  ) {
    return forbidden();
  }

  // Version status check
  if (
    sample.configVersion.status !== "draft" &&
    sample.configVersion.status !== "review"
  ) {
    return NextResponse.json(
      { error: "Cannot edit job types in a confirmed or live version" },
      { status: 403 }
    );
  }

  // Apply cascade rules
  const finalUpdates: Record<string, any> = { ...updates };
  if (finalUpdates.isBookable === false) {
    finalUpdates.isSchedulerEnabled = false;
  }
  finalUpdates.customerEdited = true;

  const result = await prisma.jobType.updateMany({
    where: { id: { in: ids } },
    data: finalUpdates,
  });

  return NextResponse.json({ updated: result.count });
}
