import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "ptcrm_session";

function secret() {
  const s = process.env.AUTH_SECRET || "dev-only-change-me-pt-crm-secret-key";
  return new TextEncoder().encode(s);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  const token = req.cookies.get(COOKIE)?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, secret());
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (!valid && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const res = NextResponse.redirect(url);
    // Drop broken JWT so we don't keep retrying with a bad cookie
    if (token) {
      res.cookies.set(COOKIE, "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
      });
    }
    return res;
  }

  if (valid && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
