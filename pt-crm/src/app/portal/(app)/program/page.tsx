import Link from "next/link";
import { requireClientSession, resolvePortalStudio } from "@/lib/client-auth";
import { getPortalActiveProgram } from "@/db/queries/portal";
import { PortalProgramView } from "@/components/portal/portal-program-view";

export default async function PortalProgramPage() {
  const session = await requireClientSession();
  const studio = await resolvePortalStudio(session);
  if (!studio) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Program</h1>
        <p className="text-sm text-zinc-400">
          Your program appears here after a trainer accepts you.
        </p>
        <Link
          href="/portal/find"
          className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-400"
        >
          Find a trainer
        </Link>
      </div>
    );
  }
  const program = await getPortalActiveProgram(
    studio.organizationId,
    studio.clientId
  );

  return <PortalProgramView data={program} ownerKey={session.email} />;
}
