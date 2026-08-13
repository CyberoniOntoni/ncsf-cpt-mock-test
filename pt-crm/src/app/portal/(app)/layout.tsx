import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import {
  clientNeedsOnboarding,
  requireClientSession,
} from "@/lib/client-auth";

export default async function PortalAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireClientSession();
  const needs = await clientNeedsOnboarding(
    session.organizationId,
    session.clientId
  );
  if (needs) redirect("/portal/onboarding");

  return <PortalShell studioName={session.organizationName}>{children}</PortalShell>;
}
