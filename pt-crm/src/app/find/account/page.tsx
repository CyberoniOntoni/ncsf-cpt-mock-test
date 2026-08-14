import { redirect } from "next/navigation";

export default function FindAccountRedirect() {
  redirect("/portal/profile");
}
