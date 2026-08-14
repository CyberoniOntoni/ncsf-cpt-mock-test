import bcrypt from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { seedIfNeeded } from "@/db/seed";
import {
  memberships,
  orgInvites,
  organizations,
  users,
} from "@/db/schema";
import {
  clearSessionCookie,
  createSessionToken,
  readSession,
  setSessionCookie,
  type SessionPayload,
} from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { inviteAbsoluteUrl, mailOrgInvite } from "@/lib/mail-copy";
import { id } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_DAYS = 14;
const INVITE_ROLES = ["trainer", "admin", "front_desk"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

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

async function assertEmailAvailable(email: string) {
  const db = await getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return !existing;
}

async function createUserAndSignIn(input: {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  title?: string | null;
  organizationId: string;
  role: string;
}) {
  const userId = id("user");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const now = new Date();
  const db = await getDb();
  await db.insert(users).values({
    id: userId,
    email: input.email,
    name: input.name,
    passwordHash,
    phone: input.phone ?? null,
    title: input.title ?? null,
    isPlatformAdmin: false,
    createdAt: now,
    updatedAt: now,
  });
  // emailVerifiedAt stays null — invite-accept marks it after insert
  await db.insert(memberships).values({
    id: id("mem"),
    userId,
    organizationId: input.organizationId,
    role: input.role,
  });
  const payload = await buildSessionForUser(userId);
  if (!payload) {
    return { error: "Account created but sign-in failed — try logging in." as const };
  }
  const token = await createSessionToken(payload);
  await setSessionCookie(token);
  return { ok: true as const, session: payload };
}

/**
 * Individual PT: solo practice org (kind=solo) + owner membership.
 */
export async function registerSoloTrainer(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  title?: string;
  practiceName?: string;
  unitSystem?: string;
  timezone?: string;
}) {
  await seedIfNeeded();
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;
  const phone = input.phone?.trim() || null;
  const title = input.title?.trim() || null;
  const practiceName =
    input.practiceName?.trim() ||
    (name ? `${name.split(/\s+/)[0]}'s practice` : "My practice");

  if (!name || name.length < 2) {
    return { error: "Enter your name (at least 2 characters)" as const };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address" as const };
  }
  const pwErr = validatePassword(password);
  if (pwErr) return { error: pwErr };

  if (!(await assertEmailAvailable(email))) {
    return {
      error: "An account with this email already exists. Sign in instead." as const,
    };
  }

  const unitSystem = input.unitSystem === "imperial" ? "imperial" : "metric";
  const timezone = (input.timezone || "").trim().slice(0, 64) || "UTC";
  const orgId = id("org");
  const db = await getDb();
  await db.insert(organizations).values({
    id: orgId,
    name: practiceName,
    kind: "solo",
    unitSystem,
    timezone,
  });
  return createUserAndSignIn({
    name,
    email,
    password,
    phone,
    title,
    organizationId: orgId,
    role: "owner",
  });
}

/**
 * Studio owner signup: multi-trainer org (kind=studio).
 */
export async function registerStudio(input: {
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

  if (!(await assertEmailAvailable(email))) {
    return {
      error: "An account with this email already exists. Sign in instead." as const,
    };
  }

  const unitSystem = input.unitSystem === "imperial" ? "imperial" : "metric";
  const timezone = (input.timezone || "").trim().slice(0, 64) || "UTC";
  const orgId = id("org");
  const db = await getDb();
  await db.insert(organizations).values({
    id: orgId,
    name: studioName,
    kind: "studio",
    unitSystem,
    timezone,
  });
  return createUserAndSignIn({
    name,
    email,
    password,
    phone,
    title,
    organizationId: orgId,
    role: "owner",
  });
}

/** @deprecated use registerStudio / registerSoloTrainer */
export async function registerTrainer(
  input: Parameters<typeof registerStudio>[0]
) {
  return registerStudio(input);
}

function parseInviteRole(raw: string): InviteRole {
  const r = raw.trim().toLowerCase();
  if (r === "admin" || r === "front_desk" || r === "trainer") return r;
  return "trainer";
}

export async function createOrgInvite(input: {
  email: string;
  role?: string;
}) {
  const session = await requireSession();
  if (!(await isUserEmailVerified(session.userId))) {
    return { error: "Verify your email before inviting teammates." as const };
  }
  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only owners and admins can invite team members" as const };
  }
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address" as const };
  }
  if (email === normalizeEmail(session.email)) {
    return { error: "You can't invite yourself" as const };
  }
  const role = parseInviteRole(input.role || "trainer");
  // Only owners may invite admins; admins can invite trainer / front_desk only
  if (role === "admin" && session.role !== "owner") {
    return { error: "Only owners can invite admins" as const };
  }

  const db = await getDb();
  // Already a member?
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingUser) {
    const [mem] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, existingUser.id),
          eq(memberships.organizationId, session.organizationId)
        )
      )
      .limit(1);
    if (mem) {
      return { error: "That person is already on this team" as const };
    }
  }

  // Revoke prior pending invites for same email+org
  await db
    .update(orgInvites)
    .set({ status: "revoked" })
    .where(
      and(
        eq(orgInvites.organizationId, session.organizationId),
        eq(orgInvites.email, email),
        eq(orgInvites.status, "pending")
      )
    );

  const inviteId = id("inv");
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(orgInvites).values({
    id: inviteId,
    organizationId: session.organizationId,
    email,
    role,
    token,
    invitedByUserId: session.userId,
    status: "pending",
    expiresAt,
  });

  // Solo practice becomes a studio once you invite someone
  await db
    .update(organizations)
    .set({ kind: "studio" })
    .where(
      and(
        eq(organizations.id, session.organizationId),
        eq(organizations.kind, "solo")
      )
    );

  const inviteUrl = inviteAbsoluteUrl(token);
  const copy = mailOrgInvite({
    orgName: session.organizationName,
    role,
    inviteUrl,
  });
  const { delivered } = await sendEmail({
    to: email,
    subject: copy.subject,
    text: copy.text,
    category: copy.category,
  });
  // Production delivery failure still keeps the invite + copy-link backup
  const emailed = delivered;

  revalidatePath("/settings");
  return {
    ok: true as const,
    inviteId,
    token,
    emailed,
    email,
    role,
    expiresAt,
  };
}

