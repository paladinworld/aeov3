import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Admin routes — require admin role
    if (path.startsWith("/admin")) {
      if (token?.role !== "admin") {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // Review routes — require customer role
    if (path.startsWith("/review")) {
      if (token?.role !== "customer") {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // API admin routes — require admin role
    if (path.startsWith("/api/admin")) {
      if (token?.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Public routes — no auth required
        if (
          path === "/login" ||
          path.startsWith("/api/auth")
        ) {
          return true;
        }

        // Everything else requires a valid token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/review/:path*",
    "/api/admin/:path*",
    "/api/job-types/:path*",
    "/api/versions/:path*",
  ],
};
