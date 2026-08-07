/**
 * Lane A smoke: tenant isolation, progression helpers, pack burn math, last-load.
 * Uses isolated temp PGlite so it can run while `npm run dev` is up.
 * Run: npx tsx scripts/smoke-floor.ts
 */
import fs from "fs";
import os from "os";
import path from "path";
import {
  formatLastPerformance,
  parseRepRange,
  suggestProgression,
} from "../src/lib/progression";
import {
  buildSessionSummaryText,
  formatRelativeSessionDay,
} from "../src/lib/session-summary";
import { loadClientContextIsolation } from "./_smoke-helpers";

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "floorscribe-floor-"));
  process.env.PGLITE_DATA_DIR = tmpDir;

  const { seedIfNeeded } = await import("../src/db/seed");
  const { getDb } = await import("../src/db");
  const { clients, organizations } = await import("../src/db/schema");
  const { getClientInOrg } = await import("../src/lib/tenant");

  await seedIfNeeded();
  const db = await getDb();
  const orgs = await db.select().from(organizations);
  if (orgs.length < 1) throw new Error("No orgs after seed");

  const orgA = orgs[0];
  // Fake foreign org id must not see orgA clients
  const allClients = await db.select().from(clients);
  const mine = allClients.filter((c) => c.organizationId === orgA.id);
  if (!mine.length) {
    console.log("No clients in demo org — skip client isolation pair");
  } else {
    const c = mine[0];
    const ok = await getClientInOrg(c.id, orgA.id);
    if (!ok) throw new Error("getClientInOrg failed for own org");
    const cross = await getClientInOrg(c.id, "org_does_not_exist");
    if (cross) throw new Error("Cross-tenant client leak");
    console.log("tenant: client scoped OK", c.firstName);
  }

  // Progression rules
  const range = parseRepRange("8-10");
  if (!range || range.high !== 10) throw new Error("parseRepRange failed");

  const bump = suggestProgression({
    plannedReps: "8-10",
    lastSets: [
      { setIndex: 1, reps: "10", weightKg: 40, rpe: "7", completed: true },
      { setIndex: 2, reps: "10", weightKg: 40, rpe: "7", completed: true },
      { setIndex: 3, reps: "10", weightKg: 40, rpe: "7", completed: true },
    ],
  });
  if (!bump || bump.kind !== "load" || bump.suggestedKg !== 42) {
    throw new Error(`Expected load bump to 42, got ${JSON.stringify(bump)}`);
  }

  const hold = suggestProgression({
    plannedReps: "5",
    lastSets: [
      { setIndex: 1, reps: "5", weightKg: 100, rpe: "9.5", completed: true },
    ],
  });
  if (!hold || hold.kind !== "hold") {
    throw new Error(`Expected hold at high RPE, got ${JSON.stringify(hold)}`);
  }

  const line = formatLastPerformance([
    { setIndex: 1, reps: "8", weightKg: 50, rpe: "7", completed: true },
    { setIndex: 2, reps: "8", weightKg: 50, rpe: "8", completed: true },
  ]);
  if (!line?.includes("50")) throw new Error("formatLastPerformance failed");

  const { isProgramMetaDump, seedSessionNotes } = await import(
    "../src/lib/session-notes"
  );
  if (!isProgramMetaDump("Elbows inside knees. · Reverse pyramid: foo · Deload week")) {
    throw new Error("expected meta dump detection");
  }
  if (isProgramMetaDump("Heel stays down; drive knee toward wall.")) {
    throw new Error("short cue should not be meta dump");
  }
  const seeded = seedSessionNotes({
    programNotes: "Elbows inside knees. · Mesocycle: W4 · Deload week",
    bankCue: "Elbows inside knees; chest tall.",
  });
  if (seeded !== "Elbows inside knees; chest tall.") {
    throw new Error(`seed should prefer bank over dump, got ${seeded}`);
  }
  const short = seedSessionNotes({
    programNotes: "Keep ribs down.",
    bankCue: "Bank",
  });
  if (short !== "Keep ribs down.") {
    throw new Error("short program notes should win");
  }
  console.log("session-notes: OK");

  const {
    defaultExerciseCollapsed,
    groupContainsCurrent,
  } = await import("../src/lib/session-focus");
  if (
    !defaultExerciseCollapsed({
      readonly: false,
      logId: "a",
      currentExId: "b",
      completed: false,
      userOverride: undefined,
    })
  ) {
    throw new Error("non-current should collapse");
  }
  if (
    defaultExerciseCollapsed({
      readonly: false,
      logId: "b",
      currentExId: "b",
      completed: false,
      userOverride: undefined,
    })
  ) {
    throw new Error("current should expand");
  }
  if (
    !defaultExerciseCollapsed({
      readonly: false,
      logId: "a",
      currentExId: "b",
      completed: false,
      userOverride: true,
    })
  ) {
    throw new Error("user forced collapse override should stay collapsed");
  }
  if (
    defaultExerciseCollapsed({
      readonly: false,
      logId: "a",
      currentExId: "b",
      completed: false,
      userOverride: false,
    }) !== false
  ) {
    throw new Error("user expand on non-current should stay open (peek)");
  }
  if (
    defaultExerciseCollapsed({
      readonly: false,
      logId: "b",
      currentExId: "b",
      completed: false,
      userOverride: false,
    }) !== false
  ) {
    throw new Error("user expand override");
  }
  if (
    !defaultExerciseCollapsed({
      readonly: false,
      logId: "done",
      currentExId: "done",
      completed: true,
      userOverride: undefined,
    })
  ) {
    throw new Error("completed should collapse even if last/current");
  }
  if (
    defaultExerciseCollapsed({
      readonly: false,
      logId: "done",
      currentExId: "done",
      completed: true,
      userOverride: false,
    }) !== false
  ) {
    throw new Error("user can expand completed");
  }
  if (!groupContainsCurrent(["x", "y"], "y")) {
    throw new Error("group current");
  }
  console.log("session-focus: OK");

  const rel = formatRelativeSessionDay(new Date());
  if (rel !== "today") throw new Error(`expected today, got ${rel}`);

  const summary = buildSessionSummaryText({
    session: {
      title: "Day A",
      durationMin: 45,
      overallRpe: "7",
      performedAt: new Date(),
    },
    clientName: "Test Client",
    logs: [
      {
        exerciseName: "Goblet squat",
        completed: true,
        setLogs: [
          {
            setIndex: 1,
            reps: "10",
            weightKg: 24,
            rpe: "7",
            completed: true,
          },
        ],
      },
    ],
  });
  if (!summary.includes("Goblet squat") || !summary.includes("24")) {
    throw new Error("buildSessionSummaryText failed");
  }

  // Lane C: progress share text builder
  const { buildClientProgressShareText } = await import(
    "../src/lib/progress-share"
  );
  const progressText = buildClientProgressShareText({
    clientId: "cli_test",
    clientName: "Test Client",
    metrics: [
      {
        key: "weightKg",
        label: "Weight",
        unit: "kg",
        points: [],
        latest: 80,
        first: 82,
        delta: -2,
        deltaPct: null,
      },
    ],
    assessments: [],
    sessionVolumes: [],
    weeklyVolume: [],
    exerciseBests: [
      {
        exerciseName: "Goblet squat",
        bestWeightKg: 32,
        bestReps: "8",
        lastSeenAt: null,
        timesLogged: 3,
      },
    ],
    stats: {
      sessionsTotal: 10,
      sessionsCompleted: 9,
      sessionsLast30: 4,
      volumeLast30Kg: 1200,
      volumeAllKg: 5000,
      screensWithRetest: 0,
      screensImproved: 0,
      screensDeclined: 0,
      lastSessionAt: new Date().toISOString(),
      activeDaysSpan: 30,
    },
  });
  if (
    !progressText.includes("Test Client") ||
    !progressText.includes("Goblet squat") ||
    !progressText.includes("progress snapshot")
  ) {
    throw new Error("buildClientProgressShareText failed");
  }
  console.log("progress-share: OK");

  // Pack burn math (floor complete → remaining / exhausted) — DB-level
  {
    const { clientPackages } = await import("../src/db/schema");
    const { eq } = await import("drizzle-orm");
    const { id } = await import("../src/lib/utils");
    if (mine[0]) {
      const pkgId = id("pkg");
      await db.insert(clientPackages).values({
        id: pkgId,
        clientId: mine[0].id,
        name: "Smoke pack",
        totalSessions: 2,
        usedSessions: 0,
        status: "active",
      });
      // Simulate consume once
      await db
        .update(clientPackages)
        .set({ usedSessions: 1, status: "active" })
        .where(eq(clientPackages.id, pkgId));
      let [p] = await db
        .select()
        .from(clientPackages)
        .where(eq(clientPackages.id, pkgId))
        .limit(1);
      if (!p || p.totalSessions - p.usedSessions !== 1) {
        throw new Error("pack remaining after first burn should be 1");
      }
      // Burn last → exhausted
      await db
        .update(clientPackages)
        .set({ usedSessions: 2, status: "exhausted" })
        .where(eq(clientPackages.id, pkgId));
      [p] = await db
        .select()
        .from(clientPackages)
        .where(eq(clientPackages.id, pkgId))
        .limit(1);
      if (!p || p.status !== "exhausted" || p.usedSessions !== 2) {
        throw new Error("pack should be exhausted after full burn");
      }
      // Restore one (delete completed session path)
      await db
        .update(clientPackages)
        .set({ usedSessions: 1, status: "active" })
        .where(eq(clientPackages.id, pkgId));
      [p] = await db
        .select()
        .from(clientPackages)
        .where(eq(clientPackages.id, pkgId))
        .limit(1);
      if (!p || p.status !== "active" || p.totalSessions - p.usedSessions !== 1) {
        throw new Error("pack restore should leave 1 remaining");
      }
      await db.delete(clientPackages).where(eq(clientPackages.id, pkgId));
      console.log("pack-burn: OK");
    } else {
      console.log("pack-burn: skip (no client)");
    }
  }

  // coach isolation helper (dynamic import of coach internals via public path)
  await loadClientContextIsolation(orgA.id, mine[0]?.id);

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore lock leftovers on Windows
  }

  console.log("smoke-floor: OK");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
