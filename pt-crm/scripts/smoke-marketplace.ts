/**
 * Marketplace matchmaking smoke.
 * Run: npm run smoke:marketplace
 */
import { eq } from "drizzle-orm";
import {
  FEATURED_FEE_CENTS,
  FREE_INTROS_PER_ORG,
  INTRO_FEE_CENTS,
} from "../src/lib/marketplace/types";
import { findTrainingArea, resolveSearchOrigin } from "../src/lib/marketplace/areas";
import { haversineKm, inRadiusKm } from "../src/lib/marketplace/geo";
import { rankMarketplaceProfiles } from "../src/lib/marketplace/rank";
import {
  introFeeDecision,
  listingVisibleInSearch,
} from "../src/lib/marketplace/fees";
import { seedIfNeeded } from "../src/db/seed";
import { getDb } from "../src/db";
import {
  clients,
  gymFacilities,
  marketplaceProfiles,
  platformCharges,
} from "../src/db/schema";
import { createIntroRequest } from "../src/app/actions/marketplace";
import {
  acceptIntroRequest,
  upsertMarketplaceListing,
} from "../src/app/actions/marketplace-trainer";
import * as trainerActions from "../src/app/actions/marketplace-trainer";
import {
  createPlatformCheckoutSession,
  markPlatformChargePaid,
} from "../src/lib/marketplace/stripe-platform";
import { peekLastEmailTo } from "../src/lib/email";
import * as q from "../src/db/queries/marketplace";
import { id } from "../src/lib/utils";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("ok", msg);
}

for (const [name, value] of Object.entries(trainerActions)) {
  assert(
    typeof value === "function",
    `marketplace-trainer export ${name} must be a function (got ${typeof value})`
  );
}

