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
  const scratchHref = clientId
    ? `/programs/new?mode=scratch&client=${encodeURIComponent(clientId)}`
    : "/programs/new?mode=scratch";

  const active = rows.filter((p) => p.status === "active");
  /** Drafts with no client — reusable templates / save for later */
  const savedForLater = rows.filter(
    (p) => p.status === "draft" && !p.clientId
  );
  const rest = rows.filter(
    (p) =>
      p.status !== "active" &&
      !(p.status === "draft" && !p.clientId)
  );

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
              <span className="text-xs font-normal text-amber-500/80">
                {p.status === "draft" ? "Template" : "Unassigned"}
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
        description="New program opens a chooser (auto-design or scratch). From scratch jumps to empty days — unassigned drafts land under Saved for later."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={scratchHref}
              title="Empty days — skip the chooser"
              className="inline-flex"
            >
              <Button variant="secondary" className="min-h-11">
                From scratch
              </Button>
            </Link>
            <Link
              href={newHref}
              title="Choose auto-design or build from scratch"
              className="inline-flex"
            >
              <Button className="min-h-11">
                <Plus className="h-4 w-4" />
                New program
              </Button>
            </Link>
          </div>
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
              ? "New program opens a chooser — auto-design from goals and floor gear, or build from scratch for this client."
              : "New program opens a chooser: Auto-design fills a week, or Build from scratch with optional Save for later (unassigned template)."
          }
          action={
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href={scratchHref}
                  title="Empty days — skip the chooser"
                  className="inline-flex"
                >
                  <Button variant="secondary" className="min-h-11">
                    From scratch
                  </Button>
                </Link>
                <Link
                  href={newHref}
                  title="Choose auto-design or build from scratch"
                  className="inline-flex"
                >
                  <Button className="min-h-11">
                    <Plus className="h-4 w-4" />
                    New program
                  </Button>
                </Link>
              </div>
              <p className="max-w-sm text-center text-[11px] leading-relaxed text-zinc-600">
                <span className="text-zinc-500">New program</span> → chooser ·{" "}
                <span className="text-zinc-500">From scratch</span> → blank days
                right away
              </p>
            </div>
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
          {savedForLater.length > 0 && (
            <section className="rounded-xl border border-amber-900/35 bg-amber-950/10 px-3 py-3 sm:px-4 sm:py-3.5">
              <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <SectionLabel as="h2" className="text-amber-400/90">
                  Saved for later
                </SectionLabel>
                <span className="text-[11px] tabular-nums text-zinc-600">
                  {savedForLater.length} template
                  {savedForLater.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mb-3 text-[11px] leading-relaxed text-zinc-500">
                Unassigned drafts you can reuse. Open one, finish exercises, then
                assign a client when you train.
              </p>
              <div className="grid gap-2">
                {savedForLater.map((p) => (
                  <ProgramRow key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section>
              <SectionLabel as="h2" className="mb-2.5">
                {active.length > 0 || savedForLater.length > 0
                  ? "Other drafts & archived"
                  : "All programs"}
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
