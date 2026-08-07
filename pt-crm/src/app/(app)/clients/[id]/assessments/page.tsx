import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientAction } from "@/app/actions/clients";
import { ClientAssessmentsPanel } from "@/components/client-assessments-panel";
import { ClientStickySync } from "@/components/client-sticky-sync";
import { PageShell } from "@/components/page-shell";
import { Button, PageHeader } from "@/components/ui";
import { fullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientAssessmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getClientAction(id);
  if (!data) notFound();
  const { client, assessments } = data;
  const name = fullName(client.firstName, client.lastName);

  return (
    <PageShell className="space-y-4">
      <ClientStickySync clientId={client.id} name={name} />

      <div>
        <Link
          href={`/clients/${client.id}`}
          className="text-xs font-medium text-emerald-400 hover:underline"
        >
          ← {name}
        </Link>
        <PageHeader
          eyebrow="Screens"
          title="Assessments"
          description={`Movement screens for ${name} — run, re-test, and compare to baseline.`}
          className="mb-0 mt-2"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/clients/${client.id}#progress`}>
                <Button variant="secondary" size="sm">
                  Progress
                </Button>
              </Link>
              <Link href={`/clients/${client.id}`}>
                <Button variant="ghost" size="sm">
                  Profile
                </Button>
              </Link>
            </div>
          }
        />
      </div>

      <ClientAssessmentsPanel
        clientId={client.id}
        assessments={assessments}
      />
    </PageShell>
  );
}
