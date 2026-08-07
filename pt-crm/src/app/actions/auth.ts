"use server";

import { redirect } from "next/navigation";
import { loginWithPassword, logout } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const result = await loginWithPassword(email, password);
  if ("error" in result) {
    redirect(`/login?error=${encodeURIComponent(result.error ?? "Login failed")}`);
  }
  redirect("/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
