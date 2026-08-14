import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureGymFacilities } from "@/db/queries/marketplace";
import {
  clients,
  gymFacilities,
  introRequests,
  marketplaceProfileFacilities,
  marketplaceProfiles,
  platformCharges,
} from "@/db/schema";
import { findTrainingArea } from "@/lib/marketplace/areas";
import { introFeeDecision } from "@/lib/marketplace/fees";
import { INTRO_FEE_CENTS } from "@/lib/marketplace/types";
import { sendEmail } from "@/lib/email";
import { mailIntroAccepted, mailIntroDeclined } from "@/lib/mail-copy";
import { id } from "@/lib/utils";

export async function upsertMarketplaceListing(opts: {
  organizationId: string;
  userId: string;
  headline: string;
  bio: string;
  credentials: string;
  specialties: string;
  hourlyRateCents: number | null;
  sessionRateCents: number | null;
  currency: string;
  preferredArea: string | null;
  city?: string;
  lat?: number | null;
  lng?: number | null;
  radiusKm: number;
  published: boolean;
  facilityIds: string[];
  serviceModes: string;
}): Promise<{ profileId: string }> {
  if (opts.published && !opts.headline.trim()) {
    throw new Error("Headline is required to publish");
  }
  const area = findTrainingArea(opts.preferredArea);
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(marketplaceProfiles)
    .where(
      and(
        eq(marketplaceProfiles.userId, opts.userId),
        eq(marketplaceProfiles.organizationId, opts.organizationId)
      )
    )
    .limit(1);

  const profileId = existing?.id || id("mp");
  const row = {
    headline: opts.headline.trim(),
    bio: opts.bio,
    credentials: opts.credentials.trim(),
    specialties: opts.specialties,
    hourlyRateCents: opts.hourlyRateCents,
    sessionRateCents: opts.sessionRateCents,
    currency: opts.currency || "SGD",
    preferredArea: area?.slug ?? null,
    city: area?.city ?? opts.city ?? "",
    region: area?.label ?? null,
    lat: area?.lat ?? opts.lat ?? null,
    lng: area?.lng ?? opts.lng ?? null,
    radiusKm: opts.radiusKm,
    published: opts.published,
    serviceModes: opts.serviceModes,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(marketplaceProfiles)
      .set(row)
      .where(eq(marketplaceProfiles.id, profileId));
  } else {
    await db.insert(marketplaceProfiles).values({
      id: profileId,
      organizationId: opts.organizationId,
      userId: opts.userId,
      ...row,
    });
  }

  await db
    .delete(marketplaceProfileFacilities)
    .where(eq(marketplaceProfileFacilities.profileId, profileId));
  const unique = [...new Set(opts.facilityIds)].slice(0, 8);
  await ensureGymFacilities(unique);
  for (const facilityId of unique) {
    const [gym] = await db
      .select({ id: gymFacilities.id })
      .from(gymFacilities)
      .where(eq(gymFacilities.id, facilityId))
      .limit(1);
    if (!gym) continue;
    await db.insert(marketplaceProfileFacilities).values({
      id: id("mpf"),
      profileId,
      facilityId,
    });
  }
  return { profileId };
}

export async function listOrgIntros(organizationId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(introRequests)
    .where(eq(introRequests.organizationId, organizationId))
    .orderBy(desc(introRequests.createdAt));
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    seekerName: r.seekerName,
    seekerEmail: r.seekerEmail,
    seekerPhone: r.seekerPhone,
    facilityId: r.facilityId,
    message: r.message,
    createdAt: r.createdAt,
    acceptedClientId: r.acceptedClientId,
  }));
}

