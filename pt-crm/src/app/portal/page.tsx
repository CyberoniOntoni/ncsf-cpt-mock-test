import { redirect } from "next/navigation";
import { readClientSession } from "@/lib/client-auth";

export default async function PortalIndexPage() {
  const session = await readClientSession();
  redirect(session ? "/portal/dashboard" : "/portal/login");
}
