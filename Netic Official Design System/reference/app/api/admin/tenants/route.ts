import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/api-auth";
import { z } from "zod";

const createTenantSchema = z.object({
  name: z.string().min(1),
  longName: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactName: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const where: any = {};
  if (status && status !== "all") where.status = status;
  if (q) where.name = { contains: q, mode: "insensitive" };

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const body = await req.json();
  const parsed = createTenantSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.tenant.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A tenant with this slug already exists" },
      { status: 409 }
    );
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: parsed.data.name,
      longName: parsed.data.longName,
      slug: parsed.data.slug,
      contactEmail: parsed.data.contactEmail || null,
      contactName: parsed.data.contactName || null,
      configVersions: {
        create: {
          version: 1,
          status: "draft",
          notes: "Initial configuration",
        },
      },
    },
    include: {
      configVersions: true,
    },
  });

  // Create default standard config for the first version
  await prisma.standardConfig.create({
    data: {
      configVersionId: tenant.configVersions[0].id,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      action: "created_tenant",
      details: { name: tenant.name, slug: tenant.slug },
    },
  });

  return NextResponse.json(tenant, { status: 201 });
}
