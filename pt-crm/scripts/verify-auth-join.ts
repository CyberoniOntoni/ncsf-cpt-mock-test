import { and, eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { memberships, organizations, users } from "../src/db/schema";
import { seedIfNeeded } from "../src/db/seed";
import type { SessionPayload } from "../src/lib/session";
import { id } from "../src/lib/utils";

// Legacy Multi-Query Auth Resolution Implementation
async function multiQueryResolve(
  userId: string,
  organizationId: string
): Promise<SessionPayload | null> {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.organizationId, organizationId)
      )
    )
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
    title: user.title ?? null,
    organizationId: org.id,
    organizationName: org.name,
    role: membership.role,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}

// Optimized Single-Query INNER JOIN Auth Resolution Implementation
async function singleQueryResolve(
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

// Legacy Multi-Query buildSessionForUser
async function multiQueryBuildSessionForUser(
  userId: string
): Promise<SessionPayload | null> {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const [mem] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);
  if (!mem) return null;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, mem.organizationId))
    .limit(1);
  if (!org) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    title: user.title ?? null,
    organizationId: org.id,
    organizationName: org.name,
    role: mem.role,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}

// Optimized Single-Query INNER JOIN buildSessionForUser
async function singleQueryBuildSessionForUser(
  userId: string
): Promise<SessionPayload | null> {
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

async function runVerification() {
  await seedIfNeeded();
  const db = await getDb();

  const testOrgId = id("org_test");
  await db.insert(organizations).values({
    id: testOrgId,
    name: "Test Auth Verification Gym",
    kind: "studio",
    unitSystem: "metric",
    timezone: "UTC",
  });

  const rolesToTest = [
    { role: "owner", title: "Head Coach & Founder", isAdmin: true },
    { role: "admin", title: "Operations Manager", isAdmin: false },
    { role: "trainer", title: null, isAdmin: false },
  ];

  const createdUsers: { id: string; role: string }[] = [];

  for (const item of rolesToTest) {
    const userId = id(`u_${item.role}`);
    const now = new Date();
    await db.insert(users).values({
      id: userId,
      email: `${item.role}.verify@test.local`,
      name: `Test ${item.role.toUpperCase()}`,
      passwordHash: "dummyhash",
      phone: "+15550001111",
      title: item.title,
      isPlatformAdmin: item.isAdmin,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(memberships).values({
      id: id(`mem_${item.role}`),
      userId,
      organizationId: testOrgId,
      role: item.role,
    });

    createdUsers.push({ id: userId, role: item.role });
  }

  console.log("--- STARTING COMPARATIVE AUTH RESOLUTION TEST ---");
  let passCount = 0;
  let failCount = 0;

  for (const u of createdUsers) {
    const multiRes = await multiQueryResolve(u.id, testOrgId);
    const singleRes = await singleQueryResolve(u.id, testOrgId);

    const multiBuild = await multiQueryBuildSessionForUser(u.id);
    const singleBuild = await singleQueryBuildSessionForUser(u.id);

    console.log(`\nTesting Role: [${u.role}] (User ID: ${u.id})`);
    console.log("Multi-Query Result: ", JSON.stringify(multiRes));
    console.log("Single-Query Result:", JSON.stringify(singleRes));

    const matchOrgResolve = JSON.stringify(multiRes) === JSON.stringify(singleRes);
    const matchBuildUser = JSON.stringify(multiBuild) === JSON.stringify(singleBuild);

    if (matchOrgResolve && matchBuildUser && singleRes !== null && singleRes.role === u.role) {
      console.log(`✅ [PASS] Role '${u.role}' produced 100% identical output structures.`);
      passCount++;
    } else {
      console.error(`❌ [FAIL] Discrepancy detected for role '${u.role}'!`);
      failCount++;
    }
  }

  // Edge case 1: Non-existent user
  const nonExistentMulti = await multiQueryResolve("non_existent_id", testOrgId);
  const nonExistentSingle = await singleQueryResolve("non_existent_id", testOrgId);
  if (nonExistentMulti === null && nonExistentSingle === null) {
    console.log("✅ [PASS] Non-existent user returns null for both.");
    passCount++;
  } else {
    console.error("❌ [FAIL] Mismatch on non-existent user!");
    failCount++;
  }

  // Edge case 2: Mismatched org
  const badOrgId = id("bad_org");
  const badOrgMulti = await multiQueryResolve(createdUsers[0].id, badOrgId);
  const badOrgSingle = await singleQueryResolve(createdUsers[0].id, badOrgId);
  if (badOrgMulti === null && badOrgSingle === null) {
    console.log("✅ [PASS] Invalid org ID returns null for both.");
    passCount++;
  } else {
    console.error("❌ [FAIL] Mismatch on invalid org ID!");
    failCount++;
  }

  console.log(`\n--- SUMMARY ---`);
  console.log(`Total Scenarios: ${passCount + failCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Fatal error during auth verification:", err);
  process.exit(1);
});
