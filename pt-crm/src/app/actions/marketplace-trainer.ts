"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { getDb } from "@/db";
import {
  ensureGymFacilities,
  listPublicGyms,
} from "@/db/queries/marketplace";
import {
  clients,
  gymFacilities,
  introRequests,
  marketplaceProfileFacilities,
  marketplaceProfiles,
  platformCharges,
  users,
} from "@/db/schema";
import { findTrainingArea } from "@/lib/marketplace/areas";

import { introFeeDecision } from "@/lib/marketplace/fees";
import {
  FEATURED_FEE_CENTS,
  INTRO_FEE_CENTS,
} from "@/lib/marketplace/types";
import {
  createPlatformCheckoutSession,
} from "@/lib/marketplace/stripe-platform";
import { sendEmail } from "@/lib/email";
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

export async function getMyMarketplaceListingAction() {
  const session = await requireSession();
  const db = await getDb();
  const [profile] = await db
    .select()
    .from(marketplaceProfiles)
    .where(
      and(
        eq(marketplaceProfiles.userId, session.userId),
        eq(marketplaceProfiles.organizationId, session.organizationId)
      )
    )
    .limit(1);
  const gyms = await listPublicGyms();
  let facilityIds: string[] = [];
  if (profile) {
    const links = await db
      .select()
      .from(marketplaceProfileFacilities)
      .where(eq(marketplaceProfileFacilities.profileId, profile.id));
    facilityIds = links.map((l) => l.facilityId);
  }
  const dueIntroCharges = await db
    .select({
      id: platformCharges.id,
      amountCents: platformCharges.amountCents,
    })
    .from(platformCharges)
    .where(
      and(
        eq(platformCharges.organizationId, session.organizationId),
        eq(platformCharges.kind, "intro_accept"),
        eq(platformCharges.status, "due")
      )
    );
  return {
    profile: profile
      ? {
          id: profile.id,
          headline: profile.headline,
          bio: profile.bio,
          credentials: profile.credentials,
          specialties: profile.specialties,
          hourlyRateCents: profile.hourlyRateCents,
          sessionRateCents: profile.sessionRateCents,
          currency: profile.currency,
          preferredArea: profile.preferredArea,
          city: profile.city,
          radiusKm: profile.radiusKm,
          published: profile.published,
          featuredUntil: profile.featuredUntil,
          facilityIds,
          serviceModes: profile.serviceModes,
        }
      : null,
    gyms: gyms.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      brand: g.brand,
      independent: g.independent,
    })),
    dueIntroCharges,
  };
}

export async function saveMarketplaceListingAction(input: {
  headline: string;
  bio: string;
  credentials: string;
  specialties: string;
  hourlyRateCents: number | null;
  sessionRateCents: number | null;
  currency: string;
  preferredArea: string | null;
  radiusKm: number;
  published: boolean;
  facilityIds: string[];
  serviceModes: string;
}): Promise<{ ok: true; profileId: string } | { ok: false; error: string }> {
  try {
    const session = await requireSession();
    const { profileId } = await upsertMarketplaceListing({
      organizationId: session.organizationId,
      userId: session.userId,
      ...input,
    });
    if (input.credentials.trim()) {
      const db = await getDb();
      await db
        .update(users)
        .set({ title: input.credentials.trim(), updatedAt: new Date() })
        .where(eq(users.id, session.userId));
    }
    revalidatePath("/card");
    revalidatePath("/find");
    revalidatePath("/intros");
    return { ok: true, profileId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save listing",
    };
  }
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

  await sendEmail({
    to: email,
    subject: "Your FloorScribe intro was accepted",
    text: `${intro.seekerName.split(" ")[0]}, a trainer accepted your intro. They’ll reach out. You can use /portal/login with this email after they activate you. FloorScribe introduces you; session payments are with the trainer.`,
  });

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
  await sendEmail({
    to: intro.seekerEmail,
    subject: "Update on your trainer intro",
    text: "The trainer couldn’t take this intro right now. You can search again at /find.",
  });
  return { ok: true };
}

export async function acceptIntroAction(introId: string) {
  const session = await requireSession();
  const result = await acceptIntroRequest({
    introId,
    organizationId: session.organizationId,
    actorUserId: session.userId,
  });
  revalidatePath("/intros");
  revalidatePath("/clients");
  return result;
}

export async function declineIntroAction(introId: string) {
  const session = await requireSession();
  const result = await declineIntroRequest({
    introId,
    organizationId: session.organizationId,
  });
  revalidatePath("/intros");
  return result;
}

export async function startPlatformCheckoutAction(input: {
  kind: "intro_accept" | "featured_month";
  chargeId?: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const session = await requireSession();
    const db = await getDb();
    const origin =
      (process.env.APP_URL || "").replace(/\/$/, "") || "http://127.0.0.1:4000";
    let chargeId = input.chargeId;
    let amountCents = INTRO_FEE_CENTS;
    if (input.kind === "featured_month") {
      const [profile] = await db
        .select()
        .from(marketplaceProfiles)
        .where(
          and(
            eq(marketplaceProfiles.userId, session.userId),
            eq(marketplaceProfiles.organizationId, session.organizationId)
          )
        )
        .limit(1);
      if (!profile) return { ok: false, error: "Publish a listing first" };
      chargeId = id("chg");
      amountCents = FEATURED_FEE_CENTS;
      await db.insert(platformCharges).values({
        id: chargeId,
        organizationId: session.organizationId,
        kind: "featured_month",
        profileId: profile.id,
        amountCents,
        status: "due",
      });
    } else if (!chargeId) {
      return { ok: false, error: "Missing charge" };
    } else {
      const [chg] = await db
        .select()
        .from(platformCharges)
        .where(eq(platformCharges.id, chargeId))
        .limit(1);
      if (!chg || chg.organizationId !== session.organizationId) {
        return { ok: false, error: "Charge not found" };
      }
      if (chg.status !== "due") return { ok: false, error: "Charge is not due" };
      amountCents = chg.amountCents;
    }

    const checkout = await createPlatformCheckoutSession({
      chargeId: chargeId!,
      amountCents,
      currency: "usd",
      successUrl: `${origin}/card?paid=1`,
      cancelUrl: `${origin}/card?paid=0`,
    });
    await db
      .update(platformCharges)
      .set({
        stripeCheckoutSessionId: checkout.id,
        paymentUrl: checkout.url,
      })
      .where(eq(platformCharges.id, chargeId!));
    return { ok: true, url: checkout.url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Checkout failed",
    };
  }
}

export async function listOrgIntrosAction() {
  const session = await requireSession();
  return listOrgIntros(session.organizationId);
}
