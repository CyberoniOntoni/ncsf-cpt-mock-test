import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, getPGlite } from "./index";
import {
  clients,
  gymFacilities,
  introRequests,
  marketplaceProfileFacilities,
  marketplaceProfiles,
  memberships,
  organizations,
  seekerProfiles,
  users,
} from "./schema";
import { id } from "@/lib/utils";
import {
  catalogFacilityRow,
  gymCatalogEntry,
  gymFacilityId,
} from "@/lib/marketplace/gym-catalog";
import { seedLibraryIfNeeded } from "./seed-library";
import { seedPlaybooksIfNeeded } from "./seed-playbooks";

/** Single-flight lock so concurrent requests don't double-seed. */
let seedPromise: Promise<void> | null = null;

export async function seedIfNeeded() {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null; // allow retry after failure
      throw err;
    });
  }
  await seedPromise;
  // Always backfill demo clients + catalog + playbooks (idempotent upserts)
  await ensureDemoClients();
  await seedLibraryIfNeeded();
  await seedPlaybooksIfNeeded();
  await seedMarketplaceIfNeeded();
}

async function markSeeded(client: Awaited<ReturnType<typeof getPGlite>>) {
  await client.exec(`
    INSERT INTO app_meta(key, value) VALUES ('seeded', '1')
    ON CONFLICT (key) DO NOTHING
  `);
}

