import Link from "next/link";
import { listClientsAction } from "@/app/actions/clients";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { PageShell } from "@/components/page-shell";
import { StickyClientFilterBanner } from "@/components/sticky-client-filter-banner";
import { Plus, Users } from "lucide-react";
import { ClientsPageActions } from "@/components/clients-page-actions";
import { ClientsStageFilter } from "@/components/clients-stage-filter";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const rows = await listClientsAction();

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description={`${rows.length} in this organization`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientsPageActions />
            <Link href="/clients/new">
              <Button>
                <Plus className="h-4 w-4" />
                Full intake
              </Button>
            </Link>
          </div>
        }
      />

      <StickyClientFilterBanner />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No clients yet"
          description="Quick-add a walk-in with name and phone, or run full intake with goals, measurements, and screens."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ClientsPageActions />
              <Link href="/clients/new">
                <Button variant="secondary">Full intake</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <ClientsStageFilter
          clients={rows.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            phone: c.phone,
            goals: c.goals,
            status: c.status,
          }))}
        />
      )}
    </PageShell>
  );
}
