import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/portal/onboarding-form";
import {
  clientNeedsOnboarding,
  requireClientSession,
} from "@/lib/client-auth";
import { getPortalDocuments } from "@/db/queries/portal";

export default async function PortalOnboardingPage() {
  const session = await requireClientSession();
  const needs = await clientNeedsOnboarding(
    session.organizationId,
    session.clientId
  );
  if (!needs) redirect("/portal/dashboard");

  const documents = await getPortalDocuments(
    session.organizationId,
    session.clientId
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {session.organizationName}
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Before we start</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Sign the waiver and PAR-Q. This is a coaching record, not medical
        clearance.
      </p>
      <div className="mt-6">
        <OnboardingForm documents={documents} />
      </div>
    </div>
  );
}
