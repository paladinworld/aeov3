import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { prisma } from "./db";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  if (session.user.role !== "admin") return null;
  return session;
}

export async function requireCustomer() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  if (session.user.role !== "customer") return null;
  return session;
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Verify that a config version belongs to the given tenant.
 * Returns the version if valid, null otherwise.
 */
export async function verifyVersionOwnership(
  versionId: string,
  tenantId: string
) {
  const version = await prisma.configVersion.findUnique({
    where: { id: versionId },
  });
  if (!version || version.tenantId !== tenantId) return null;
  return version;
}

/**
 * Verify that a job type belongs to a tenant (via its config version).
 * Returns the job type with its config version if valid, null otherwise.
 */
export async function verifyJobTypeOwnership(
  jobTypeId: string,
  tenantId: string
) {
  const jobType = await prisma.jobType.findUnique({
    where: { id: jobTypeId },
    include: { configVersion: true },
  });
  if (!jobType || jobType.configVersion.tenantId !== tenantId) return null;
  return jobType;
}
