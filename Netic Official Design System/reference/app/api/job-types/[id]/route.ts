import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorized, forbidden } from "@/lib/api-auth";
import { z } from "zod";

const updateJobTypeSchema = z.object({
  displayName: z.string().optional(),
  alternativeKeywords: z.string().optional(),
  customerNotes: z.string().optional(),
  price: z.number().nullable().optional(),
  isBookable: z.boolean().optional(),
  isSchedulerEnabled: z.boolean().optional(),
  isTglEnabled: z.boolean().optional(),
  isMembershipEligible: z.boolean().optional(),
  isCommercial: z.boolean().optional(),
  isMemberOnly: z.boolean().optional(),
  noCancel: z.boolean().optional(),
  noReschedule: z.boolean().optional(),
  shouldEscalate: z.boolean().optional(),
  doNotAssignTech: z.boolean().optional(),
  disableGlobalQuestions: z.boolean().optional(),
  matchStatus: z
    .enum(["pending", "matched", "no_match", "excluded", "manual"])
    .optional(),
  matchedModelName: z.string().optional(),
  matchConfidence: z.string().optional(),
  stTrade: z.string().optional(),
  stWorkflow: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const body = await req.json();
  const parsed = updateJobTypeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Fetch job type and verify ownership
  const jobType = await prisma.jobType.findUnique({
    where: { id: params.id },
    include: { configVersion: true },
  });

  if (!jobType) {
    return NextResponse.json({ error: "Job type not found" }, { status: 404 });
  }

  // Customer can only edit their own tenant's job types
  if (
    session.user.role === "customer" &&
    jobType.configVersion.tenantId !== session.user.tenantId
  ) {
    return forbidden();
  }

  if (
    jobType.configVersion.status !== "draft" &&
    jobType.configVersion.status !== "review"
  ) {
    return NextResponse.json(
      { error: "Cannot edit job types in a confirmed or live version" },
      { status: 403 }
    );
  }

  // Apply validation rules
  const updates: Record<string, any> = { ...parsed.data };

  // If bookable is turned off, auto-clear scheduler
  if (updates.isBookable === false) {
    updates.isSchedulerEnabled = false;
  }

  // Mark as customer-edited if any customer-facing field changed
  const customerFields = [
    "displayName",
    "isBookable",
    "isSchedulerEnabled",
    "noCancel",
    "noReschedule",
    "customerNotes",
    "price",
  ];
  if (customerFields.some((f) => f in updates)) {
    updates.customerEdited = true;
  }

  const updated = await prisma.jobType.update({
    where: { id: params.id },
    data: updates,
  });

  await prisma.auditLog.create({
    data: {
      tenantId: jobType.configVersion.tenantId,
      userId: session.user.id,
      action: "edited_job_type",
      details: {
        jobTypeId: params.id,
        stName: jobType.stName,
        changes: parsed.data,
      },
    },
  });

  return NextResponse.json(updated);
}
