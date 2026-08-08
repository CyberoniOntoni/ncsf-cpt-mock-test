import Link from "next/link";
import { listProgramsAction } from "@/app/actions/programs";
import { getClientAction } from "@/app/actions/clients";
import { AreaEyebrow } from "@/components/area-eyebrow";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  SectionLabel,
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

function statusTone(status: string): "green" | "default" | "amber" {
  if (status === "active") return "green";
  if (status === "draft") return "amber";
  return "default";
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

  const active = rows.filter((p) => p.status === "active");
  const rest = rows.filter((p) => p.status !== "active");

  function ProgramRow({
    p,
  }: {
    p: (typeof rows)[number];
  }) {
    const isActive = p.status === "active";
    return (
      <ListRow
        href={`/programs/${p.id}`}
        tone={isActive ? "accent" : "default"}
        leading={
          <span
            className={
              "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-semibold tabular-nums leading-tight " +
              (isActive
                ? "bg-emerald-950/70 text-emerald-300 ring-1 ring-emerald-800/50"
                : "bg-zinc-800 text-zinc-300")
            }
          >
            <span className="text-sm leading-none">{p.daysPerWeek}</span>
            <span className="text-[9px] font-medium uppercase tracking-wide opacity-80">
              day
            </span>
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate">{p.title}</span>
            {p.clientName ? (
              <span className="truncate text-xs font-normal text-zinc-400">
                {p.clientName}
              </span>
            ) : (
              <span className="text-xs font-normal text-zinc-600">
                Unassigned
              </span>
            )}
          </span>
        }
        subtitle={
          <>
            {p.daysPerWeek}×/wk · {p.sessionMinutes} min ·{" "}
            {humanize(p.splitType)} · {humanize(p.goal)}
          </>
        }
        trailing={
          <span className="inline-flex items-center gap-1.5">
            <Badge tone={statusTone(p.status)} className="capitalize">
              {humanize(p.status)}
            </Badge>
            {isActive && (
              <span className="hidden text-xs font-medium text-emerald-400 sm:inline">
                Open
              </span>
            )}
            <ChevronRight
              className={
                "h-4 w-4 " +
                (isActive ? "text-emerald-600/80" : "text-zinc-600")
              }
            />
          </span>
        }
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Programs"
        eyebrow={<AreaEyebrow areaId="plans" current="Programs" />}
        description="Build plans from your bank and floor equipment — then start a session from any day"
        actions={
          <Link href={newHref}>
            <Button className="min-h-11">
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
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5 text-xs text-zinc-400">
          <span>
            Showing plans for{" "}
            <span className="font-medium text-zinc-200">{filterName}</span>
          </span>
          <Link
            href="/programs"
            className="inline-flex min-h-9 items-center font-medium text-emerald-400 hover:underline"
          >
            Show all
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={
            filterName ? `No programs for ${filterName}` : "No programs yet"
          }
          description={
            filterName
              ? "Design a plan for this client from their goals, constraints, and the gear you have on the floor."
              : "Pick a client (optional), set days and goal, preview the split, then save. You can swap exercises anytime."
          }
          action={
            <Link href={newHref}>
              <Button className="min-h-11">Design a program</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <SectionLabel as="h2" className="mb-2.5 text-emerald-400/90">
                Active — ready on the floor
              </SectionLabel>
              <div className="grid gap-2">
                {active.map((p) => (
                  <ProgramRow key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section>
              <SectionLabel as="h2" className="mb-2.5">
                {active.length > 0 ? "Drafts & archived" : "All programs"}
              </SectionLabel>
              <div className="grid gap-2">
                {rest.map((p) => (
                  <ProgramRow key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
