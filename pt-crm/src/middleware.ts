import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "floorscribe_session";
const LEGACY_COOKIE = "ptcrm_session";

/** Dev-only fallback — never treat as production-ok. */
const DEV_AUTH_SECRET = "dev-only-change-me-floorscribe-secret-key";

const WEAK_AUTH_SECRETS = new Set([
  "change-me-in-production",
  "dev-only-change-me-floorscribe-secret-key",
  "dev-only-change-me-pt-crm-secret-key",
]);

function isWeakAuthSecret(s: string | undefined | null): boolean {
  if (!s) return true;
  if (WEAK_AUTH_SECRETS.has(s)) return true;
  if (s.length < 24) return true;
  return false;
}

/**
 * Production: fail closed if AUTH_SECRET is missing/weak (no hardcoded signing default).
 * Development: allow distinct dev default.
 */
function secret() {
  const s = process.env.AUTH_SECRET || "";
  if (process.env.NODE_ENV === "production") {
    if (isWeakAuthSecret(s)) {
      throw new Error(
        "AUTH_SECRET is missing or weak in production. Set a long random secret (≥24 characters)."
      );
    }
    return new TextEncoder().encode(s);
  }
  return new TextEncoder().encode(s || DEV_AUTH_SECRET);
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
    pathname === "/" ||
    pathname.startsWith("/marketing") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/find") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/stripe/") ||
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

  // Logged out on / → product marketing site (URL stays /)
  if (!valid && pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/marketing";
    return NextResponse.rewrite(url);
  }

  // /marketing is always public (even when signed in) so the site can be previewed
  // Signed-in users still land on the floor board at /

  if (!valid && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const dest = `${pathname}${req.nextUrl.search}`;
    if (dest && dest !== "/") {
      url.searchParams.set("next", dest);
    }
    const res = NextResponse.redirect(url);
    // Drop broken JWT so we don't keep retrying with a bad cookie
    if (token) clearAuthCookies(res);
    return res;
  }

  // Already signed in: leave invite pages alone; bounce off auth entry points
  if (
    valid &&
    (pathname === "/login" ||
      pathname === "/register" ||
      pathname.startsWith("/register/"))
  ) {
    const next = req.nextUrl.searchParams.get("next");
    const safeNext =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return NextResponse.redirect(new URL(safeNext, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
