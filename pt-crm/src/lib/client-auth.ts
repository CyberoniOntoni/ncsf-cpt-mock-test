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

const WEAK_CLIENT_SECRETS = new Set([
  "change-me-in-production",
  "dev-only-change-me-floorscribe-client-secret",
  "replace-with-long-random-string-min-32-chars",
  "replace-with-another-long-random-string-min-32-chars",
]);

export type ClientSessionPayload = {
  role: "client";
  seekerId: string | null;
  clientId: string | null;
  organizationId: string | null;
  organizationName: string;
  email: string;
  firstName: string;
  lastName: string;
  sessionId: string | null;
};

export type PortalStudio = {
  clientId: string;
  organizationId: string;
  organizationName: string;
};

export type PortalStudioChoice = {
  organizationId: string;
  organizationName: string;
};

function isWeakClientSecret(s: string | undefined | null): boolean {
  if (!s) return true;
  if (WEAK_CLIENT_SECRETS.has(s)) return true;
  if (s.length < 32) return true;
  return false;
}

function clientSecret(): Uint8Array {
  const s = process.env.CLIENT_AUTH_SECRET || "";
  if (process.env.NODE_ENV === "production") {
    if (isWeakClientSecret(s)) {
      throw new Error(
        "CLIENT_AUTH_SECRET is missing or weak in production. Set a long random secret (≥32 characters)."
      );
    }
    return new TextEncoder().encode(s);
  }
  return new TextEncoder().encode(s || DEV_CLIENT_SECRET);
}

export function hashOtp(code: string): string {
  const secretBytes = clientSecret();
  return createHmac("sha256", Buffer.from(secretBytes)).update(code.trim()).digest("hex");
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

export async function firstStudioForEmail(
  rawEmail: string
): Promise<PortalStudio | null> {
  const rows = await findEligibleClients(normalizePortalEmail(rawEmail));
  const first = rows[0];
  if (!first) return null;
  return {
    clientId: first.clientId,
    organizationId: first.organizationId,
    organizationName: first.organizationName,
  };
}

/** Studio attach only after a prior OTP session row exists for that client. */
export async function studioProvenByOtp(
  rawEmail: string
): Promise<PortalStudio | null> {
  const email = normalizePortalEmail(rawEmail);
  if (!email.includes("@")) return null;
  const eligible = await findEligibleClients(email);
  if (!eligible.length) return null;
  const db = await getDb();
  for (const row of eligible) {
    const [sess] = await db
      .select({ id: clientSessions.id })
      .from(clientSessions)
      .where(eq(clientSessions.clientId, row.clientId))
      .limit(1);
    if (!sess) continue;
    return {
      clientId: row.clientId,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
    };
  }
  return null;
}

export async function resolvePortalStudio(
  session: ClientSessionPayload
): Promise<PortalStudio | null> {
  const email = normalizePortalEmail(session.email);
  if (session.clientId && session.organizationId) {
    const db = await getDb();
    const [row] = await db
      .select({
        clientId: clients.id,
        status: clients.status,
        email: clients.email,
        organizationId: clients.organizationId,
        organizationName: organizations.name,
      })
      .from(clients)
      .innerJoin(organizations, eq(organizations.id, clients.organizationId))
      .where(
        and(
          eq(clients.id, session.clientId),
          eq(clients.organizationId, session.organizationId)
        )
      )
      .limit(1);
    if (
      row &&
      (row.status === "active" || row.status === "paused") &&
      normalizePortalEmail(row.email || "") === email
    ) {
      return {
        clientId: row.clientId,
        organizationId: row.organizationId,
        organizationName: row.organizationName,
      };
    }
  }
  if (!email) return null;
  return studioProvenByOtp(email);
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
  }));
}

