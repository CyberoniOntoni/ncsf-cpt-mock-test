import Link from "next/link";
import { listProgramsAction } from "@/app/actions/programs";
import { getClientAction } from "@/app/actions/clients";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { PageShell } from "@/components/page-shell";
import { ListRow } from "@/components/list-row";
import { StickyClientFilterBanner } from "@/components/sticky-client-filter-banner";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { fullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const sp = await searchParams;
  const clientId = sp.client?.trim() || undefined;
  const [rows, filterBundle] = await Promise.all([
    listProgramsAction(clientId),
    clientId ? getClientAction(clientId).catch(() => null) : Promise.resolve(null),
  ]);
  const filterClient = filterBundle?.client ?? null;
  const filterName = filterClient
    ? fullName(filterClient.firstName, filterClient.lastName)
    : null;
  const newHref = clientId
    ? `/programs/new?client=${encodeURIComponent(clientId)}`
    : "/programs/new";

  return (
    <PageShell>
      <PageHeader
        title="Programs"
        description="Guided designs from your exercise bank and available equipment"
        actions={
          <Link href={newHref}>
            <Button>
              <Plus className="h-4 w-4" />
              New program
            </Button>
          </Link>
        }
      />

      <StickyClientFilterBanner
        programsHref
        listPath="/programs"
        filterClientId={clientId}
      />

      {filterName && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
          <span>
            Filtered to{" "}
            <span className="font-medium text-zinc-200">{filterName}</span>
          </span>
          <Link
            href="/programs"
            className="font-medium text-emerald-400 hover:underline"
          >
            Show all
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={filterName ? `No programs for ${filterName}` : "No programs yet"}
          description={
            filterName
              ? "Design a plan for this client from equipment and goals."
              : "Use the guided builder or ask the coach to create a program for a selected client."
          }
          action={
            <Link href={newHref}>
              <Button>Design a program</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-2">
          {rows.map((p) => (
            <ListRow
              key={p.id}
              href={`/programs/${p.id}`}
              tone={p.status === "active" ? "accent" : "default"}
              leading={
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-[11px] font-semibold tabular-nums text-zinc-300">
                  {p.daysPerWeek}d
                </span>
              }
              title={p.title}
              subtitle={
                <>
                  {p.daysPerWeek}×/wk · {p.sessionMinutes} min ·{" "}
                  {humanize(p.splitType)}
                  {p.clientName ? ` · ${p.clientName}` : " · unassigned"}
                </>
              }
              trailing={
                <span className="inline-flex items-center gap-1.5">
                  <Badge tone={p.status === "active" ? "green" : "default"}>
                    {humanize(p.status)}
                  </Badge>
                  <Badge>{humanize(p.goal)}</Badge>
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </span>
              }
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
