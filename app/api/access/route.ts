import { NextResponse } from "next/server";
import { z } from "zod";
import { accessEnabled, findAccessScope, newGrantCookie } from "@/lib/access";

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

  const scope = await findAccessScope(parsed.email, parsed.code, parsed.reportId);
  if (!scope) {
    // Deliberately generic — never reveal whether the email or the code was wrong,
    // and never reveal any company name.
    return NextResponse.json({ error: "That email and access code don't match." }, { status: 401 });
  }

  const redirect = scope === "*" ? "/" : `/?report=${encodeURIComponent(scope)}`;
  const response = NextResponse.json({ ok: true, redirect });
  const cookie = newGrantCookie(scope, parsed.email);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
