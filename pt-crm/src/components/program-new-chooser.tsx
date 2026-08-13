import Link from "next/link";
import { FocusShell } from "@/components/page-shell";
import { Badge, Card } from "@/components/ui";
import { PenLine, Sparkles } from "lucide-react";

function withClient(path: string, clientId?: string | null) {
  if (!clientId) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}client=${encodeURIComponent(clientId)}`;
}

export function ProgramNewChooser({
  clientId,
}: {
  clientId?: string | null;
}) {
  return (
    <FocusShell className="space-y-4">
      <div>
        <Link
          href={
            clientId
              ? `/programs?client=${encodeURIComponent(clientId)}`
              : "/programs"
          }
          className="inline-flex min-h-9 items-center text-xs font-medium text-emerald-400 hover:underline"
        >
          ← Programs
        </Link>
        <p className="section-label mb-1 mt-2 text-emerald-500/90">Programs</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          New program
        </h1>
        <p className="mt-1 max-w-xl text-sm text-zinc-500">
          {clientId
            ? "Auto-design a week, or build a blank shell day by day."
            : "Auto-design a week, or craft a blank template you can reuse."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={withClient("/programs/new?mode=wizard", clientId)}
          className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
        >
          <Card className="h-full border-emerald-900/30 transition group-hover:border-emerald-700/50 group-hover:bg-emerald-950/15">
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-950/50 text-emerald-400 ring-1 ring-emerald-800/40">
                <Sparkles className="h-5 w-5" />
              </div>
              <Badge tone="green">Recommended</Badge>
            </div>
            <h2 className="mt-3 text-base font-semibold text-zinc-50">
              Auto-design
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
              Fills a week from the exercise bank using the client&apos;s
              screens, measurements, injuries, and chosen gear (floor, home, or
              both). Preview, pin lifts, then save.
            </p>
            <ul className="mt-3 space-y-1 text-[11px] text-zinc-600">
              <li>
                · Screens + measurements → corrective warm-ups and safer
                main-lift swaps
              </li>
              <li>· Floor / home / combined gear; pin exercises you want to keep</li>
            </ul>
            <p className="mt-3 text-xs font-medium text-emerald-400 group-hover:underline">
              Open wizard →
            </p>
          </Card>
        </Link>

        <Link
          href={withClient("/programs/new?mode=scratch", clientId)}
          className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
        >
          <Card className="h-full transition group-hover:border-zinc-600 group-hover:bg-zinc-900/40">
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700">
                <PenLine className="h-5 w-5" />
              </div>
              <Badge tone="amber">Manual</Badge>
            </div>
            <h2 className="mt-3 text-base font-semibold text-zinc-50">
              Build from scratch
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
              Named empty days (full body, upper/lower, PPL, blank). You pick
              every exercise. Save unassigned for later reuse.
            </p>
            <ul className="mt-3 space-y-1 text-[11px] text-zinc-600">
              <li>· Full control of order & prescription</li>
              <li>· Reuse templates across clients</li>
            </ul>
            <p className="mt-3 text-xs font-medium text-zinc-300 group-hover:text-emerald-400 group-hover:underline">
              Start blank →
            </p>
          </Card>
        </Link>
      </div>
    </FocusShell>
  );
}