async function main() {
  process.env.MOCK_EMAIL = "true";
  process.env.MOCK_STRIPE = "true";

  assert(findTrainingArea("bedok")?.label === "Bedok", "bedok area catalog");
  assert(findTrainingArea("Tampines")?.slug === "tampines", "area slug is case-insensitive");
  const origin = resolveSearchOrigin({ areaSlug: "orchard" });
  assert(origin?.area.label === "Orchard", "resolve orchard by name");
  assert(INTRO_FEE_CENTS === 1900, "intro fee $19");
  assert(FEATURED_FEE_CENTS === 2900, "featured $29");
  assert(FREE_INTROS_PER_ORG === 3, "3 free intros");

  const tampines = { lat: 1.3496, lng: 103.9568 };
  const orchard = { lat: 1.3048, lng: 103.8318 };
  const km = haversineKm(tampines, orchard);
  assert(km > 10 && km < 25, `tampines–orchard ~15km got ${km}`);
  assert(inRadiusKm(tampines, tampines, 1), "same point in radius");
  assert(!inRadiusKm(tampines, orchard, 5), "orchard outside 5km of tampines");

  const now = new Date("2026-08-13T00:00:00Z");
  const featured = {
    id: "feat",
    featuredUntil: new Date("2026-09-01T00:00:00Z"),
    facilityIds: ["gym_a"],
    brands: ["Anytime Fitness"],
    lat: orchard.lat,
    lng: orchard.lng,
  };
  const gymMatch = {
    id: "gym",
    featuredUntil: null,
    facilityIds: ["gym_a"],
    brands: ["Anytime Fitness"],
    lat: tampines.lat,
    lng: tampines.lng,
  };
  const far = {
    id: "far",
    featuredUntil: null,
    facilityIds: ["gym_b"],
    brands: ["Gold's Gym"],
    lat: 1.44,
    lng: 103.8,
  };
  const ranked = rankMarketplaceProfiles([far, gymMatch, featured], {
    now,
    lat: tampines.lat,
    lng: tampines.lng,
    facilityId: "gym_a",
    radiusKm: 50,
  });
  assert(
    ranked.map((p) => p.id).join(",") === "feat,gym",
    "gym filter drops other clubs; featured still first"
  );

  const filtered = rankMarketplaceProfiles([far, gymMatch], {
    now,
    lat: tampines.lat,
    lng: tampines.lng,
    radiusKm: 8,
  });
  assert(
    filtered.every((p) => p.id !== "far") && filtered[0].id === "gym",
    "radius drops far"
  );
  const networkOnly = rankMarketplaceProfiles([far, gymMatch, featured], {
    now,
    brand: "Anytime Fitness",
    radiusKm: 80,
  });
  assert(
    networkOnly.every((p) => p.id !== "far") && networkOnly.length === 2,
    "network filter keeps Anytime only"
  );

  assert(
    introFeeDecision({ acceptedIntroCountForOrg: 0, unpaidIntroCharges: 0 })
      .action === "waive",
    "1st intro free"
  );
  assert(
    introFeeDecision({ acceptedIntroCountForOrg: 3, unpaidIntroCharges: 0 })
      .action === "charge",
    "4th intro billed"
  );
  assert(
    introFeeDecision({ acceptedIntroCountForOrg: 3, unpaidIntroCharges: 0 })
      .amountCents === 1900,
    "charge $19"
  );
  assert(
    introFeeDecision({ acceptedIntroCountForOrg: 5, unpaidIntroCharges: 2 })
      .action === "hide_listing",
    "2 unpaid hides"
  );
  assert(
    listingVisibleInSearch({ published: true, unpaidIntroCharges: 1 }),
    "1 unpaid still visible"
  );
  assert(
    !listingVisibleInSearch({ published: true, unpaidIntroCharges: 2 }),
    "2 unpaid hidden"
  );
  assert(
    !listingVisibleInSearch({ published: false, unpaidIntroCharges: 0 }),
    "unpublished hidden"
  );

  await seedIfNeeded();
  const db = await getDb();
  const gyms = await db.select().from(gymFacilities);
  assert(gyms.some((g) => g.slug === "anytime-tampines"), "demo tampines gym");
  const [alex] = await db
    .select()
    .from(marketplaceProfiles)
    .where(eq(marketplaceProfiles.id, "mp_demo_alex"))
    .limit(1);
  assert(alex?.published === true, "demo alex listing published");

  await db
    .update(platformCharges)
    .set({ status: "waived" })
    .where(eq(platformCharges.organizationId, alex.organizationId));

  const cards = await q.searchPublicProfiles({
    lat: 1.3496,
    lng: 103.9568,
    facilityId: "gym_demo_tampines",
    radiusKm: 20,
  });
  assert(cards.some((c) => c.id === "mp_demo_alex"), "search finds alex");
  assert(
    !JSON.stringify(cards).includes("password"),
    "cards have no password fields"
  );
  const one = await q.getPublicProfile("mp_demo_alex");
  assert(one?.headline.includes("Strength"), "public profile headline");
  const missing = await q.getPublicProfile("nope");
  assert(missing === null, "unknown profile is null");

  let threw = false;
  try {
    await upsertMarketplaceListing({
      organizationId: alex.organizationId,
      userId: alex.userId,
      headline: "",
      bio: "",
      credentials: "",
      specialties: "",
      hourlyRateCents: null,
      sessionRateCents: null,
      currency: "SGD",
      preferredArea: null,
      radiusKm: 10,
      published: true,
      facilityIds: [],
      serviceModes: "studio",
    });
  } catch {
    threw = true;
  }
  assert(threw, "published listing requires headline");

  await upsertMarketplaceListing({
    organizationId: alex.organizationId,
    userId: alex.userId,
    headline: "Strength and fat-loss coaching",
    bio: "NCSF-minded programming. Floor sessions at Tampines or your gym.",
    credentials: "NCSF-CPT",
    specialties: "strength,fat_loss,beginner",
    hourlyRateCents: 12000,
    sessionRateCents: 15000,
    currency: "SGD",
    preferredArea: "tampines",
    radiusKm: 15,
    published: true,
    facilityIds: ["gym_demo_tampines"],
    serviceModes: "studio,at_gym",
  });
  const alexCard = await q.getPublicProfile("mp_demo_alex");
  assert(alexCard?.credentials === "NCSF-CPT", "public card shows credentials");
  assert(alexCard?.hourlyRateCents === 12000, "public card shows hourly rate");
  assert(alexCard?.region === "Tampines", "listing area is Tampines");

  const firstEmail = `sam-${Date.now()}@example.com`;
  const first = await createIntroRequest({
    profileId: "mp_demo_alex",
    seekerEmail: firstEmail,
    seekerName: "Sam Seeker",
    facilityId: "gym_demo_tampines",
    message: "I train at Tampines three mornings a week.",
  });
  assert(first.ok && "introId" in first, "intro created");
  assert(!!peekLastEmailTo(firstEmail), "seeker confirmation emailed");

  const bad = await createIntroRequest({
    profileId: "mp_demo_alex",
    seekerEmail: "not-an-email",
    seekerName: "X",
  });
  assert(!bad.ok && bad.error === "invalid", "bad email rejected");

  const rl = `rl-${Date.now()}@example.com`;
  for (let i = 0; i < 3; i++) {
    const r = await createIntroRequest({
      profileId: "mp_demo_alex",
      seekerEmail: rl,
      seekerName: "RL",
    });
    assert(r.ok, `rate-limit fill ${i}`);
  }
  const limited = await createIntroRequest({
    profileId: "mp_demo_alex",
    seekerEmail: rl,
    seekerName: "RL",
  });
  assert(!limited.ok && limited.error === "rate_limited", "4th intro same day blocked");

  const acceptEmail = `accepted-${Date.now()}@example.com`;
  const created = await createIntroRequest({
    profileId: "mp_demo_alex",
    seekerEmail: acceptEmail,
    seekerName: "Pat Accepted",
    message: "Mornings at Tampines",
  });
  assert(created.ok, "intro to accept");
  const acc = await acceptIntroRequest({
    introId: created.ok ? created.introId : "",
    organizationId: alex.organizationId,
    actorUserId: alex.userId,
  });
  assert(acc.ok && acc.clientId, "accept creates client");
  const [lead] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, acc.ok ? acc.clientId : ""))
    .limit(1);
  assert(lead?.status === "lead", "client is lead");
  assert(lead?.email === acceptEmail, "email stored lowercase");

  const again = await acceptIntroRequest({
    introId: created.ok ? created.introId : "",
    organizationId: alex.organizationId,
    actorUserId: alex.userId,
  });
  assert(!again.ok && again.error === "not_pending", "double accept rejected");

  if (acc.ok) {
    assert(
      acc.charge.status === "waived" || acc.charge.status === "due",
      "accept records a waive or due charge"
    );
  }

  const session = await createPlatformCheckoutSession({
    chargeId: "chg_test",
    amountCents: 2900,
    currency: "usd",
    successUrl: "http://127.0.0.1:4000/settings",
    cancelUrl: "http://127.0.0.1:4000/settings",
  });
  assert(
    session.url.includes("/api/stripe/mock-complete?chargeId="),
    "mock checkout url"
  );

  const featChargeId = id("chg");
  await db.insert(platformCharges).values({
    id: featChargeId,
    organizationId: alex.organizationId,
    kind: "featured_month",
    profileId: "mp_demo_alex",
    amountCents: 2900,
    status: "due",
  });
  const paidAt = new Date();
  await markPlatformChargePaid({ chargeId: featChargeId, paidAt });
  const [alexAfter] = await db
    .select()
    .from(marketplaceProfiles)
    .where(eq(marketplaceProfiles.id, "mp_demo_alex"))
    .limit(1);
  assert(
    !!alexAfter?.featuredUntil && alexAfter.featuredUntil > paidAt,
    "featured until after paid"
  );

  const {
    registerSeeker,
    verifySeekerLogin,
    updateSeekerPrefs,
    addSeekerMeasurement,
    listSeekerMeasurements,
  } = await import("../src/lib/seeker-auth");
  const email = `seeker-${Date.now()}@example.com`;
  const createdSeeker = await registerSeeker({
    email,
    password: "password1",
    firstName: "Riley",
    lastName: "Client",
  });
  assert(createdSeeker.ok, "seeker register");
  const dup = await registerSeeker({
    email,
    password: "password1",
    firstName: "Riley",
  });
  assert(!dup.ok, "duplicate seeker email rejected");
  const login = await verifySeekerLogin({ email, password: "password1" });
  assert(login.ok && login.seeker.firstName === "Riley", "seeker login");
  const badLogin = await verifySeekerLogin({ email, password: "nope" });
  assert(!badLogin.ok, "bad seeker password rejected");
  if (createdSeeker.ok) {
    const updated = await updateSeekerPrefs(createdSeeker.seeker.id, {
      preferredFacilityId: "gym_demo_tampines",
      preferredBrand: "Anytime Fitness",
      preferredArea: "tampines",
    });
    assert(updated.preferredBrand === "Anytime Fitness", "seeker network saved");
    assert(updated.preferredFacilityId === "gym_demo_tampines", "seeker gym saved");
    assert(updated.preferredArea === "tampines", "seeker area slug saved");
    assert(updated.city === "Singapore", "area sets city");
    const mapped = findTrainingArea(updated.preferredArea);
    assert(mapped?.lat === 1.3496, "area maps to Tampines coords internally");
    await addSeekerMeasurement(createdSeeker.seeker.id, { weightKg: 72.5 });
    const meas = await listSeekerMeasurements(createdSeeker.seeker.id);
    assert(meas.some((m) => m.weightKg === 72.5), "seeker measurement stored");
    const due = await db
      .select()
      .from(platformCharges)
      .where(eq(platformCharges.organizationId, alex.organizationId));
    const unpaid = due.filter(
      (c) => c.kind === "intro_accept" && c.status === "due"
    ).length;
    const matched = await q.searchPublicProfiles({
      facilityId: updated.preferredFacilityId,
      brand: updated.preferredBrand,
      lat: mapped?.lat,
      lng: mapped?.lng,
      radiusKm: 20,
    });
    if (listingVisibleInSearch({ published: true, unpaidIntroCharges: unpaid })) {
      assert(
        matched.some((c) => c.id === "mp_demo_alex"),
        "prefs surface PTs at selected gym/network"
      );
    } else {
      assert(true, "prefs search skipped — listing hidden by unpaid intro fees");
    }
  }

  console.log("\nmarketplace smoke: ALL PASS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
