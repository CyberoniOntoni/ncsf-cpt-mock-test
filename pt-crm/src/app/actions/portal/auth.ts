"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { seedIfNeeded } from "@/db/seed";
import {
  logoutClientPortal,
  requestClientOtp,
  verifyClientOtp,
} from "@/lib/client-auth";
import { consumeEmailChallenge, issueEmailChallenge } from "@/lib/email-challenge";
import { sendEmail } from "@/lib/email";
import { mailSeekerVerify } from "@/lib/mail-copy";
import {
  isSeekerProfileComplete,
  issueSeekerSession,
  markSeekerEmailVerified,
  registerSeeker,
  requireSeekerSession,
  verifySeekerLogin,
} from "@/lib/seeker-auth";
import { safeSeekerNext } from "@/lib/seeker-profile";

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
  organizationId?: string | null;
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
  redirect(safeSeekerNext(input.redirectTo));
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

export async function requestSeekerVerifyAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await requireSeekerSession();
  const issued = await issueEmailChallenge({
    purpose: "seeker_verify",
    email: session.email,
  });
  if (!issued.ok) return issued;
  const copy = mailSeekerVerify({
    firstName: session.firstName,
    code: issued.code,
  });
  const { delivered } = await sendEmail({
    to: session.email,
    subject: copy.subject,
    text: copy.text,
    category: copy.category,
  });
  if (!delivered && process.env.NODE_ENV === "production") {
    return { ok: false, error: "Email is not configured" };
  }
  return { ok: true };
}

export async function verifySeekerEmailAction(input: {
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSeekerSession();
  const consumed = await consumeEmailChallenge({
    purpose: "seeker_verify",
    email: session.email,
    code: input.code,
  });
  if (!consumed.ok) return consumed;
  await markSeekerEmailVerified(session.email);
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
