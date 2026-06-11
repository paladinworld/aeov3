import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessEnabled, grantedReportIds, grantsReport, isAdmin, verifyGrant } from "@/lib/access";

// Magic-link sign-in: /access/magic?t=<signed grant token>&r=<reportId>
// Verifies the token (HMAC-signed with ACCESS_SECRET — unforgeable), sets the access
// cookie, and redirects straight into the report. Used for admin convenience (the local
// ops tracker links here); a bad/missing token just falls through to the normal /access.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") || "";
  const reportId = url.searchParams.get("r") || "";

  // Gate off → nothing to bypass; just go where they asked.
  if (!accessEnabled()) {
    return NextResponse.redirect(new URL(reportId ? `/?report=${encodeURIComponent(reportId)}` : "/", request.url));
  }

  const grant = verifyGrant(token);
  if (!grant) {
    return NextResponse.redirect(new URL("/access" + (reportId ? `?report=${encodeURIComponent(reportId)}` : ""), request.url));
  }

  // Land on the requested report if this grant covers it; otherwise admin → home,
  // a scoped grant → its first report.
  const target =
    reportId && grantsReport(grant, reportId)
      ? `/?report=${encodeURIComponent(reportId)}`
      : isAdmin(grant)
        ? "/"
        : `/?report=${encodeURIComponent(grantedReportIds(grant)[0] ?? "")}`;

  const res = NextResponse.redirect(new URL(target, request.url));
  res.cookies.set(ACCESS_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
  return res;
}
