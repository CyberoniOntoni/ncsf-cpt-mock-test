"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { seedIfNeeded } from "@/db/seed";
import {
  listPortalStudiosForEmail,
  logoutClientPortal,
  requestClientOtp,
  verifyClientOtp,
} from "@/lib/client-auth";

async function requestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  };
}

export async function lookupPortalStudiosAction(email: string) {
  await seedIfNeeded();
  return listPortalStudiosForEmail(email);
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
