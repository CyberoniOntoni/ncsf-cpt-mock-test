import { randomInt } from "crypto";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { emailChallenges } from "@/db/schema";
import { hashOtp } from "@/lib/client-auth";
import { id } from "@/lib/utils";

export type EmailChallengePurpose = "seeker_verify" | "trainer_verify";

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 3;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function issueEmailChallenge(opts: {
  purpose: EmailChallengePurpose;
  email: string;
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const email = normalizeEmail(opts.email);
  if (!email.includes("@")) return { ok: false, error: "Enter a valid email" };

  const db = await getDb();
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await db
    .select({ id: emailChallenges.id })
    .from(emailChallenges)
    .where(
      and(
        eq(emailChallenges.email, email),
        eq(emailChallenges.purpose, opts.purpose),
        gte(emailChallenges.createdAt, windowStart)
      )
    );
  if (recent.length >= RATE_MAX) {
    return { ok: false, error: "Too many codes. Try again in a few minutes." };
  }

  await db
    .update(emailChallenges)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailChallenges.email, email),
        eq(emailChallenges.purpose, opts.purpose),
        isNull(emailChallenges.usedAt)
      )
    );

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(emailChallenges).values({
    id: id("ech"),
    purpose: opts.purpose,
    email,
    codeHash: hashOtp(code),
    attempts: 0,
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  return { ok: true, code };
}

export async function consumeEmailChallenge(opts: {
  purpose: EmailChallengePurpose;
  email: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(opts.email);
  const code = (opts.code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code" };

  const db = await getDb();
  const [row] = await db
    .select()
    .from(emailChallenges)
    .where(
      and(
        eq(emailChallenges.email, email),
        eq(emailChallenges.purpose, opts.purpose),
        isNull(emailChallenges.usedAt)
      )
    )
    .orderBy(desc(emailChallenges.createdAt))
    .limit(1);

  if (!row) return { ok: false, error: "No active code. Request a new one." };
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Code expired. Request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  if (row.codeHash !== hashOtp(code)) {
    await db
      .update(emailChallenges)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailChallenges.id, row.id));
    return { ok: false, error: "Incorrect code" };
  }

  await db
    .update(emailChallenges)
    .set({ usedAt: new Date() })
    .where(eq(emailChallenges.id, row.id));

  return { ok: true };
}
