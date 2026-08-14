import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  clientAssessments,
  clientMeasurements,
  clients,
  organizations,
  seekerMeasurements,
  seekerProfiles,
} from "@/db/schema";
import { findTrainingArea } from "@/lib/marketplace/areas";
import { DEFAULT_RADIUS_KM } from "@/lib/marketplace/types";
import {
  isSeekerProfileComplete,
  safeSeekerNext,
} from "@/lib/seeker-profile";
import { id } from "@/lib/utils";

export { isSeekerProfileComplete, safeSeekerNext } from "@/lib/seeker-profile";

export const SEEKER_COOKIE = "seeker_session";
const SESSION_DAYS = 30;
const DEV_SEEKER_SECRET = "dev-only-change-me-floorscribe-seeker-secret";

export type SeekerSessionPayload = {
  role: "seeker";
  seekerId: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type SeekerPublic = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  city: string | null;
  preferredArea: string | null;
  radiusKm: number;
  preferredFacilityId: string | null;
  preferredBrand: string | null;
};

function seekerSecret(): Uint8Array {
  const s = process.env.CLIENT_AUTH_SECRET || "";
  if (process.env.NODE_ENV === "production") {
    if (!s || s.length < 24) {
      throw new Error(
        "CLIENT_AUTH_SECRET is missing or weak in production. Set a long random secret (≥24 characters)."
      );
    }
    return new TextEncoder().encode(s);
  }
  return new TextEncoder().encode(s || DEV_SEEKER_SECRET);
}

export function normalizeSeekerEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

function toPublic(row: typeof seekerProfiles.$inferSelect): SeekerPublic {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    city: row.city,
    preferredArea: row.preferredArea,
    radiusKm: row.radiusKm,
    preferredFacilityId: row.preferredFacilityId,
    preferredBrand: row.preferredBrand,
  };
}

export async function registerSeeker(opts: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
}): Promise<{ ok: true; seeker: SeekerPublic } | { ok: false; error: string }> {
  const email = normalizeSeekerEmail(opts.email);
  const firstName = opts.firstName.trim();
  if (!firstName || !email.includes("@")) {
    return { ok: false, error: "Enter your name and a valid email." };
  }
  if (!opts.password || opts.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  const db = await getDb();
  const [existing] = await db
    .select({ id: seekerProfiles.id })
    .from(seekerProfiles)
    .where(eq(seekerProfiles.email, email))
    .limit(1);
  if (existing) return { ok: false, error: "An account with that email already exists." };

  const passwordHash = await bcrypt.hash(opts.password, 10);
  const seekerId = id("sk");
  await db.insert(seekerProfiles).values({
    id: seekerId,
    email,
    passwordHash,
    firstName,
    lastName: (opts.lastName || "").trim(),
    radiusKm: DEFAULT_RADIUS_KM,
  });
  const [row] = await db
    .select()
    .from(seekerProfiles)
    .where(eq(seekerProfiles.id, seekerId))
    .limit(1);
  return { ok: true, seeker: toPublic(row!) };
}

/** Create a seeker row for an assigned client who signed in with a code. */
export async function ensureSeekerForPerson(opts: {
  email: string;
  firstName: string;
  lastName?: string;
}): Promise<SeekerPublic> {
  const email = normalizeSeekerEmail(opts.email);
  const existing = await getSeekerByEmail(email);
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(randomPlaceholderPassword(), 10);
  const seekerId = id("sk");
  const db = await getDb();
  await db.insert(seekerProfiles).values({
    id: seekerId,
    email,
    passwordHash,
    firstName: (opts.firstName || "Client").trim() || "Client",
    lastName: (opts.lastName || "").trim(),
    radiusKm: DEFAULT_RADIUS_KM,
  });
  const [row] = await db
    .select()
    .from(seekerProfiles)
    .where(eq(seekerProfiles.id, seekerId))
    .limit(1);
  return toPublic(row!);
}

function randomPlaceholderPassword() {
  return `otp-${Math.random().toString(36).slice(2)}${Date.now()}`;
}

export async function getSeekerByEmail(email: string): Promise<SeekerPublic | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(seekerProfiles)
    .where(eq(seekerProfiles.email, normalizeSeekerEmail(email)))
    .limit(1);
  return row ? toPublic(row) : null;
}

