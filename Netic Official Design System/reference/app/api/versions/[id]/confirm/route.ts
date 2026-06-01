import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorized, forbidden } from "@/lib/api-auth";
import { z } from "zod";

const confirmSchema = z.object({
  confirmedBy: z.string().email(),
  confirmerName: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const body = await req.json();
  const parsed = confirmSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const version = await prisma.configVersion.findUnique({
    where: { id: params.id },
    include: {
      jobTypes: {
        select: {
          matchStatus: true,
          isBookable: true,
          displayName: true,
        },
      },
    },
  });

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Ownership check for customers
  if (
    session.user.role === "customer" &&
    version.tenantId !== session.user.tenantId
  ) {
    return forbidden();
  }

  if (version.status !== "draft" && version.status !== "review") {
    return NextResponse.json(
      { error: "Only draft or review versions can be confirmed" },
      { status: 400 }
    );
  }

  // Validation: no pending items
  const pending = version.jobTypes.filter(
    (jt) => jt.matchStatus === "pending"
  );
  if (pending.length > 0) {
    return NextResponse.json(
      { error: `${pending.length} job types are still pending matching` },
      { status: 400 }
    );
  }

  // Validation: no unresolved no_match items
  const noMatch = version.jobTypes.filter(
    (jt) => jt.matchStatus === "no_match"
  );
  if (noMatch.length > 0) {
    return NextResponse.json(
      {
        error: `${noMatch.length} job types have no match and need to be resolved`,
      },
      { status: 400 }
    );
  }

  // Validation: at least 1 bookable type
  const bookable = version.jobTypes.filter((jt) => jt.isBookable);
  if (bookable.length === 0) {
    return NextResponse.json(
      { error: "At least one job type must be bookable" },
      { status: 400 }
    );
  }

  // Confirm the version
  const updated = await prisma.configVersion.update({
    where: { id: params.id },
    data: {
      status: "confirmed",
      confirmedAt: new Date(),
      confirmedBy: parsed.data.confirmedBy,
    },
  });

  await prisma.tenant.update({
    where: { id: version.tenantId },
    data: { status: "confirmed" },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: version.tenantId,
      userId: session.user.id,
      action: "confirmed_version",
      details: {
        versionId: params.id,
        version: version.version,
        confirmedBy: parsed.data.confirmedBy,
        confirmerName: parsed.data.confirmerName,
        totalJobTypes: version.jobTypes.length,
        bookableCount: bookable.length,
      },
    },
  });

  return NextResponse.json(updated);
}
