import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
import { id } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password is too long";
  return null;
}

export async function loginWithPassword(email: string, password: string) {
  await seedIfNeeded();
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
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

/**
 * Self-serve PT signup: creates studio (org) + owner user + membership, then signs in.
 */
export async function registerTrainer(input: {
  name: string;
  email: string;
  password: string;
  studioName: string;
  unitSystem?: string;
  timezone?: string;
  phone?: string;
  title?: string;
}) {
  await seedIfNeeded();
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const studioName = input.studioName.trim();
  const password = input.password;
  const phone = input.phone?.trim() || null;
  const title = input.title?.trim() || null;

  if (!name || name.length < 2) {
    return { error: "Enter your name (at least 2 characters)" as const };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address" as const };
  }
  const pwErr = validatePassword(password);
  if (pwErr) return { error: pwErr };
  if (!studioName || studioName.length < 2) {
    return { error: "Enter a studio name (at least 2 characters)" as const };
  }

  const unitSystem =
    input.unitSystem === "imperial" ? "imperial" : "metric";
  const timezone =
    (input.timezone || "").trim().slice(0, 64) || "UTC";

  const db = await getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return { error: "An account with this email already exists. Sign in instead." as const };
  }

  const orgId = id("org");
  const userId = id("user");
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  await db.insert(organizations).values({
    id: orgId,
    name: studioName,
    unitSystem,
    timezone,
  });
  await db.insert(users).values({
    id: userId,
    email,
    name,
    passwordHash,
    phone,
    title,
    isPlatformAdmin: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(memberships).values({
    id: id("mem"),
    userId,
    organizationId: orgId,
    role: "owner",
  });

  const payload = await buildSessionForUser(userId);
  if (!payload) {
    return { error: "Account created but sign-in failed — try logging in." as const };
  }
  const token = await createSessionToken(payload);
  await setSessionCookie(token);
  return { ok: true as const, session: payload };
}

export async function updateUserProfile(input: {
  name: string;
  email: string;
  phone?: string | null;
  title?: string | null;
}) {
  const session = await requireSession();
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const phone = input.phone?.trim() || null;
  const title = input.title?.trim() || null;

  if (!name || name.length < 2) {
    return { error: "Enter your name (at least 2 characters)" as const };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address" as const };
  }

  const db = await getDb();
  if (email !== session.email) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (taken && taken.id !== session.userId) {
      return { error: "That email is already in use" as const };
    }
  }

  await db
    .update(users)
    .set({
      name,
      email,
      phone,
      title,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.userId));

  const payload = await buildSessionForUser(session.userId);
  if (payload) {
    const token = await createSessionToken(payload);
    await setSessionCookie(token);
  }
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true as const };
}

export async function changeUserPassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  const session = await requireSession();
  const pwErr = validatePassword(input.newPassword);
  if (pwErr) return { error: pwErr };

  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return { error: "User not found" as const };

  const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!ok) return { error: "Current password is incorrect" as const };

  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, session.userId));

  return { ok: true as const };
}

export async function updateOrganizationProfile(input: {
  name: string;
  unitSystem?: string;
  timezone?: string;
}) {
  const session = await requireSession();
  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only studio owners can update organization settings" as const };
  }
  const name = input.name.trim();
  if (!name || name.length < 2) {
    return { error: "Enter a studio name" as const };
  }
  const unitSystem =
    input.unitSystem === "imperial" ? "imperial" : "metric";
  const timezone = (input.timezone || "UTC").trim().slice(0, 64) || "UTC";

  const db = await getDb();
  await db
    .update(organizations)
    .set({ name, unitSystem, timezone })
    .where(eq(organizations.id, session.organizationId));

  const payload = await buildSessionForUser(session.userId);
  if (payload) {
    const token = await createSessionToken(payload);
    await setSessionCookie(token);
  }
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true as const };
}

export async function getUserProfile() {
  const session = await requireSession();
  const db = await getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      title: users.title,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  return { session, user: user ?? null };
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
