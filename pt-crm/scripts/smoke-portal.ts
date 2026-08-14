/**
 * Client portal smoke (auth + IDOR + gates).
 * Run: npm run smoke:portal
 */
import { eq } from "drizzle-orm";
import { seedIfNeeded } from "../src/db/seed";
import { getDb } from "../src/db";
import { clientOtps, clients } from "../src/db/schema";
import {
  hashOtp,
  listPortalStudiosForEmail,
  requestClientOtp,
  verifyClientOtp,
} from "../src/lib/client-auth";
import { peekLastEmailTo } from "../src/lib/email";
import { getEffectiveInvoiceStatus } from "../src/lib/invoice-status";
import { getPortalClient } from "../src/db/queries/portal";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("ok", msg);
}

function extractCode(text: string): string | null {
  const m = text.match(/\b(\d{6})\b/);
  return m?.[1] || null;
}

async function main() {
  process.env.MOCK_EMAIL = "true";
  await seedIfNeeded();
  const db = await getDb();

  const [jane] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, "jane@example.com"))
    .limit(1);
  assert(jane, "demo client jane exists");
  assert(jane.status === "active", "jane is active");

  // Fresh OTP window so re-runs are not blocked by prior smoke rate-limit rows.
  await db.delete(clientOtps).where(eq(clientOtps.email, "jane@example.com"));

  const unknown = await requestClientOtp({
    email: `nobody-${Date.now()}@example.com`,
  });
  assert("ok" in unknown && unknown.ok === true, "unknown email still ok:true");
  if ("sent" in unknown) {
    assert(unknown.sent === true, "unknown email claims sent");
  }

  const listed = await listPortalStudiosForEmail(jane.email || "");
  assert(
    listed.every((s) => !("clientId" in s) || s.clientId == null),
    "pre-auth studio list has no clientId"
  );
  assert(
    listed.every((s) => !("firstName" in s)),
    "pre-auth studio list has no firstName"
  );

  const studios = await listPortalStudiosForEmail("jane@example.com");
  assert(studios.length >= 1, "jane has a studio");

  const none = await listPortalStudiosForEmail("nobody-portal@example.com");
  assert(none.length === 0, "unknown email has no studios");

  const first = await requestClientOtp({
    email: "jane@example.com",
    organizationId: jane.organizationId,
  });
  assert(first.ok && "sent" in first && first.sent, "OTP sent");
  const mail = peekLastEmailTo("jane@example.com");
  const code =
    first.ok && "devCode" in first && first.devCode
      ? first.devCode
      : extractCode(mail?.text || "");
  assert(code && code.length === 6, "OTP code available");
  assert(hashOtp(code!) === hashOtp(code!), "OTP hash stable");

  const bad = await verifyClientOtp({
    email: "jane@example.com",
    organizationId: jane.organizationId,
    code: "000000",
  });
  assert(!bad.ok, "wrong OTP rejected");

  const good = await verifyClientOtp({
    email: "jane@example.com",
    organizationId: jane.organizationId,
    code: code!,
  });
  assert(good.ok, "correct OTP accepted");

  const reused = await verifyClientOtp({
    email: "jane@example.com",
    organizationId: jane.organizationId,
    code: code!,
  });
  assert(!reused.ok, "used OTP rejected");

  const leak = await getPortalClient("org_not_yours", jane.id);
  assert(!leak, "IDOR: wrong org cannot load client");
  const own = await getPortalClient(jane.organizationId, jane.id);
  assert(own?.id === jane.id, "own org can load client");

  assert(
    getEffectiveInvoiceStatus({
      status: "unpaid",
      dueAt: new Date(Date.now() - 86400000),
    }) === "overdue",
    "overdue invoice helper"
  );
  assert(
    getEffectiveInvoiceStatus({ status: "paid" }) === "paid",
    "paid stays paid"
  );

  const otpsBefore = await db
    .select({ id: clientOtps.id })
    .from(clientOtps)
    .where(eq(clientOtps.email, "jane@example.com"));
  let limited = false;
  for (let i = 0; i < 5; i++) {
    const r = await requestClientOtp({
      email: "jane@example.com",
      organizationId: jane.organizationId,
    });
    if (!r.ok && r.error.toLowerCase().includes("too many")) {
      limited = true;
      break;
    }
  }
  assert(limited || otpsBefore.length >= 3, "OTP rate limit engages");

  const blocked = await requestClientOtp({
    email: "pt@demo.local",
  });
  assert(blocked.ok && "sent" in blocked && blocked.sent, "trainer email looks like unknown");
  assert(!("organizationId" in blocked && blocked.organizationId), "trainer email has no org");
  assert(!peekLastEmailTo("pt@demo.local"), "trainer email is not mailed a code");

  const env = process.env as { NODE_ENV?: string; CLIENT_AUTH_SECRET?: string };
  const prev = env.NODE_ENV;
  const prevSecret = env.CLIENT_AUTH_SECRET;
  env.NODE_ENV = "production";
  delete env.CLIENT_AUTH_SECRET;
  let threw = false;
  try {
    hashOtp("123456");
  } catch {
    threw = true;
  }
  env.NODE_ENV = prev;
  if (prevSecret === undefined) delete env.CLIENT_AUTH_SECRET;
  else env.CLIENT_AUTH_SECRET = prevSecret;
  assert(threw, "hashOtp fails closed in production without CLIENT_AUTH_SECRET");

  const { programs, programDays, programExercises } = await import("../src/db/schema");
  const {
    getPortalActiveProgram,
    getPortalNotifications,
    notifyProgramAssigned,
  } = await import("../src/db/queries/portal");
  const { id } = await import("../src/lib/utils");
  const programId = id("prg");
  const dayId = id("pday");
  await db.insert(programs).values({
    id: programId,
    organizationId: jane.organizationId,
    clientId: jane.id,
    title: "Smoke mobility",
    goal: "mobility",
    daysPerWeek: 3,
    sessionMinutes: 45,
    status: "active",
  });
  await db.insert(programDays).values({
    id: dayId,
    programId,
    dayIndex: 0,
    name: "Day 1",
    focus: "Shoulders",
  });
  await db.insert(programExercises).values({
    id: id("pex"),
    programDayId: dayId,
    exerciseName: "Wall slides",
    sets: 2,
    reps: "8",
    rpe: "5",
    restSec: 30,
    notes: "Ribs down. · Mesocycle: W1",
    sortOrder: 0,
    isWarmup: true,
    setScheme: "straight",
  });
  const portalProgram = await getPortalActiveProgram(jane.organizationId, jane.id);
  assert(portalProgram, "assigned client has an active program in portal");
  assert(portalProgram!.days[0].blocks[0].phase === "warmup", "warmup phase mapped");
  assert(
    !JSON.stringify(portalProgram).includes("Mesocycle"),
    "portal program strips trainer-internal notes"
  );

  await notifyProgramAssigned({
    organizationId: jane.organizationId,
    clientId: jane.id,
    title: "Smoke mobility",
  });
  const notifs = await getPortalNotifications(jane.organizationId, jane.id);
  assert(
    notifs.some((n) => n.type === "program_assigned"),
    "program_assigned notification present"
  );

  console.log("\nPortal smoke: ALL PASS");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
