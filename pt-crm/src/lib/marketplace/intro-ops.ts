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
import {
  mailIntroRequested,
  mailIntroRequestedSeeker,
} from "@/lib/mail-copy";
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
    const trainerCopy = mailIntroRequested({
      seekerName: name,
      seekerEmail: email,
      message: opts.message || null,
    });
    const trainerSend = await sendEmail({
      to: trainer.email,
      subject: trainerCopy.subject,
      text: trainerCopy.text,
      category: trainerCopy.category,
    });
    if (!trainerSend.delivered) {
      console.warn(
        `[intro] trainer notify not delivered introId=${introId} to=${trainer.email}`
      );
    }
  }

  const seekerCopy = mailIntroRequestedSeeker({
    trainerName: trainer?.name || "the trainer",
  });
  const seekerSend = await sendEmail({
    to: email,
    subject: seekerCopy.subject,
    text: seekerCopy.text,
    category: seekerCopy.category,
  });
  if (!seekerSend.delivered) {
    // Intro already persisted — do not roll back; seeker already submitted.
    console.warn(
      `[intro] seeker confirm not delivered introId=${introId} to=${email}`
    );
  }

  return { ok: true, introId };
}
