import Link from "next/link";
import { listSessionsAction } from "@/app/actions/sessions";
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
import { SessionHistoryRow } from "@/components/session-history-row";
import { StickyClientFilterBanner } from "@/components/sticky-client-filter-banner";
import { ChevronRight, Timer } from "lucide-react";
import { fullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatWhen(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const sp = await searchParams;
  const clientId = sp.client?.trim() || undefined;
  const listOpts = clientId ? { clientId } : undefined;
  const programsHref = clientId
    ? `/programs?client=${encodeURIComponent(clientId)}`
    : "/programs";

  const [inProgress, rows, filterBundle] = await Promise.all([
    listSessionsAction({ ...listOpts, status: "in_progress", limit: 20 }),
    listSessionsAction({ ...listOpts, limit: 40 }),
    clientId ? getClientAction(clientId).catch(() => null) : Promise.resolve(null),
  ]);
  const history = rows.filter((s) => s.status !== "in_progress");
  const filterClient = filterBundle?.client ?? null;
  const filterName = filterClient
    ? fullName(filterClient.firstName, filterClient.lastName)
    : null;

  return (
    <PageShell>
      <PageHeader
        title="Sessions"
        eyebrow={<AreaEyebrow areaId="plans" current="Sessions" />}
        description="Floor logs · resume unfinished · remove past sessions you don’t need"
        actions={
          <Link href={programsHref}>
            <Button variant="secondary" size="sm">
              Start from program
            </Button>
          </Link>
        }
      />

      <StickyClientFilterBanner
        listPath="/sessions"
        filterClientId={clientId}
      />

      {filterName && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
          <span>
            Filtered to{" "}
            <span className="font-medium text-zinc-200">{filterName}</span>
          </span>
          <Link
            href="/sessions"
            className="font-medium text-emerald-400 hover:underline"
          >
            Show all
          </Link>
        </div>
      )}

      {inProgress.length > 0 && (
        <section className="mb-8">
          <SectionLabel as="h2" className="mb-2.5 text-amber-400/90">
            In progress — tap to resume
          </SectionLabel>
          <div className="grid gap-2">
            {inProgress.map((s) => (
              <ListRow
                key={s.id}
                href={`/sessions/${s.id}`}
                tone="warn"
                leading={
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-950/60 text-amber-300 ring-1 ring-amber-800/50">
                    <Timer className="h-4 w-4" />
                  </span>
                }
                title={s.title}
                subtitle={
                  <>
                    {s.updatedAt ? `Updated ${formatWhen(s.updatedAt)}` : "Open"}
                    {s.clientName ? ` · ${s.clientName}` : ""}
                  </>
                }
                trailing={
                  <span className="inline-flex items-center gap-1.5">
                    <Badge tone="amber">Live</Badge>
                    <span className="hidden text-xs font-medium text-emerald-400 sm:inline">
                      Resume session
                    </span>
                    <ChevronRight className="h-4 w-4 text-amber-500/80" />
                  </span>
                }
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel as="h2" className="mb-2.5">
          History
        </SectionLabel>
        {history.length === 0 && inProgress.length === 0 ? (
          <EmptyState
            icon={<Timer className="h-5 w-5" />}
            title={filterName ? `No sessions for ${filterName}` : "No sessions yet"}
            description="Open a program and tap Start session on a day. Unfinished sessions appear here so you can resume."
            action={
              <Link href={programsHref}>
                <Button>Go to programs</Button>
              </Link>
            }
          />
        ) : history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 px-3 py-3 text-sm text-zinc-500">
            No completed sessions yet — finish an in-progress session above.
          </p>
        ) : (
          <div className="grid gap-2">
            {history.map((s) => (
              <SessionHistoryRow
                key={s.id}
                id={s.id}
                title={s.title}
                status={s.status}
                subtitle={
                  <>
                    {s.performedAt ? formatWhen(s.performedAt) : ""}
                    {s.clientName ? ` · ${s.clientName}` : ""}
                    {s.durationMin != null ? ` · ${s.durationMin} min` : ""}
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
