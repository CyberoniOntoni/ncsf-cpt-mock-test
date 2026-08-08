import { notFound } from "next/navigation";
import { getProgramAction } from "@/app/actions/programs";
import { listClientsAction } from "@/app/actions/clients";
import { ProgramDetail } from "@/components/program-detail";

export const dynamic = "force-dynamic";

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ build?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getProgramAction(id);
  if (!data) notFound();
  const clients = await listClientsAction();

  return (
    <ProgramDetail
      program={data.program}
      client={data.client}
      days={data.days}
      clients={clients.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
      }))}
      startInBuildMode={sp.build === "1"}
    />
  );
}
