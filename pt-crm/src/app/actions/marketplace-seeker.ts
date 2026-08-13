"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addSeekerMeasurement,
  clearSeekerSession,
  getSeekerById,
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
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await verifySeekerLogin(form);
  if (!result.ok) return result;
  await issueSeekerSession(result.seeker);
  return { ok: true };
}

export async function logoutSeekerAction() {
  await clearSeekerSession();
  redirect("/find");
}

export async function saveSeekerPrefsAction(form: {
  city?: string;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  preferredFacilityId?: string;
  preferredBrand?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSeekerSession();
  await updateSeekerPrefs(session.seekerId, {
    city: form.city ?? null,
    lat: form.lat ?? null,
    lng: form.lng ?? null,
    radiusKm: form.radiusKm,
    preferredFacilityId: form.preferredFacilityId || null,
    preferredBrand: form.preferredBrand || null,
  });
  revalidatePath("/find");
  revalidatePath("/find/account");
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
  return { ok: true };
}

export async function currentSeekerAction() {
  const session = await requireSeekerSession();
  return getSeekerById(session.seekerId);
}
