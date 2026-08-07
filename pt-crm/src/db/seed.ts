import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, getPGlite } from "./index";
import { clients, memberships, organizations, users } from "./schema";
import { id } from "@/lib/utils";
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

export async function ensureSeededUser() {
  await seedIfNeeded();
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, "pt@demo.local")).limit(1);
  return u;
}
