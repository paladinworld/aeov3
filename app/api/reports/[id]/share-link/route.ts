import { NextResponse } from "next/server";
import { accessEnabled, currentGrant, grantsReport, signGrant } from "@/lib/access";

// Mints a no-login "magic" view link for ONE report: /access/magic?t=<signed grant>&r=<id>.
// The grant is scoped to this single report (not the admin "*" scope), so sharing the URL
// only exposes this report. Only someone who can already view the report may mint a link.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (accessEnabled() && !grantsReport(await currentGrant(), id)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  // Public origin (works behind Vercel's proxy).
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  // Gate off (local dev) → the plain report URL already opens without sign-in.
  if (!accessEnabled()) {
    return NextResponse.json({ url: `${origin}/?report=${encodeURIComponent(id)}` }, { headers: { "Cache-Control": "no-store" } });
  }

  const token = signGrant({ reports: [id], email: "share-link", exp: Date.now() + 365 * 86400 * 1000 });
  const url = `${origin}/access/magic?t=${encodeURIComponent(token)}&r=${encodeURIComponent(id)}`;
  return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
}
