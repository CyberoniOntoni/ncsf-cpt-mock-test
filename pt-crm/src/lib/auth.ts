import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { seedIfNeeded } from "@/db/seed";
import { memberships, organizations, users } from "@/db/schema";
import {
  clearSessionCookie,
  createSessionToken,
  readSession,
  setSessionCookie,
  type SessionPayload,
} from "@/lib/session";

export async function loginWithPassword(email: string, password: string) {
  await seedIfNeeded();
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  if (!user) return { error: "Invalid email or password" as const };

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "Invalid email or password" as const };

  const payload = await buildSessionForUser(user.id);
  if (!payload) return { error: "No organization membership" as const };

  const token = await createSessionToken(payload);
  await setSessionCookie(token);
  return { ok: true as const, session: payload };
}

async function buildSessionForUser(userId: string): Promise<SessionPayload | null> {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);
  if (!membership) return null;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, membership.organizationId))
    .limit(1);
  if (!org) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    organizationId: org.id,
    organizationName: org.name,
    role: membership.role,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}

/**
 * Prefer live membership/org from DB over JWT claims so inventory/CRM
 * still works after a DB wipe (stale cookie org ids).
 */
async function resolveLiveSession(
  cookie: SessionPayload
): Promise<SessionPayload | null> {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, cookie.userId))
    .limit(1);
  if (!user) return null;

  // Prefer membership matching cookie org if still valid
  if (cookie.organizationId) {
    const [m] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, user.id),
          eq(memberships.organizationId, cookie.organizationId)
        )
      )
      .limit(1);
    if (m) {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, m.organizationId))
        .limit(1);
      if (org) {
        return {
          userId: user.id,
          email: user.email,
          name: user.name,
          organizationId: org.id,
          organizationName: org.name,
          role: m.role,
          isPlatformAdmin: user.isPlatformAdmin,
        };
      }
    }
  }

  // Fall back to any membership (new DB after wipe)
  return buildSessionForUser(user.id);
}

export async function logout() {
  await clearSessionCookie();
}

export async function requireSession(): Promise<SessionPayload> {
  await seedIfNeeded();
  const cookie = await readSession();
  if (!cookie) {
    redirect("/login");
  }

  const live = await resolveLiveSession(cookie);
  if (!live) {
    // Cookie mutations are illegal in RSC — route handler clears JWT
    redirect("/api/auth/session-reset");
  }

  // Do not setSessionCookie here: RSC cannot mutate cookies.
  // Login / server actions refresh the token when needed.
  return live;
}

export async function getSessionOrNull() {
  try {
    await seedIfNeeded();
  } catch {
    // Allow login page to render even if seed races; login will re-seed.
  }
  const cookie = await readSession();
  if (!cookie) return null;
  let live: SessionPayload | null = null;
  try {
    live = await resolveLiveSession(cookie);
  } catch {
    return null;
  }
  if (!live) {
    // Stale JWT after DB wipe — clear cookie so middleware stops / ↔ /login bounce
    redirect("/api/auth/session-reset");
  }
  return live;
}

export async function verifyOrgAccess(organizationId: string, userId: string) {
  const db = await getDb();
  const [m] = await db
    .select()
    .from(memberships)
    .where(
      and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId))
    )
    .limit(1);
  return !!m;
}
