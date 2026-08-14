import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import {
  clientNeedsOnboarding,
  requireClientSession,
  resolvePortalStudio,
} from "@/lib/client-auth";

export default async function PortalAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireClientSession();
  const studio = await resolvePortalStudio(session);
  if (studio) {
    const needs = await clientNeedsOnboarding(
      studio.organizationId,
      studio.clientId
    );
    if (needs) redirect("/portal/onboarding");
  }

  return (
    <PortalShell studioName={studio?.organizationName || "Your profile"}>
      {children}
    </PortalShell>
  );
}
