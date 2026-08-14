"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { seedIfNeeded } from "@/db/seed";
import {
  logoutClientPortal,
  requestClientOtp,
  verifyClientOtp,
} from "@/lib/client-auth";
import {
  isSeekerProfileComplete,
  issueSeekerSession,
  registerSeeker,
  verifySeekerLogin,
} from "@/lib/seeker-auth";

async function requestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  };
}

export async function requestPortalOtpAction(input: {
  email: string;
  organizationId?: string | null;
}) {
  await seedIfNeeded();
  const meta = await requestMeta();
  return requestClientOtp({
    email: input.email,
    organizationId: input.organizationId,
    ...meta,
  });
}

export async function verifyPortalOtpAction(input: {
  email: string;
  organizationId: string;
  code: string;
  redirectTo?: string | null;
}) {
  await seedIfNeeded();
  const meta = await requestMeta();
  const res = await verifyClientOtp({
    email: input.email,
    organizationId: input.organizationId,
    code: input.code,
    ...meta,
  });
  if (!res.ok) return res;
  const dest =
    input.redirectTo &&
    input.redirectTo.startsWith("/portal") &&
    !input.redirectTo.startsWith("//")
      ? input.redirectTo
      : "/portal/dashboard";
  redirect(dest);
}

export async function logoutPortalAction() {
  await logoutClientPortal();
  redirect("/portal/login");
}

export async function registerPortalAction(form: {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await seedIfNeeded();
  const result = await registerSeeker(form);
  if (!result.ok) return result;
  await issueSeekerSession(result.seeker);
  return { ok: true };
}

export async function loginPortalPasswordAction(form: {
  email: string;
  password: string;
}): Promise<
  { ok: true; profileComplete: boolean } | { ok: false; error: string }
> {
  await seedIfNeeded();
  const result = await verifySeekerLogin(form);
  if (!result.ok) return result;
  await issueSeekerSession(result.seeker);
  return { ok: true, profileComplete: isSeekerProfileComplete(result.seeker) };
}
