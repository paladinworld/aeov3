import { NextResponse } from "next/server";
import { z } from "zod";
import { accessEnabled, findGrantedReports, newGrantCookie } from "@/lib/access";

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  // The report the visitor is trying to open (from ?report=<id>). Optional so the
  // admin master code can sign in from /access with no specific report in hand.
  reportId: z.string().optional()
});

export async function POST(request: Request) {
  if (!accessEnabled()) {
    return NextResponse.json({ error: "Access control is not enabled." }, { status: 503 });
  }
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter a valid email and access code." }, { status: 400 });
  }

  const granted = await findGrantedReports(parsed.email, parsed.code, parsed.reportId);
  if (!granted) {
    // Deliberately generic — never reveal whether the email or the code was wrong,
    // and never reveal any company name.
    return NextResponse.json({ error: "That email and access code don't match." }, { status: 401 });
  }

  // Land on the report they opened if the code covers it; otherwise the first
  // report the account unlocks. Admin ("*") lands on the home dashboard.
  const admin = granted.includes("*");
  const land = !admin && parsed.reportId && granted.includes(parsed.reportId) ? parsed.reportId : granted[0];
  const redirect = admin ? "/" : `/?report=${encodeURIComponent(land)}`;
  const response = NextResponse.json({ ok: true, redirect });
  const cookie = newGrantCookie(granted, parsed.email);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
