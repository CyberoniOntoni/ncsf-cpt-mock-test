import { createHmac, randomBytes, randomInt } from "crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  clientDocuments,
  clientOtps,
  clientSessions,
  clients,
  organizations,
} from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { REQUIRED_PORTAL_DOCUMENTS } from "@/lib/portal-documents";
import { id } from "@/lib/utils";

export const CLIENT_COOKIE = "client_session";
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_WINDOW_MS = 15 * 60 * 1000;
const OTP_RATE_MAX = 3;
const SESSION_DAYS = 14;

const DEV_CLIENT_SECRET = "dev-only-change-me-floorscribe-client-secret";

export type ClientSessionPayload = {
  role: "client";
  clientId: string;
  organizationId: string;
  organizationName: string;
  email: string;
  firstName: string;
  lastName: string;
  sessionId: string;
};

export type PortalStudioChoice = {
  organizationId: string;
  organizationName: string;
  clientId: string;
  firstName: string;
};

function clientSecret(): Uint8Array {
  const s = process.env.CLIENT_AUTH_SECRET || "";
  if (process.env.NODE_ENV === "production") {
    if (!s || s.length < 24) {
      throw new Error(
        "CLIENT_AUTH_SECRET is missing or weak in production. Set a long random secret (≥24 characters)."
      );
    }
    return new TextEncoder().encode(s);
  }
  return new TextEncoder().encode(s || DEV_CLIENT_SECRET);
}

export function hashOtp(code: string): string {
  const secret = process.env.CLIENT_AUTH_SECRET || DEV_CLIENT_SECRET;
  return createHmac("sha256", secret).update(code.trim()).digest("hex");
}

export function normalizePortalEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

async function findEligibleClients(email: string) {
  const db = await getDb();
  const rows = await db
    .select({
      clientId: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      status: clients.status,
      organizationId: clients.organizationId,
      organizationName: organizations.name,
    })
    .from(clients)
    .innerJoin(organizations, eq(organizations.id, clients.organizationId))
    .where(sql`lower(coalesce(${clients.email}, '')) = ${email}`);

  return rows.filter((r) => r.status === "active" || r.status === "paused");
}

export async function listPortalStudiosForEmail(
  rawEmail: string
): Promise<PortalStudioChoice[]> {
  const email = normalizePortalEmail(rawEmail);
  if (!email.includes("@")) return [];
  const rows = await findEligibleClients(email);
  return rows.map((r) => ({
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    clientId: r.clientId,
    firstName: r.firstName,
  }));
}

