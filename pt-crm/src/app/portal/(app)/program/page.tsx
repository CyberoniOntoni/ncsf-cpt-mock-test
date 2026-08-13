import { requireClientSession } from "@/lib/client-auth";
import { getPortalActiveProgram } from "@/db/queries/portal";
import { PortalProgramView } from "@/components/portal/portal-program-view";

export default async function PortalProgramPage() {
  const session = await requireClientSession();
  const program = await getPortalActiveProgram(
    session.organizationId,
    session.clientId
  );

  return <PortalProgramView data={program} />;
}