export async function revokeOrgInvite(inviteId: string) {
  const session = await requireSession();
  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only owners and admins can revoke invites" as const };
  }
  const db = await getDb();
  await db
    .update(orgInvites)
    .set({ status: "revoked" })
    .where(
      and(
        eq(orgInvites.id, inviteId),
        eq(orgInvites.organizationId, session.organizationId)
      )
    );
  revalidatePath("/settings");
  return { ok: true as const };
}

const ROLE_ORDER: Record<string, number> = {
  owner: 0,
  admin: 1,
  trainer: 2,
  front_desk: 3,
};

export async function listTeamMembers() {
  const session = await requireSession();
  const db = await getDb();
  const rows = await db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      title: users.title,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, session.organizationId));

  return rows.sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 9;
    const rb = ROLE_ORDER[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

export async function listPendingInvites() {
  const session = await requireSession();
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(orgInvites)
    .where(
      and(
        eq(orgInvites.organizationId, session.organizationId),
        eq(orgInvites.status, "pending")
      )
    )
    .orderBy(desc(orgInvites.createdAt));

  // Mark expired lazily
  const live = [];
  for (const r of rows) {
    if (r.expiresAt && new Date(r.expiresAt) < now) {
      await db
        .update(orgInvites)
        .set({ status: "expired" })
        .where(eq(orgInvites.id, r.id));
      continue;
    }
    live.push(r);
  }
  return live;
}

export async function getInviteByToken(token: string) {
  await seedIfNeeded();
  const db = await getDb();
  const [inv] = await db
    .select()
    .from(orgInvites)
    .where(eq(orgInvites.token, token.trim()))
    .limit(1);
  if (!inv) return null;

  let status = inv.status;
  if (
    inv.status === "pending" &&
    inv.expiresAt &&
    new Date(inv.expiresAt) < new Date()
  ) {
    await db
      .update(orgInvites)
      .set({ status: "expired" })
      .where(eq(orgInvites.id, inv.id));
    status = "expired";
  }

  const [org] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      kind: organizations.kind,
    })
    .from(organizations)
    .where(eq(organizations.id, inv.organizationId))
    .limit(1);

  return { ...inv, status, organization: org ?? null };
}

/**
 * Accept invite as a new user (register + join).
 */
export async function acceptInviteRegister(input: {
  token: string;
  name: string;
  password: string;
  phone?: string;
  title?: string;
}) {
  await seedIfNeeded();
  const invite = await getInviteByToken(input.token);
  if (!invite || !invite.organization) {
    return { error: "Invite not found" as const };
  }
  if (invite.status !== "pending") {
    return {
      error:
        invite.status === "expired"
          ? "This invite has expired — ask for a new one"
          : "This invite is no longer valid",
    } as const;
  }

  const name = input.name.trim();
  const email = normalizeEmail(invite.email);
  const pwErr = validatePassword(input.password);
  if (!name || name.length < 2) {
    return { error: "Enter your name (at least 2 characters)" as const };
  }
  if (pwErr) return { error: pwErr };

  if (!(await assertEmailAvailable(email))) {
    return {
      error:
        "An account with this email already exists. Sign in, then open the invite link again." as const,
    };
  }

  const result = await createUserAndSignIn({
    name,
    email,
    password: input.password,
    phone: input.phone?.trim() || null,
    title: input.title?.trim() || null,
    organizationId: invite.organizationId,
    role: invite.role || "trainer",
  });
  if ("error" in result && result.error) return result;
  // Opening the emailed invite is proof of inbox
  await markUserEmailVerified(result.session.userId);

  const db = await getDb();
  await db
    .update(orgInvites)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(orgInvites.id, invite.id));

  return result;
}

