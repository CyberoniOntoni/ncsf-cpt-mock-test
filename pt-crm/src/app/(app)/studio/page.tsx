import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Dumbbell,
  History,
  Settings,
  Wrench,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, PageHeader, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Studio",
  description: "Library, knowledge, coach history, and settings.",
};

const tiles = [
  {
    href: "/library",
    title: "Exercise library",
    blurb: "Bank, cues, and filters for programming and coach.",
    icon: Dumbbell,
  },
  {
    href: "/library/equipment",
    title: "Equipment",
    blurb: "What your studio has on the floor.",
    icon: Wrench,
  },
  {
    href: "/knowledge",
    title: "Knowledge",
    blurb: "Playbooks and NCSF-informed coaching cards.",
    icon: BookOpen,
  },
  {
    href: "/history",
    title: "Coach history",
    blurb: "Past assistant threads — not a primary floor tab.",
    icon: History,
  },
  {
    href: "/settings",
    title: "Settings",
    blurb: "Org, deploy health, AI provider.",
    icon: Settings,
  },
] as const;

export default function StudioPage() {
  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Studio"
        eyebrow="Studio"
        description="Reference tools hang here — not on the floor bar. Open a client or Today when it’s time to train."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "group flex min-h-11 items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition",
                "hover:border-zinc-700 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              )}
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-emerald-400/90 transition group-hover:border-emerald-900/50">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-100 group-hover:text-white">
                  {t.title}
                </p>
                <p className="mt-0.5 text-sm text-zinc-500">{t.blurb}</p>
              </div>
              <ChevronRight
                className="mt-1 h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-emerald-400/80"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
      <Card padding="sm" className="border-zinc-800/80">
        <SectionLabel>Floor vs studio</SectionLabel>
        <p className="mt-1.5 text-sm text-zinc-400">
          <Link
            href="/"
            className="rounded-sm font-medium text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            Today
          </Link>{" "}
          and{" "}
          <Link
            href="/clients"
            className="rounded-sm font-medium text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            People
          </Link>{" "}
          own the day. Plans hold programs and session logs. Studio is for bank,
          playbooks, and admin.
        </p>
      </Card>
    </PageShell>
  );
}
