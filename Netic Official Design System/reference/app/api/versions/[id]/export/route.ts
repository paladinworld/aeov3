import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/api-auth";
import { buildTenantConfig } from "@/lib/export/blackbird-mapper";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const version = await prisma.configVersion.findUnique({
    where: { id: params.id },
    include: {
      tenant: true,
      jobTypes: true,
      standardConfig: true,
    },
  });

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const config = buildTenantConfig(
    version.tenant,
    version,
    version.jobTypes,
    version.standardConfig
  );

  return NextResponse.json(config, {
    headers: {
      "Content-Disposition": `attachment; filename="${version.tenant.slug}-v${version.version}-config.json"`,
    },
  });
}
