import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/** Auth cookie name (FloorScribe). */
const COOKIE = "floorscribe_session";
/** Pre-rebrand cookie — still accepted so existing sessions stay signed in. */
const LEGACY_COOKIE = "ptcrm_session";

/** Dev-only fallback — never treat as production-ok. */
const DEV_AUTH_SECRET = "dev-only-change-me-floorscribe-secret-key";

const WEAK_AUTH_SECRETS = new Set([
  "change-me-in-production",
  "dev-only-change-me-floorscribe-secret-key",
  "dev-only-change-me-pt-crm-secret-key",
]);

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  /** Optional credentials line (e.g. NCSF-CPT) for shell / profile */
  title?: string | null;
  organizationId: string;
  organizationName: string;
  role: string;
  isPlatformAdmin: boolean;
};

/** True when secret is missing, too short, or a known placeholder/example value. */
export function isWeakAuthSecret(s: string | undefined | null): boolean {
  if (!s) return true;
  if (WEAK_AUTH_SECRETS.has(s)) return true;
  if (s.length < 24) return true;
  return false;
}

/**
 * Resolve AUTH_SECRET for JWT sign/verify.
 * Production: fail closed (throw) if missing or weak — never sign with a hardcoded default.
 * Development: allow a distinct dev default that isWeakAuthSecret flags as weak.
 */
function resolveAuthSecretString(): string {
  const s = process.env.AUTH_SECRET || "";
  if (process.env.NODE_ENV === "production") {
    if (isWeakAuthSecret(s)) {
      throw new Error(
        "AUTH_SECRET is missing or weak in production. Set a long random secret (≥24 characters)."
      );
    }
    return s;
  }
  return s || DEV_AUTH_SECRET;
}

function secret() {
  return new TextEncoder().encode(resolveAuthSecretString());
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