export async function requestClientOtp(opts: {
  email: string;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<
  | { ok: true; sent: true; organizationId: string; devCode?: string }
  | { ok: true; needsOrg: true; studios: PortalStudioChoice[] }
  | { ok: false; error: string }
> {
  const email = normalizePortalEmail(opts.email);
  if (!email.includes("@")) return { ok: false, error: "Enter a valid email" };

  const eligible = await findEligibleClients(email);
  if (!eligible.length) {
    return {
      ok: false,
      error:
        "If this email is on a client profile, we sent a code. Check your inbox or ask your trainer.",
    };
  }

  if (!opts.organizationId && eligible.length > 1) {
    return {
      ok: true,
      needsOrg: true,
      studios: eligible.map((r) => ({
        organizationId: r.organizationId,
        organizationName: r.organizationName,
        clientId: r.clientId,
        firstName: r.firstName,
      })),
    };
  }

  const match =
    eligible.find((r) => r.organizationId === opts.organizationId) || eligible[0];
  if (!match) {
    return { ok: false, error: "Studio not found for this email" };
  }

  const db = await getDb();
  const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS);
  const recent = await db
    .select({ id: clientOtps.id })
    .from(clientOtps)
    .where(
      and(
        eq(clientOtps.email, email),
        eq(clientOtps.organizationId, match.organizationId),
        gte(clientOtps.createdAt, windowStart)
      )
    );
  if (recent.length >= OTP_RATE_MAX) {
    return { ok: false, error: "Too many codes. Try again in a few minutes." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(clientOtps).values({
    id: id("otp"),
    organizationId: match.organizationId,
    clientId: match.clientId,
    email,
    codeHash: hashOtp(code),
    attempts: 0,
    ipAddress: opts.ipAddress || null,
    userAgent: opts.userAgent || null,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendEmail({
    to: email,
    subject: `Your FloorScribe code for ${match.organizationName}`,
    text: `Hi ${match.firstName},\n\nYour FloorScribe client portal code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
  });

  return {
    ok: true,
    sent: true,
    organizationId: match.organizationId,
    ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
  };
}

export async function verifyClientOtp(opts: {
  email: string;
  organizationId: string;
  code: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizePortalEmail(opts.email);
  const code = (opts.code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code" };

  const db = await getDb();
  const [otp] = await db
    .select()
    .from(clientOtps)
    .where(
      and(
        eq(clientOtps.email, email),
        eq(clientOtps.organizationId, opts.organizationId),
        isNull(clientOtps.usedAt)
      )
    )
    .orderBy(desc(clientOtps.createdAt))
    .limit(1);

  if (!otp) return { ok: false, error: "No active code. Request a new one." };
  if (otp.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Code expired. Request a new one." };
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  if (otp.codeHash !== hashOtp(code)) {
    await db
      .update(clientOtps)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(clientOtps.id, otp.id));
    return { ok: false, error: "Incorrect code" };
  }

  await db
    .update(clientOtps)
    .set({ usedAt: new Date() })
    .where(eq(clientOtps.id, otp.id));

  const [client] = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.id, otp.clientId), eq(clients.organizationId, otp.organizationId))
    )
    .limit(1);
  if (!client || (client.status !== "active" && client.status !== "paused")) {
    return { ok: false, error: "This profile cannot sign in" };
  }

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, client.organizationId))
    .limit(1);

  await ensureRequiredDocuments(client.organizationId, client.id);

  const sessionId = id("csess");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(clientSessions).values({
    id: sessionId,
    organizationId: client.organizationId,
    clientId: client.id,
    token,
    ipAddress: opts.ipAddress || null,
    userAgent: opts.userAgent || null,
    expiresAt,
  });

  const jwt = await signClientJwt({
    role: "client",
    clientId: client.id,
    organizationId: client.organizationId,
    organizationName: org?.name || "Studio",
    email: client.email || email,
    firstName: client.firstName,
    lastName: client.lastName,
    sessionId,
    token,
  });

  await persistClientCookie(jwt);
  return { ok: true };
}

async function signClientJwt(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(clientSecret());
}

async function persistClientCookie(jwt: string) {
  try {
    const jar = await cookies();
    jar.set(CLIENT_COOKIE, jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
  } catch {
    // No request cookies (smoke / scripts) — session row is still created.
  }
}

export async function readClientSession(): Promise<ClientSessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(CLIENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, clientSecret());
    if (payload.role !== "client") return null;
    const sessionId = String(payload.sessionId || "");
    const token = String(payload.token || "");
    const clientId = String(payload.clientId || "");
    const organizationId = String(payload.organizationId || "");
    if (!sessionId || !clientId || !organizationId) return null;

    const db = await getDb();
    const [row] = await db
      .select()
      .from(clientSessions)
      .where(eq(clientSessions.id, sessionId))
      .limit(1);
    if (!row || row.token !== token) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    if (row.clientId !== clientId || row.organizationId !== organizationId) {
      return null;
    }

    return {
      role: "client",
      clientId,
      organizationId,
      organizationName: String(payload.organizationName || "Studio"),
      email: String(payload.email || ""),
      firstName: String(payload.firstName || ""),
      lastName: String(payload.lastName || ""),
      sessionId,
    };
  } catch {
    return null;
  }
}

export async function requireClientSession(): Promise<ClientSessionPayload> {
  const session = await readClientSession();
  if (!session) redirect("/portal/login");
  return session;
}

export async function clearClientSessionCookie() {
  const jar = await cookies();
  jar.set(CLIENT_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

export async function logoutClientPortal() {
  const session = await readClientSession();
  if (session) {
    const db = await getDb();
    await db.delete(clientSessions).where(eq(clientSessions.id, session.sessionId));
  }
  await clearClientSessionCookie();
}

export async function ensureRequiredDocuments(
  organizationId: string,
  clientId: string
) {
  const db = await getDb();
  const existing = await db
    .select({ type: clientDocuments.type })
    .from(clientDocuments)
    .where(
      and(
        eq(clientDocuments.organizationId, organizationId),
        eq(clientDocuments.clientId, clientId)
      )
    );
  const have = new Set(existing.map((d) => d.type));
  for (const doc of REQUIRED_PORTAL_DOCUMENTS) {
    if (have.has(doc.type)) continue;
    await db.insert(clientDocuments).values({
      id: id("cdoc"),
      organizationId,
      clientId,
      type: doc.type,
      title: doc.title,
      status: "pending",
      documentVersion: doc.version,
    });
  }
}

export async function clientNeedsOnboarding(
  organizationId: string,
  clientId: string
): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({
      onboardingCompletedAt: clients.onboardingCompletedAt,
    })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)))
    .limit(1);
  if (!row) return true;
  if (row.onboardingCompletedAt) return false;
  const pending = await db
    .select({ id: clientDocuments.id })
    .from(clientDocuments)
    .where(
      and(
        eq(clientDocuments.organizationId, organizationId),
        eq(clientDocuments.clientId, clientId),
        eq(clientDocuments.status, "pending")
      )
    )
    .limit(1);
  return pending.length > 0;
}