/**
 * Accept invite while signed in (email must match invite).
 */
export async function acceptInviteExistingUser(token: string) {
  const session = await requireSession();
  const invite = await getInviteByToken(token);
  if (!invite || !invite.organization) {
    return { error: "Invite not found" as const };
  }
  if (invite.status !== "pending") {
    return { error: "This invite is no longer valid" as const };
  }
  if (normalizeEmail(session.email) !== normalizeEmail(invite.email)) {
    return {
      error: `This invite is for ${invite.email}. Sign in with that email, or sign out and register.` as const,
    };
  }

  const db = await getDb();
  const [mem] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, session.userId),
        eq(memberships.organizationId, invite.organizationId)
      )
    )
    .limit(1);
  if (mem) {
    await db
      .update(orgInvites)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(orgInvites.id, invite.id));
  } else {
    await db.insert(memberships).values({
      id: id("mem"),
      userId: session.userId,
      organizationId: invite.organizationId,
      role: invite.role || "trainer",
    });
    await db
      .update(orgInvites)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(orgInvites.id, invite.id));
  }

  // Opening the emailed invite is inbox proof (same as acceptInviteRegister)
  await markUserEmailVerified(session.userId);

  // Switch session to the invited org (including alreadyMember path)
  const payload = await buildSessionForUserInOrg(
    session.userId,
    invite.organizationId
  );
  if (payload) {
    const t = await createSessionToken(payload);
    await setSessionCookie(t);
  }
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true as const, alreadyMember: !!mem };
}

async function buildSessionForUserInOrg(
  userId: string,
  organizationId: string
): Promise<SessionPayload | null> {
  const db = await getDb();
  const [row] = await db
    .select({
      user: users,
      membership: memberships,
      org: organizations,
    })
    .from(users)
    .innerJoin(
      memberships,
      and(
        eq(memberships.userId, users.id),
        eq(memberships.organizationId, organizationId)
      )
    )
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;

  return {
    userId: row.user.id,
    email: row.user.email,
    name: row.user.name,
    title: row.user.title ?? null,
    organizationId: row.org.id,
    organizationName: row.org.name,
    role: row.membership.role,
    isPlatformAdmin: row.user.isPlatformAdmin,
  };
}

export async function updateUserProfile(input: {
  name: string;
  email: string;
  phone?: string | null;
  title?: string | null;
  /** Required when changing email — verified against passwordHash */
  currentPassword?: string;
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
  let emailChanged = false;
  if (email !== normalizeEmail(session.email)) {
    const currentPassword = input.currentPassword ?? "";
    if (!currentPassword) {
      return {
        error: "Enter your current password to change email" as const,
      };
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!user) return { error: "User not found" as const };
    const pwOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!pwOk) {
      return { error: "Current password is incorrect" as const };
    }

    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (taken && taken.id !== session.userId) {
      return { error: "That email is already in use" as const };
    }
    emailChanged = normalizeEmail(email) !== normalizeEmail(user.email);
  }

  await db
    .update(users)
    .set({
      name,
      email,
      phone,
      title,
      updatedAt: new Date(),
      ...(emailChanged ? { emailVerifiedAt: null } : {}),
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
    return {
      error: "Only studio owners and admins can update organization settings" as const,
    };
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
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  return { session, user: user ?? null };
}

export async function markUserEmailVerified(userId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function isUserEmailVerified(userId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!row?.emailVerifiedAt;
}

async function buildSessionForUser(userId: string): Promise<SessionPayload | null> {
  const db = await getDb();
  const [row] = await db
    .select({
      user: users,
      membership: memberships,
      org: organizations,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;

  return {
    userId: row.user.id,
    email: row.user.email,
    name: row.user.name,
    title: row.user.title ?? null,
    organizationId: row.org.id,
    organizationName: row.org.name,
    role: row.membership.role,
    isPlatformAdmin: row.user.isPlatformAdmin,
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

  // Prefer membership matching cookie org if still valid
  if (cookie.organizationId) {
    const [row] = await db
      .select({
        user: users,
        membership: memberships,
        org: organizations,
      })
      .from(users)
      .innerJoin(
        memberships,
        and(
          eq(memberships.userId, users.id),
          eq(memberships.organizationId, cookie.organizationId)
        )
      )
      .innerJoin(
        organizations,
        eq(organizations.id, memberships.organizationId)
      )
      .where(eq(users.id, cookie.userId))
      .limit(1);

    if (row) {
      return {
        userId: row.user.id,
        email: row.user.email,
        name: row.user.name,
        title: row.user.title ?? null,
        organizationId: row.org.id,
        organizationName: row.org.name,
        role: row.membership.role,
        isPlatformAdmin: row.user.isPlatformAdmin,
      };
    }
  }

  // Fall back to any membership (new DB after wipe)
  return buildSessionForUser(cookie.userId);
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
