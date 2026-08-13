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

async function main() {
  process.env.MOCK_EMAIL = "true";
  process.env.MOCK_STRIPE = "true";

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
    lat: orchard.lat,
    lng: orchard.lng,
  };
  const gymMatch = {
    id: "gym",
    featuredUntil: null,
    facilityIds: ["gym_a"],
    lat: tampines.lat,
    lng: tampines.lng,
  };
  const far = {
    id: "far",
    featuredUntil: null,
    facilityIds: ["gym_b"],
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
    ranked.map((p) => p.id).join(",") === "feat,gym,far",
    "featured then gym then distance"
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
      specialties: "",
      hourlyRateCents: null,
      city: "Singapore",
      lat: 1.35,
      lng: 103.95,
      radiusKm: 10,
      published: true,
      facilityIds: [],
      serviceModes: "studio",
    });
  } catch {
    threw = true;
  }
  assert(threw, "published listing requires headline");

  const first = await createIntroRequest({
    profileId: "mp_demo_alex",
    seekerEmail: "seeker@example.com",
    seekerName: "Sam Seeker",
    facilityId: "gym_demo_tampines",
    message: "I train at Tampines three mornings a week.",
  });
  assert(first.ok && "introId" in first, "intro created");
  assert(!!peekLastEmailTo("seeker@example.com"), "seeker confirmation emailed");

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

  const created = await createIntroRequest({
    profileId: "mp_demo_alex",
    seekerEmail: "accepted@example.com",
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
  assert(lead?.email === "accepted@example.com", "email stored lowercase");

  const again = await acceptIntroRequest({
    introId: created.ok ? created.introId : "",
    organizationId: alex.organizationId,
    actorUserId: alex.userId,
  });
  assert(!again.ok && again.error === "not_pending", "double accept rejected");

  if (acc.ok) {
    const decision = introFeeDecision({
      acceptedIntroCountForOrg: 0,
      unpaidIntroCharges: 0,
    });
    if (decision.action === "waive") {
      assert(acc.charge.status === "waived", "first accept waived when under free cap");
    }
  }

  const session = await createPlatformCheckoutSession({
    chargeId: "chg_test",
    amountCents: 2900,
    currency: "usd",
    successUrl: "http://127.0.0.1:4000/settings",
    cancelUrl: "http://127.0.0.1:4000/settings",
  });
  assert(
    session.url.includes("checkout.stripe.com/mock/"),
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

  console.log("\nmarketplace smoke: ALL PASS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
