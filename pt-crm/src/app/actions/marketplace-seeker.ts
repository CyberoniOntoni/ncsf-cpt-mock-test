"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addSeekerMeasurement,
  clearSeekerSession,
  getSeekerById,
  isSeekerProfileComplete,
  issueSeekerSession,
  registerSeeker,
  requireSeekerSession,
  updateSeekerPrefs,
  verifySeekerLogin,
} from "@/lib/seeker-auth";

export async function registerSeekerAction(form: {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await registerSeeker(form);
  if (!result.ok) return result;
  await issueSeekerSession(result.seeker);
  return { ok: true };
}

export async function loginSeekerAction(form: {
  email: string;
  password: string;
}): Promise<
  { ok: true; profileComplete: boolean } | { ok: false; error: string }
> {
  const result = await verifySeekerLogin(form);
  if (!result.ok) return result;
  await issueSeekerSession(result.seeker);
  return { ok: true, profileComplete: isSeekerProfileComplete(result.seeker) };
}

export async function logoutSeekerAction() {
  await clearSeekerSession();
  const { logoutClientPortal } = await import("@/lib/client-auth");
  await logoutClientPortal();
  redirect("/portal/login");
}

export async function saveSeekerPrefsAction(form: {
  preferredArea?: string;
  radiusKm?: number;
  preferredFacilityId?: string;
  preferredBrand?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSeekerSession();
  const preferredArea = (form.preferredArea || "").trim();
  if (!preferredArea) {
    return { ok: false, error: "Choose the area where you train." };
  }
  await updateSeekerPrefs(session.seekerId, {
    preferredArea,
    radiusKm: form.radiusKm,
    preferredFacilityId: form.preferredFacilityId || null,
    preferredBrand: form.preferredBrand || null,
  });
  revalidatePath("/find");
  revalidatePath("/find/account");
  revalidatePath("/portal/find");
  revalidatePath("/portal/profile");
  return { ok: true };
}

export async function addSeekerMeasurementAction(form: {
  heightCm?: number | null;
  weightKg?: number | null;
  waistCm?: number | null;
  notes?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSeekerSession();
  if (
    form.heightCm == null &&
    form.weightKg == null &&
    form.waistCm == null
  ) {
    return { ok: false, error: "Add at least one measurement." };
  }
  await addSeekerMeasurement(session.seekerId, form);
  revalidatePath("/find/account");
  revalidatePath("/portal/profile");
  return { ok: true };
}

export async function currentSeekerAction() {
  const session = await requireSeekerSession();
  return getSeekerById(session.seekerId);
}
