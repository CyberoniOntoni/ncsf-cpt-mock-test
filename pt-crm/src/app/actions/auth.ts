"use server";

import { redirect } from "next/navigation";
import {
  acceptInviteExistingUser,
  acceptInviteRegister,
  changeUserPassword,
  createOrgInvite,
  loginWithPassword,
  logout,
  registerSoloTrainer,
  registerStudio,
  revokeOrgInvite,
  updateOrganizationProfile,
  updateUserProfile,
} from "@/lib/auth";

function safeNextPath(raw: unknown): string {
  const next = String(raw || "").trim();
  // Only same-origin relative paths (block open redirects)
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/";
  }
  return next;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = safeNextPath(formData.get("next"));
  const result = await loginWithPassword(email, password);
  if ("error" in result && result.error) {
    const q = new URLSearchParams({ error: result.error });
    if (next !== "/") q.set("next", next);
    redirect(`/login?${q.toString()}`);
  }
  redirect(next);
}

export async function registerSoloAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirmPassword") || "");
  if (password !== confirm) {
    redirect(
      `/register/solo?error=${encodeURIComponent("Passwords do not match")}`
    );
  }
  const result = await registerSoloTrainer({
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    password,
    practiceName: String(formData.get("practiceName") || ""),
    unitSystem: String(formData.get("unitSystem") || "metric"),
    timezone: String(formData.get("timezone") || "UTC"),
    phone: String(formData.get("phone") || ""),
    title: String(formData.get("title") || ""),
  });
  if ("error" in result && result.error) {
    redirect(`/register/solo?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/");
}

export async function registerStudioAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirmPassword") || "");
  if (password !== confirm) {
    redirect(
      `/register/studio?error=${encodeURIComponent("Passwords do not match")}`
    );
  }
  const result = await registerStudio({
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    password,
    studioName: String(formData.get("studioName") || ""),
    unitSystem: String(formData.get("unitSystem") || "metric"),
    timezone: String(formData.get("timezone") || "UTC"),
    phone: String(formData.get("phone") || ""),
    title: String(formData.get("title") || ""),
  });
  if ("error" in result && result.error) {
    redirect(`/register/studio?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/");
}

/** @deprecated prefer registerSoloAction / registerStudioAction */
export async function registerAction(formData: FormData) {
  return registerStudioAction(formData);
}

export async function logoutAction(formData?: FormData) {
  await logout();
  const next = formData ? safeNextPath(formData.get("next")) : "/";
  // Invite: return to the invite page (register or sign-in from there)
  if (next.startsWith("/invite/")) {
    redirect(next);
  }
  if (next.startsWith("/login")) {
    redirect(next);
  }
  if (next !== "/") {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  redirect("/login");
}

export async function updateProfileAction(input: {
  name: string;
  email: string;
  phone?: string;
  title?: string;
}) {
  return updateUserProfile(input);
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return changeUserPassword(input);
}

export async function updateOrganizationAction(input: {
  name: string;
  unitSystem?: string;
  timezone?: string;
}) {
  return updateOrganizationProfile(input);
}

export async function createInviteAction(input: {
  email: string;
  role?: string;
}) {
  return createOrgInvite(input);
}

export async function revokeInviteAction(inviteId: string) {
  return revokeOrgInvite(inviteId);
}

export async function acceptInviteRegisterAction(formData: FormData) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirmPassword") || "");
  if (password !== confirm) {
    redirect(
      `/invite/${encodeURIComponent(token)}?error=${encodeURIComponent("Passwords do not match")}`
    );
  }
  const result = await acceptInviteRegister({
    token,
    name: String(formData.get("name") || ""),
    password,
    phone: String(formData.get("phone") || ""),
    title: String(formData.get("title") || ""),
  });
  if ("error" in result && result.error) {
    redirect(
      `/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(result.error)}`
    );
  }
  redirect("/");
}

export async function acceptInviteExistingAction(token: string) {
  return acceptInviteExistingUser(token);
}