async function runSeed() {
  const db = await getDb();
  const client = await getPGlite();

  const meta = await client.query<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'seeded'`
  );
  if (meta.rows.length > 0) {
    await seedLibraryIfNeeded();
    await seedPlaybooksIfNeeded();
    return;
  }

  // Partial seed recovery: demo user already present
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "pt@demo.local"))
    .limit(1);
  if (existingUser) {
    await markSeeded(client);
    await seedLibraryIfNeeded();
    await seedPlaybooksIfNeeded();
    return;
  }

  const orgId = id("org");
  const userId = id("user");
  const passwordHash = await bcrypt.hash("trainer123", 10);

  await db.insert(organizations).values({
    id: orgId,
    name: "Demo PT Studio",
    kind: "studio",
    unitSystem: "metric",
    timezone: "Asia/Singapore",
  });

  await db.insert(users).values({
    id: userId,
    email: "pt@demo.local",
    name: "Alex Trainer",
    passwordHash,
    isPlatformAdmin: true,
    emailVerifiedAt: new Date(),
  });

  await db.insert(memberships).values({
    id: id("mem"),
    userId,
    organizationId: orgId,
    role: "owner",
  });

  // Assessment templates + playbooks: seed-playbooks.ts (idempotent upsert)
  await markSeeded(client);
  await seedLibraryIfNeeded();
  await seedPlaybooksIfNeeded();
  await ensureDemoClients(orgId);
}

/** Re-create Jane / Marcus if missing (e.g. after DB wipe / partial seed). */
async function ensureDemoClients(forceOrgId?: string) {
  const db = await getDb();

  let organizationId = forceOrgId;
  if (!organizationId) {
    const [membership] = await db
      .select()
      .from(memberships)
      .limit(1);
    if (membership) {
      organizationId = membership.organizationId;
    } else {
      const [org] = await db.select().from(organizations).limit(1);
      organizationId = org?.id;
    }
  }
  if (!organizationId) return;

  const existing = await db
    .select()
    .from(clients)
    .where(eq(clients.organizationId, organizationId));

  const names = new Set(
    existing.map((c) => `${c.firstName} ${c.lastName}`.toLowerCase())
  );

  const demos = [
    {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "+65 9000 1001",
      goals: "Improve shoulder mobility and return to overhead pressing",
      experienceLevel: "intermediate",
      injuries: "Occasional right shoulder stiffness; failed back scratch on right",
      medicalHistory: "None reported",
      tags: "shoulder,mobility",
    },
    {
      firstName: "Marcus",
      lastName: "Chen",
      email: "marcus@example.com",
      phone: "+65 9000 1002",
      goals: "Fat loss and general strength 3x/week",
      experienceLevel: "beginner",
      injuries: null as string | null,
      medicalHistory: null as string | null,
      tags: "fat-loss,beginner",
    },
  ];

  for (const d of demos) {
    const key = `${d.firstName} ${d.lastName}`.toLowerCase();
    if (names.has(key)) continue;
    // Also skip if email already present in org
    if (d.email && existing.some((c) => c.email === d.email)) continue;

    await db.insert(clients).values({
      id: id("cli"),
      organizationId,
      status: "active",
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      goals: d.goals,
      experienceLevel: d.experienceLevel,
      injuries: d.injuries,
      medicalHistory: d.medicalHistory,
      tags: d.tags,
    });
  }
}

const DEMO_TAMPINES_SLUG = "anytime-fitness-tampines";
const DEMO_GYM_SLUGS = [DEMO_TAMPINES_SLUG, "anytime-fitness-orchard"];

async function ensureDemoCatalogGyms() {
  const db = await getDb();
  for (const slug of DEMO_GYM_SLUGS) {
    const entry = gymCatalogEntry(slug);
    if (!entry) continue;
    const row = catalogFacilityRow(entry);
    const [byId] = await db
      .select({ id: gymFacilities.id })
      .from(gymFacilities)
      .where(eq(gymFacilities.id, row.id))
      .limit(1);
    if (byId) continue;
    const [bySlug] = await db
      .select({ id: gymFacilities.id })
      .from(gymFacilities)
      .where(eq(gymFacilities.slug, row.slug))
      .limit(1);
    if (bySlug) continue;
    await db.insert(gymFacilities).values(row).onConflictDoNothing();
  }
}

async function reassignFacility(fromId: string, toId: string) {
  if (fromId === toId) return;
  const db = await getDb();
  const links = await db
    .select()
    .from(marketplaceProfileFacilities)
    .where(eq(marketplaceProfileFacilities.facilityId, fromId));
  for (const link of links) {
    const destLinks = await db
      .select()
      .from(marketplaceProfileFacilities)
      .where(eq(marketplaceProfileFacilities.profileId, link.profileId));
    if (destLinks.some((l) => l.facilityId === toId)) {
      await db
        .delete(marketplaceProfileFacilities)
        .where(eq(marketplaceProfileFacilities.id, link.id));
    } else {
      await db
        .update(marketplaceProfileFacilities)
        .set({ facilityId: toId })
        .where(eq(marketplaceProfileFacilities.id, link.id));
    }
  }
  await db
    .update(introRequests)
    .set({ facilityId: toId })
    .where(eq(introRequests.facilityId, fromId));
  await db
    .update(seekerProfiles)
    .set({ preferredFacilityId: toId })
    .where(eq(seekerProfiles.preferredFacilityId, fromId));
}

async function remapLegacyDemoGyms() {
  const db = await getDb();
  const all = await db.select().from(gymFacilities);
  const bySlug = new Map(all.map((g) => [g.slug, g]));
  const remaps = [
    {
      oldSlugs: ["anytime-tampines"],
      oldIds: ["gym_demo_tampines"],
      newSlug: DEMO_TAMPINES_SLUG,
    },
    {
      oldSlugs: ["anytime-orchard"],
      oldIds: ["gym_demo_orchard"],
      newSlug: "anytime-fitness-orchard",
    },
  ];
  for (const r of remaps) {
    const dest = bySlug.get(r.newSlug);
    if (!dest) continue;
    const sources = all.filter(
      (g) => r.oldIds.includes(g.id) || r.oldSlugs.includes(g.slug)
    );
    for (const src of sources) {
      if (src.id === dest.id) continue;
      await reassignFacility(src.id, dest.id);
      await db.delete(gymFacilities).where(eq(gymFacilities.id, src.id));
    }
  }
}

let marketplaceSeedPromise: Promise<void> | null = null;

export async function seedMarketplaceIfNeeded() {
  if (!marketplaceSeedPromise) {
    marketplaceSeedPromise = runMarketplaceSeed().catch((err) => {
      marketplaceSeedPromise = null;
      throw err;
    });
  }
  await marketplaceSeedPromise;
}

async function runMarketplaceSeed() {
  const db = await getDb();
  await ensureDemoCatalogGyms();
  await remapLegacyDemoGyms();

  const [demoUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "pt@demo.local"))
    .limit(1);
  const [demoOrg] = await db.select().from(organizations).limit(1);
  if (!demoUser || !demoOrg) return;

  const [existingProfile] = await db
    .select({ id: marketplaceProfiles.id })
    .from(marketplaceProfiles)
    .where(eq(marketplaceProfiles.id, "mp_demo_alex"))
    .limit(1);
  if (existingProfile) return;

  const tampinesId = gymFacilityId(DEMO_TAMPINES_SLUG);
  await db.insert(marketplaceProfiles).values({
    id: "mp_demo_alex",
    organizationId: demoOrg.id,
    userId: demoUser.id,
    headline: "Strength and fat-loss coaching",
    bio: "NCSF-minded programming. Floor sessions at Tampines or your gym.",
    credentials: "NCSF-CPT",
    specialties: "strength,fat_loss,beginner",
    hourlyRateCents: 12000,
    sessionRateCents: 15000,
    currency: "SGD",
    preferredArea: "tampines",
    serviceModes: "studio,at_gym",
    city: "Singapore",
    region: "Tampines",
    country: "SG",
    lat: 1.3496,
    lng: 103.9568,
    radiusKm: 15,
    published: true,
  });

  await db.insert(marketplaceProfileFacilities).values({
    id: "mpf_demo_alex_tampines",
    profileId: "mp_demo_alex",
    facilityId: tampinesId,
  });
}

export async function ensureSeededUser() {
  await seedIfNeeded();
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, "pt@demo.local")).limit(1);
  return u;
}
