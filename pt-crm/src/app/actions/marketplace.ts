"use server";

import { createIntroRequest } from "@/lib/marketplace/intro-ops";
import { getSeekerById, requireSeekerSession } from "@/lib/seeker-auth";

export async function requestIntroAction(form: {
  profileId: string;
  seekerPhone?: string;
  city?: string;
  facilityId?: string;
  message?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSeekerSession();
  const seeker = await getSeekerById(session.seekerId);
  if (!seeker?.emailVerifiedAt) {
    return { ok: false, error: "Verify your email first." };
  }
  const seekerName = `${session.firstName} ${session.lastName}`.trim();
  const result = await createIntroRequest({
    profileId: form.profileId,
    seekerEmail: session.email,
    seekerName,
    seekerPhone: form.seekerPhone,
    city: form.city,
    facilityId: form.facilityId,
    message: form.message,
  });
  if (!result.ok) {
    const msg =
      result.error === "rate_limited"
        ? "Too many intros today. Try again tomorrow."
        : result.error === "invalid"
          ? "Your account name or email is incomplete."
          : "That listing is not available.";
    return { ok: false, error: msg };
  }
  return { ok: true };
}
