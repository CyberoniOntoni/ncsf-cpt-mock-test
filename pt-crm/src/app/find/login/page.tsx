import { redirect } from "next/navigation";

export default function FindLoginRedirect() {
  redirect("/portal/login");
}
