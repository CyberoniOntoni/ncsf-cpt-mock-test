import { NextResponse } from "next/server";
import { COOKIE, LEGACY_COOKIE } from "@/lib/session";

/**
 * Clear session cookie outside RSC (cookies can only be mutated in
 * Route Handlers / Server Actions). Used when JWT is valid but DB
 * membership is gone (e.g. after local DB wipe).
 */
export async function GET(req: Request) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", "Session expired — sign in again");
  const res = NextResponse.redirect(url);
  for (const name of [COOKIE, LEGACY_COOKIE]) {
    res.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}
