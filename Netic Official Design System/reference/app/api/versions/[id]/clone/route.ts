import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const sourceVersion = await prisma.configVersion.findUnique({
    where: { id: params.id },
    include: {
      jobTypes: true,
      standardConfig: true,
    },
  });

  if (!sourceVersion) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Use a transaction to prevent race conditions on version number
  const newVersion = await prisma.$transaction(async (tx) => {
    const latestVersion = await tx.configVersion.findFirst({
      where: { tenantId: sourceVersion.tenantId },
      orderBy: { version: "desc" },
    });

    const newVersionNumber = (latestVersion?.version ?? 0) + 1;

    const created = await tx.configVersion.create({
      data: {
        tenantId: sourceVersion.tenantId,
        version: newVersionNumber,
        status: "draft",
        notes: `Cloned from version ${sourceVersion.version}`,
      },
    });

    // Copy all job types
    if (sourceVersion.jobTypes.length > 0) {
      await tx.jobType.createMany({
        data: sourceVersion.jobTypes.map(
          ({ id, configVersionId, createdAt, updatedAt, ...jt }) => ({
            ...jt,
            configVersionId: created.id,
            customerEdited: false,
          })
        ),
      });
    }

    // Copy standard config
    if (sourceVersion.standardConfig) {
      await tx.standardConfig.create({
        data: {
          configVersionId: created.id,
          jobTypeQuestions:
            sourceVersion.standardConfig.jobTypeQuestions as any,
          transferRules: sourceVersion.standardConfig.transferRules as any,
          cancellationReasons:
            sourceVersion.standardConfig.cancellationReasons as any,
          prioritization: sourceVersion.standardConfig.prioritization as any,
        },
      });
    }

    return created;
  });

  await prisma.auditLog.create({
    data: {
      tenantId: sourceVersion.tenantId,
      userId: session.user.id,
      action: "cloned_version",
      details: {
        sourceVersionId: params.id,
        sourceVersion: sourceVersion.version,
        newVersionId: newVersion.id,
        newVersion: newVersion.version,
        jobTypesCopied: sourceVersion.jobTypes.length,
      },
    },
  });

  return NextResponse.json(newVersion, { status: 201 });
}