export async function verifySeekerLogin(opts: {
  email: string;
  password: string;
}): Promise<{ ok: true; seeker: SeekerPublic } | { ok: false; error: string }> {
  const email = normalizeSeekerEmail(opts.email);
  const db = await getDb();
  const [row] = await db
    .select()
    .from(seekerProfiles)
    .where(eq(seekerProfiles.email, email))
    .limit(1);
  if (!row) return { ok: false, error: "Email or password is incorrect." };
  const match = await bcrypt.compare(opts.password, row.passwordHash);
  if (!match) return { ok: false, error: "Email or password is incorrect." };
  return { ok: true, seeker: toPublic(row) };
}

export async function updateSeekerPrefs(
  seekerId: string,
  prefs: {
    firstName?: string;
    lastName?: string;
    city?: string | null;
    preferredArea?: string | null;
    lat?: number | null;
    lng?: number | null;
    radiusKm?: number;
    preferredFacilityId?: string | null;
    preferredBrand?: string | null;
  }
): Promise<SeekerPublic> {
  const area = findTrainingArea(prefs.preferredArea);
  const db = await getDb();
  await db
    .update(seekerProfiles)
    .set({
      ...(prefs.firstName != null ? { firstName: prefs.firstName.trim() } : {}),
      ...(prefs.lastName != null ? { lastName: prefs.lastName.trim() } : {}),
      ...(prefs.preferredArea !== undefined
        ? {
            preferredArea: area?.slug ?? null,
            city: area?.city ?? prefs.city ?? null,
            lat: area?.lat ?? null,
            lng: area?.lng ?? null,
          }
        : {
            ...(prefs.city !== undefined ? { city: prefs.city } : {}),
            ...(prefs.lat !== undefined ? { lat: prefs.lat } : {}),
            ...(prefs.lng !== undefined ? { lng: prefs.lng } : {}),
          }),
      ...(prefs.radiusKm != null ? { radiusKm: prefs.radiusKm } : {}),
      ...(prefs.preferredFacilityId !== undefined
        ? { preferredFacilityId: prefs.preferredFacilityId || null }
        : {}),
      ...(prefs.preferredBrand !== undefined
        ? { preferredBrand: prefs.preferredBrand || null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(seekerProfiles.id, seekerId));
  const [row] = await db
    .select()
    .from(seekerProfiles)
    .where(eq(seekerProfiles.id, seekerId))
    .limit(1);
  return toPublic(row!);
}

export async function addSeekerMeasurement(
  seekerId: string,
  meas: {
    heightCm?: number | null;
    weightKg?: number | null;
    waistCm?: number | null;
    notes?: string | null;
  }
) {
  const db = await getDb();
  const rowId = id("skm");
  await db.insert(seekerMeasurements).values({
    id: rowId,
    seekerId,
    heightCm: meas.heightCm ?? null,
    weightKg: meas.weightKg ?? null,
    waistCm: meas.waistCm ?? null,
    notes: meas.notes ?? null,
  });
  return rowId;
}

export async function listSeekerMeasurements(seekerId: string, limit = 20) {
  const db = await getDb();
  return db
    .select({
      id: seekerMeasurements.id,
      takenAt: seekerMeasurements.takenAt,
      heightCm: seekerMeasurements.heightCm,
      weightKg: seekerMeasurements.weightKg,
      waistCm: seekerMeasurements.waistCm,
      notes: seekerMeasurements.notes,
      source: sql<"self">`'self'`.as("source"),
    })
    .from(seekerMeasurements)
    .where(eq(seekerMeasurements.seekerId, seekerId))
    .orderBy(desc(seekerMeasurements.takenAt))
    .limit(limit);
}

export async function listLinkedTrainerProgress(email: string) {
  const db = await getDb();
  const rows = await db
    .select({
      clientId: clients.id,
      organizationId: clients.organizationId,
      organizationName: organizations.name,
      status: clients.status,
    })
    .from(clients)
    .innerJoin(organizations, eq(organizations.id, clients.organizationId))
    .where(sql`lower(coalesce(${clients.email}, '')) = ${normalizeSeekerEmail(email)}`);

  const progress: Array<{
    organizationName: string;
    measurements: Array<{
      id: string;
      takenAt: Date;
      weightKg: number | null;
      waistCm: number | null;
    }>;
    assessments: Array<{
      id: string;
      takenAt: Date;
      summary: string | null;
    }>;
  }> = [];

  for (const row of rows) {
    const measurements = await db
      .select({
        id: clientMeasurements.id,
        takenAt: clientMeasurements.takenAt,
        weightKg: clientMeasurements.weightKg,
        waistCm: clientMeasurements.waistCm,
      })
      .from(clientMeasurements)
      .where(eq(clientMeasurements.clientId, row.clientId))
      .orderBy(desc(clientMeasurements.takenAt))
      .limit(8);
    const assessments = await db
      .select({
        id: clientAssessments.id,
        takenAt: clientAssessments.takenAt,
        summary: clientAssessments.summary,
      })
      .from(clientAssessments)
      .where(eq(clientAssessments.clientId, row.clientId))
      .orderBy(desc(clientAssessments.takenAt))
      .limit(6);
    progress.push({
      organizationName: row.organizationName,
      measurements,
      assessments,
    });
  }
  return progress;
}

export async function issueSeekerSession(seeker: SeekerPublic) {
  const jwt = await new SignJWT({
    role: "seeker",
    seekerId: seeker.id,
    email: seeker.email,
    firstName: seeker.firstName,
    lastName: seeker.lastName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(seekerSecret());
  const jar = await cookies();
  jar.set(SEEKER_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
  const { issuePortalSession, persistStudioSession, studioProvenByOtp } =
    await import("@/lib/client-auth");
  const studio = await studioProvenByOtp(seeker.email);
  if (studio) {
    await persistStudioSession({
      seekerId: seeker.id,
      email: seeker.email,
      firstName: seeker.firstName,
      lastName: seeker.lastName,
      studio,
    });
    return;
  }
  await issuePortalSession({
    seekerId: seeker.id,
    email: seeker.email,
    firstName: seeker.firstName,
    lastName: seeker.lastName,
  });
}

export async function clearSeekerSession() {
  const jar = await cookies();
  jar.set(SEEKER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function optionalSeekerSession(): Promise<SeekerSessionPayload | null> {
  const { readClientSession } = await import("@/lib/client-auth");
  const portal = await readClientSession();
  if (portal?.seekerId) {
    return {
      role: "seeker",
      seekerId: portal.seekerId,
      email: portal.email,
      firstName: portal.firstName,
      lastName: portal.lastName,
    };
  }
  const jar = await cookies();
  const token = jar.get(SEEKER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, seekerSecret());
    if (payload.role !== "seeker" || !payload.seekerId) return null;
    return {
      role: "seeker",
      seekerId: String(payload.seekerId),
      email: String(payload.email || ""),
      firstName: String(payload.firstName || ""),
      lastName: String(payload.lastName || ""),
    };
  } catch {
    return null;
  }
}

export async function requireSeekerSession(
  nextPath = "/portal/profile"
): Promise<SeekerSessionPayload> {
  const s = await optionalSeekerSession();
  if (!s) {
    const next = safeSeekerNext(nextPath);
    redirect(`/portal/login?next=${encodeURIComponent(next)}`);
  }
  return s;
}

export async function requireCompleteSeeker(nextPath?: string): Promise<{
  session: SeekerSessionPayload;
  seeker: SeekerPublic;
}> {
  const dest = safeSeekerNext(nextPath);
  const session = await optionalSeekerSession();
  if (!session) {
    redirect(`/portal/register?next=${encodeURIComponent(dest)}`);
  }
  const seeker = await getSeekerById(session.seekerId);
  if (!seeker || !isSeekerProfileComplete(seeker)) {
    redirect("/portal/profile?setup=1");
  }
  return { session, seeker };
}

export async function getSeekerById(seekerId: string): Promise<SeekerPublic | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(seekerProfiles)
    .where(eq(seekerProfiles.id, seekerId))
    .limit(1);
  return row ? toPublic(row) : null;
}
