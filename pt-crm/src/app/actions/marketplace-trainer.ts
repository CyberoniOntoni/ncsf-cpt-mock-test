"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isUserEmailVerified, requireSession } from "@/lib/auth";
import { getDb } from "@/db";
import { listPublicGyms } from "@/db/queries/marketplace";
import {
  marketplaceProfileFacilities,
  marketplaceProfiles,
  platformCharges,
  users,
} from "@/db/schema";
import {
  FEATURED_FEE_CENTS,
  INTRO_FEE_CENTS,
} from "@/lib/marketplace/types";
import {
  createPlatformCheckoutSession,
} from "@/lib/marketplace/stripe-platform";
import {
  acceptIntroRequest,
  declineIntroRequest,
  listOrgIntros,
  upsertMarketplaceListing,
} from "@/lib/marketplace/trainer-ops";
import { id } from "@/lib/utils";

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
    if (input.published && !(await isUserEmailVerified(session.userId))) {
      return {
        ok: false,
        error: "Verify your email before publishing your card.",
      };
    }
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