export async function requestClientOtp(opts: {
  email: string;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<
  | { ok: true; sent: true; devCode?: string }
  | { ok: true; needsOrg: true; studios: PortalStudioChoice[] }
  | { ok: false; error: string }
> {
  const email = normalizePortalEmail(opts.email);
  if (!email.includes("@")) return { ok: false, error: "Enter a valid email" };

  const eligible = await findEligibleClients(email);
  if (!eligible.length) {
    // Uniform with single-studio success — no enumeration, no devCode.
    return { ok: true, sent: true };
  }

  if (!opts.organizationId && eligible.length > 1) {
    return {
      ok: true,
      needsOrg: true,
      studios: eligible.map((r) => ({
        organizationId: r.organizationId,
        organizationName: r.organizationName,
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

  await db
    .update(clientOtps)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(clientOtps.email, email),
        eq(clientOtps.organizationId, match.organizationId),
        isNull(clientOtps.usedAt)
      )
    );

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

  const { delivered } = await sendEmail({
    to: email,
    subject: `Your FloorScribe code for ${match.organizationName}`,
    text: `Hi ${match.firstName},\n\nYour FloorScribe client portal code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
  });

  if (!delivered && process.env.NODE_ENV === "production") {
    return { ok: false, error: "Email is not configured" };
  }

  // Never return organizationId (enumeration). Multi-studio uses needsOrg + client pick.
  return {
    ok: true,
    sent: true,
    ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
  };
}

/** Latest unused, unexpired OTP org for email — used when verify URL has no org. */
export async function latestOtpOrganizationId(
  email: string
): Promise<string | null> {
  const normalized = normalizePortalEmail(email);
  if (!normalized.includes("@")) return null;
  const db = await getDb();
  const [row] = await db
    .select({ organizationId: clientOtps.organizationId })
    .from(clientOtps)
    .where(
      and(
        eq(clientOtps.email, normalized),
        isNull(clientOtps.usedAt),
        gte(clientOtps.expiresAt, new Date())
      )
    )
    .orderBy(desc(clientOtps.createdAt))
    .limit(1);
  return row?.organizationId ?? null;
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

  const { ensureSeekerForPerson } = await import("@/lib/seeker-auth");
  const seeker = await ensureSeekerForPerson({
    email: client.email || email,
    firstName: client.firstName,
    lastName: client.lastName,
  });

  await persistStudioSession({
    seekerId: seeker.id,
    email: client.email || email,
    firstName: client.firstName,
    lastName: client.lastName,
    studio: {
      clientId: client.id,
      organizationId: client.organizationId,
      organizationName: org?.name || "Studio",
    },
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
  });
  return { ok: true };
}

export async function persistStudioSession(opts: {
  seekerId: string;
  email: string;
  firstName: string;
  lastName: string;
  studio: PortalStudio;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const db = await getDb();
  const sessionId = id("csess");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(clientSessions).values({
    id: sessionId,
    organizationId: opts.studio.organizationId,
    clientId: opts.studio.clientId,
    token,
    ipAddress: opts.ipAddress || null,
    userAgent: opts.userAgent || null,
    expiresAt,
  });

  const jwt = await signClientJwt({
    role: "client",
    seekerId: opts.seekerId,
    clientId: opts.studio.clientId,
    organizationId: opts.studio.organizationId,
    organizationName: opts.studio.organizationName,
    email: opts.email,
    firstName: opts.firstName,
    lastName: opts.lastName,
    sessionId,
    token,
  });
  await persistClientCookie(jwt);
}

export async function issuePortalSession(opts: {
  seekerId: string;
  email: string;
  firstName: string;
  lastName: string;
  clientId?: string | null;
  organizationId?: string | null;
  organizationName?: string;
}) {
  const jwt = await signClientJwt({
    role: "client",
    seekerId: opts.seekerId,
    clientId: opts.clientId || null,
    organizationId: opts.organizationId || null,
    organizationName: opts.organizationName || "FloorScribe",
    email: opts.email,
    firstName: opts.firstName,
    lastName: opts.lastName,
  });
  await persistClientCookie(jwt);
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
    const seekerId = payload.seekerId ? String(payload.seekerId) : null;
    const sessionId = payload.sessionId ? String(payload.sessionId) : null;
    const token = payload.token ? String(payload.token) : "";
    const clientId = payload.clientId ? String(payload.clientId) : null;
    const organizationId = payload.organizationId
      ? String(payload.organizationId)
      : null;

    if (sessionId) {
      if (!clientId || !organizationId || !token) return null;
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
    } else if (!seekerId) {
      return null;
    }

    return {
      role: "client",
      seekerId,
      clientId,
      organizationId,
      organizationName: String(payload.organizationName || "FloorScribe"),
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

export async function requireStudioSession(): Promise<
  ClientSessionPayload & { clientId: string; organizationId: string }
> {
  const session = await requireClientSession();
  const studio = await resolvePortalStudio(session);
  if (!studio) redirect("/portal/dashboard");
  return {
    ...session,
    clientId: studio.clientId,
    organizationId: studio.organizationId,
    organizationName: studio.organizationName,
  };
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
  if (session?.sessionId) {
    const db = await getDb();
    await db.delete(clientSessions).where(eq(clientSessions.id, session.sessionId));
  }
  await clearClientSessionCookie();
  try {
    const { clearSeekerSession } = await import("@/lib/seeker-auth");
    await clearSeekerSession();
  } catch {
    // Seeker cookie is optional.
  }
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
