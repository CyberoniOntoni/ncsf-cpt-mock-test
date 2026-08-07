import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  NotebookPen,
  Receipt,
  Timer,
} from "lucide-react";
import {
  timelineKindLabel,
  type ClientTimelineItem,
  type TimelineKind,
  type TimelineTone,
} from "@/lib/client-timeline";
import { cn } from "@/lib/utils";
import { Badge, EmptyState, SectionLabel } from "./ui";

function KindIcon({ kind }: { kind: TimelineKind }) {
  const cls = "h-3.5 w-3.5";
  switch (kind) {
    case "session":
      return <Timer className={cls} aria-hidden />;
    case "appointment":
      return <CalendarDays className={cls} aria-hidden />;
    case "task":
      return <CheckCircle2 className={cls} aria-hidden />;
    case "checkin":
      return <MessageSquare className={cls} aria-hidden />;
    case "invoice":
      return <Receipt className={cls} aria-hidden />;
    case "note":
      return <NotebookPen className={cls} aria-hidden />;
  }
}

function toneDot(tone: TimelineTone): string {
  switch (tone) {
    case "accent":
      return "bg-emerald-500/80 ring-emerald-900/50";
    case "warn":
      return "bg-amber-500/80 ring-amber-900/40";
    case "danger":
      return "bg-red-500/80 ring-red-900/40";
    default:
      return "bg-zinc-500 ring-zinc-800";
  }
}

function badgeTone(
  tone: TimelineTone
): "default" | "green" | "amber" | "red" {
  if (tone === "accent") return "green";
  if (tone === "warn") return "amber";
  if (tone === "danger") return "red";
  return "default";
}

function fmtWhen(ms: number) {
  try {
    return new Date(ms).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ClientTimeline({
  items,
  clientId,
}: {
  items: ClientTimelineItem[];
  clientId: string;
}) {
  return (
    <section
      id="timeline"
      aria-label="Client timeline"
      className="scroll-mt-client"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-emerald-500/80" />
          <SectionLabel as="h2" className="mb-0">
            Timeline
          </SectionLabel>
        </div>
        <p className="text-[11px] text-zinc-600">
          Sessions · bookings · invoices · tasks · check-ins
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No activity yet"
          description="Book a session, log a check-in, or complete a floor session — it shows up here."
          action={
            <Link
              href={`/?client=${clientId}`}
              className="text-sm font-medium text-emerald-400 hover:underline"
            >
              Open Today →
            </Link>
          }
          className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 py-6"
        />
      ) : (
        <ol className="relative space-y-0 border-l border-zinc-800 ml-2 pl-0">
          {items.map((item, i) => {
            const when = fmtWhen(item.at);
            const inner = (
              <>
                <span
                  className={cn(
                    "absolute -left-[5px] top-3.5 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-950",
                    toneDot(item.tone)
                  )}
                  aria-hidden
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        <KindIcon kind={item.kind} />
                        {timelineKindLabel(item.kind)}
                      </span>
                      {item.badge && (
                        <Badge
                          tone={badgeTone(item.tone)}
                          className="capitalize"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-zinc-100">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">
                        {item.subtitle}
                      </p>
                    )}
                    {when && (
                      <p className="mt-1 text-[11px] tabular-nums text-zinc-600">
                        {when}
                      </p>
                    )}
                  </div>
                </div>
              </>
            );

            const rowClass = cn(
              "relative ml-4 flex gap-3 rounded-lg border border-transparent px-2 py-2.5 transition",
              item.href &&
                "hover:border-zinc-800 hover:bg-zinc-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
              i === 0 && "pt-1"
            );

            if (item.href) {
              const external = item.href.startsWith("/");
              if (external) {
                return (
                  <li key={item.id}>
                    <Link href={item.href} className={rowClass}>
                      {inner}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={item.id}>
                  <a href={item.href} className={rowClass}>
                    {inner}
                  </a>
                </li>
              );
            }

            return (
              <li key={item.id}>
                <div className={rowClass}>{inner}</div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
