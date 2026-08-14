import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  introRequests,
  marketplaceProfiles,
  platformCharges,
  users,
} from "@/db/schema";
import { listingVisibleInSearch } from "@/lib/marketplace/fees";
import { INTROS_PER_EMAIL_PER_DAY } from "@/lib/marketplace/types";
import { sendEmail } from "@/lib/email";
import { id } from "@/lib/utils";

export async function createIntroRequest(opts: {
  profileId: string;
  seekerEmail: string;
  seekerName: string;
  seekerPhone?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  facilityId?: string | null;
  message?: string | null;
  now?: Date;
}): Promise<
  | { ok: true; introId: string }
  | { ok: false; error: "not_found" | "rate_limited" | "invalid" }
> {
  const email = (opts.seekerEmail || "").trim().toLowerCase();
  const name = (opts.seekerName || "").trim();
  if (!name || !email.includes("@")) {
    return { ok: false, error: "invalid" };
  }

  const db = await getDb();
  const [profile] = await db
    .select()
    .from(marketplaceProfiles)
    .where(eq(marketplaceProfiles.id, opts.profileId))
    .limit(1);
  if (!profile || !profile.published) return { ok: false, error: "not_found" };

  const due = await db
    .select()
    .from(platformCharges)
    .where(
      and(
        eq(platformCharges.organizationId, profile.organizationId),
        eq(platformCharges.kind, "intro_accept"),
        eq(platformCharges.status, "due")
      )
    );
  if (
    !listingVisibleInSearch({
      published: true,
      unpaidIntroCharges: due.length,
    })
  ) {
    return { ok: false, error: "not_found" };
  }

  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recent = await db
    .select()
    .from(introRequests)
    .where(
      and(eq(introRequests.seekerEmail, email), gte(introRequests.createdAt, since))
    );
  if (recent.length >= INTROS_PER_EMAIL_PER_DAY) {
    return { ok: false, error: "rate_limited" };
  }

  const introId = id("intro");
  await db.insert(introRequests).values({
    id: introId,
    profileId: profile.id,
    organizationId: profile.organizationId,
    userId: profile.userId,
    seekerEmail: email,
    seekerName: name,
    seekerPhone: opts.seekerPhone || null,
    city: opts.city || null,
    lat: opts.lat ?? null,
    lng: opts.lng ?? null,
    facilityId: opts.facilityId || null,
    message: opts.message || null,
    status: "pending",
    createdAt: now,
  });

  const [trainer] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, profile.userId))
    .limit(1);

  if (trainer?.email) {
    await sendEmail({
      to: trainer.email,
      subject: `New intro request from ${name}`,
      text: `${name} (${email}) requested an intro.\n\n${opts.message || "(no message)"}\n\nReview intros in FloorScribe.`,
    });
  }
  await sendEmail({
    to: email,
    subject: `We sent your intro to ${trainer?.name || "the trainer"}`,
    text: `We sent your intro to ${trainer?.name || "the trainer"}. They will follow up. FloorScribe introduces you; session payments are with the trainer.`,
  });

  return { ok: true, introId };
}
