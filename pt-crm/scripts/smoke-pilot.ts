/**
 * Pilot-readiness smoke (no browser, no auth).
 * Uses an isolated temp PGlite dir so it never fights `npm run dev`.
 *
 *   npm run smoke:pilot
 */
import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import {
  centsToMoneyInput,
  formatMoney,
  parseMoneyToCents,
  sanitizeMoneyInput,
} from "../src/lib/money";
import { id } from "../src/lib/utils";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  // Money helpers (no DB)
  assert(parseMoneyToCents("600") === 60000, "parse 600");
  assert(parseMoneyToCents("120.50") === 12050, "parse 120.50");
  assert(parseMoneyToCents("1,200.05") === 120005, "parse with comma");
  assert(formatMoney(60000, "SGD", { compact: true }) === "SGD 600", "compact");
  assert(formatMoney(60050, "SGD") === "SGD 600.50", "full");
  assert(sanitizeMoneyInput("ab600.5x") === "600.5", "sanitize junk chars");
  assert(sanitizeMoneyInput("12.345") === "12.34", "sanitize 2dp");
  assert(centsToMoneyInput(60000) === "600", "cents→input whole");
  assert(centsToMoneyInput(60050) === "600.50", "cents→input frac");
  let zeroFailed = false;
  try {
    parseMoneyToCents("0");
  } catch {
    zeroFailed = true;
  }
  assert(zeroFailed, "reject zero amount");
  console.log("ok money helpers");

  // Isolated data dir — safe alongside dev server
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "floorscribe-pilot-"));
  process.env.PGLITE_DATA_DIR = tmpDir;

  // Dynamic import after env so getDb uses the temp dir
  const { seedIfNeeded } = await import("../src/db/seed");
  const { getDb } = await import("../src/db");
  const {
    clientInvoices,
    clientPackages,
    clients,
    organizations,
  } = await import("../src/db/schema");

  await seedIfNeeded();
  const db = await getDb();
  const [org] = await db.select().from(organizations).limit(1);
  assert(org, "org exists");

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.organizationId, org.id))
    .limit(1);
  assert(client, "client exists");

  const invId = id("inv");
  await db.insert(clientInvoices).values({
    id: invId,
    organizationId: org.id,
    clientId: client.id,
    title: "Pilot smoke invoice",
    amountCents: 60000,
    currency: "SGD",
    status: "unpaid",
    notes: "smoke-pilot",
    issuedAt: new Date(),
  });

  const [created] = await db
    .select()
    .from(clientInvoices)
    .where(eq(clientInvoices.id, invId))
    .limit(1);
  assert(created?.status === "unpaid", "invoice unpaid");
  assert(created.amountCents === 60000, "invoice amount");

  await db
    .update(clientInvoices)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(clientInvoices.id, invId));
  const [paid] = await db
    .select()
    .from(clientInvoices)
    .where(eq(clientInvoices.id, invId))
    .limit(1);
  assert(paid?.status === "paid" && paid.paidAt, "invoice paid");

  await db
    .update(clientInvoices)
    .set({ status: "void", paidAt: null })
    .where(eq(clientInvoices.id, invId));
  const [voided] = await db
    .select()
    .from(clientInvoices)
    .where(eq(clientInvoices.id, invId))
    .limit(1);
  assert(voided?.status === "void", "invoice void");
  console.log("ok client_invoices lifecycle");

  // Starter pack on demo client (exercise remaining math)
  const pkgId = id("pkg");
  await db.insert(clientPackages).values({
    id: pkgId,
    clientId: client.id,
    name: "Pilot pack",
    totalSessions: 10,
    usedSessions: 0,
    status: "active",
  });
  await db
    .update(clientPackages)
    .set({ usedSessions: 1 })
    .where(eq(clientPackages.id, pkgId));
  const [pkg] = await db
    .select()
    .from(clientPackages)
    .where(eq(clientPackages.id, pkgId))
    .limit(1);
  assert(pkg && pkg.totalSessions - pkg.usedSessions === 9, "pack remaining 9");
  console.log("ok pack remaining math");

  const unpaid = await db
    .select({ id: clientInvoices.id })
    .from(clientInvoices)
    .where(eq(clientInvoices.status, "unpaid"))
    .limit(20);
  console.log(`ok unpaid invoices query (${unpaid.length} open)`);

  // Best-effort cleanup of temp dir
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore lock leftovers on Windows
  }

  console.log("smoke-pilot: ALL PASS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
