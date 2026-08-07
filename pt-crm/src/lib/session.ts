import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/** Auth cookie name (FloorScribe). */
const COOKIE = "floorscribe_session";
/** Pre-rebrand cookie — still accepted so existing sessions stay signed in. */
const LEGACY_COOKIE = "ptcrm_session";

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: string;
  isPlatformAdmin: boolean;
};

function secret() {
  const s = process.env.AUTH_SECRET || "dev-only-change-me-floorscribe-secret-key";
  return new TextEncoder().encode(s);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret());
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  // Drop legacy name so we don't keep two auth cookies around
  jar.delete(LEGACY_COOKIE);
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(LEGACY_COOKIE);
}

export { COOKIE, LEGACY_COOKIE };
