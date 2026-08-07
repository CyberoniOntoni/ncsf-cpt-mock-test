"use server";

import { redirect } from "next/navigation";
import {
  changeUserPassword,
  loginWithPassword,
  logout,
  registerTrainer,
  updateOrganizationProfile,
  updateUserProfile,
} from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const result = await loginWithPassword(email, password);
  if ("error" in result && result.error) {
    redirect(`/login?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/");
}

export async function registerAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirmPassword") || "");
  if (password !== confirm) {
    redirect(
      `/register?error=${encodeURIComponent("Passwords do not match")}`
    );
  }
  const result = await registerTrainer({
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
    redirect(`/register?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/");
}

export async function logoutAction() {
  await logout();
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