export async function acceptIntroRequest(opts: {
  introId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<
  | {
      ok: true;
      clientId: string;
      charge:
        | { status: "waived" }
        | { status: "due"; chargeId: string; amountCents: number };
    }
  | { ok: false; error: "not_found" | "not_pending" | "forbidden" }
> {
  const db = await getDb();
  const [intro] = await db
    .select()
    .from(introRequests)
    .where(eq(introRequests.id, opts.introId))
    .limit(1);
  if (!intro) return { ok: false, error: "not_found" };
  if (intro.organizationId !== opts.organizationId) {
    return { ok: false, error: "forbidden" };
  }
  if (intro.status !== "pending") return { ok: false, error: "not_pending" };

  const email = intro.seekerEmail.trim().toLowerCase();
  const parts = intro.seekerName.trim().split(/\s+/);
  const firstName = parts[0] || "Client";
  const lastName = parts.slice(1).join(" ");

  const existingClients = await db
    .select()
    .from(clients)
    .where(eq(clients.organizationId, opts.organizationId));
  const match = existingClients.find(
    (c) => (c.email || "").toLowerCase() === email
  );
  let clientId = match?.id;
  if (!clientId) {
    clientId = id("cli");
    await db.insert(clients).values({
      id: clientId,
      organizationId: opts.organizationId,
      status: "lead",
      firstName,
      lastName,
      email,
      phone: intro.seekerPhone,
      goals: intro.message
        ? `Marketplace intro: ${intro.message}`
        : "Marketplace intro",
    });
  }

  await db
    .update(introRequests)
    .set({
      status: "accepted",
      acceptedClientId: clientId,
      respondedAt: new Date(),
    })
    .where(eq(introRequests.id, intro.id));

  const accepted = await db
    .select()
    .from(introRequests)
    .where(
      and(
        eq(introRequests.organizationId, opts.organizationId),
        eq(introRequests.status, "accepted")
      )
    );
  const priorAccepted = accepted.filter((r) => r.id !== intro.id).length;
  const dueCharges = await db
    .select()
    .from(platformCharges)
    .where(
      and(
        eq(platformCharges.organizationId, opts.organizationId),
        eq(platformCharges.kind, "intro_accept"),
        eq(platformCharges.status, "due")
      )
    );
  const decision = introFeeDecision({
    acceptedIntroCountForOrg: priorAccepted,
    unpaidIntroCharges: dueCharges.length,
  });

  let charge:
    | { status: "waived" }
    | { status: "due"; chargeId: string; amountCents: number };
  const chargeId = id("chg");
  if (decision.action === "waive" || decision.action === "hide_listing") {
    await db.insert(platformCharges).values({
      id: chargeId,
      organizationId: opts.organizationId,
      kind: "intro_accept",
      introRequestId: intro.id,
      amountCents: 0,
      status: "waived",
    });
    charge = { status: "waived" };
  } else {
    await db.insert(platformCharges).values({
      id: chargeId,
      organizationId: opts.organizationId,
      kind: "intro_accept",
      introRequestId: intro.id,
      amountCents: INTRO_FEE_CENTS,
      status: "due",
    });
    charge = { status: "due", chargeId, amountCents: INTRO_FEE_CENTS };
  }

  const acceptedCopy = mailIntroAccepted({
    firstName: intro.seekerName.split(" ")[0],
  });
  const acceptedSend = await sendEmail({
    to: email,
    subject: acceptedCopy.subject,
    text: acceptedCopy.text,
    category: acceptedCopy.category,
  });
  if (!acceptedSend.delivered) {
    console.warn(
      `[intro] accept notify not delivered introId=${intro.id} to=${email}`
    );
  }

  return { ok: true, clientId, charge };
}

export async function declineIntroRequest(opts: {
  introId: string;
  organizationId: string;
}): Promise<{ ok: true } | { ok: false; error: "not_found" | "not_pending" }> {
  const db = await getDb();
  const [intro] = await db
    .select()
    .from(introRequests)
    .where(eq(introRequests.id, opts.introId))
    .limit(1);
  if (!intro) return { ok: false, error: "not_found" };
  if (intro.organizationId !== opts.organizationId) {
    return { ok: false, error: "not_found" };
  }
  if (intro.status !== "pending") return { ok: false, error: "not_pending" };
  await db
    .update(introRequests)
    .set({ status: "declined", respondedAt: new Date() })
    .where(eq(introRequests.id, intro.id));
  const declinedCopy = mailIntroDeclined();
  const declinedSend = await sendEmail({
    to: intro.seekerEmail,
    subject: declinedCopy.subject,
    text: declinedCopy.text,
    category: declinedCopy.category,
  });
  if (!declinedSend.delivered) {
    console.warn(
      `[intro] decline notify not delivered introId=${intro.id} to=${intro.seekerEmail}`
    );
  }
  return { ok: true };
}
