import { notFound } from "next/navigation";
import { getSessionAction } from "@/app/actions/sessions";
import { SessionLogger } from "@/components/session-logger";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSessionAction(id);
  if (!data) notFound();

  return (
    <SessionLogger
      session={data.session}
      client={data.client}
      program={data.program}
      logs={data.logs}
    />
  );
}
