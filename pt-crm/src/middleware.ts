import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "floorscribe_session";
const LEGACY_COOKIE = "ptcrm_session";

function secret() {
  const s = process.env.AUTH_SECRET || "dev-only-change-me-floorscribe-secret-key";
  return new TextEncoder().encode(s);
}

function clearAuthCookies(res: NextResponse) {
  for (const name of [COOKIE, LEGACY_COOKIE]) {
    res.cookies.set(name, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  const token =
    req.cookies.get(COOKIE)?.value ?? req.cookies.get(LEGACY_COOKIE)?.value;
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
    if (token) clearAuthCookies(res);
    return res;
  }

  if (valid && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
