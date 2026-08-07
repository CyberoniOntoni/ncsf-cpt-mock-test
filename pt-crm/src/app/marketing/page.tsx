import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Dumbbell,
  Receipt,
  Server,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#day", label: "The day" },
  { href: "#host", label: "Self-host" },
] as const;

const FEATURES = [
  {
    icon: Timer,
    title: "Floor command",
    body: "Today board with sticky client, open sessions, 48h agenda, and Needs you. One primary action: Start or Resume.",
  },
  {
    icon: Dumbbell,
    title: "Session log → pack burn",
    body: "Sets, RPE, cues. Complete once and an active pack loses a credit. Closing a calendar slot alone never fakes a burn.",
  },
  {
    icon: Users,
    title: "CRM spine",
    body: "Stage, packs, bookings, check-ins, tasks, invoices — plus a timeline that merges the relationship in one feed.",
  },
  {
    icon: CalendarDays,
    title: "Bookings ↔ floor",
    body: "Month calendar, deep-link book, start session from a booking. Past-due stays visible until you close it.",
  },
  {
    icon: Receipt,
    title: "Manual invoices",
    body: "What they owe, mark paid when settled. Unpaid shows on Needs you. No card processor required for pilot.",
  },
  {
    icon: Sparkles,
    title: "Coach assist",
    body: "Playbook-backed coaching (NCSF-informed). Optional LLM when you set a key — rule-based works without one.",
  },
] as const;

const DAY = [
  {
    t: "Open Today",
    d: "Sticky client, agenda, Needs you — know who needs you before the first set.",
  },
  {
    t: "Start session",
    d: "From a program day or booking. Log loads on the floor, not after the fact.",
  },
  {
    t: "Complete",
    d: "Pack burns, summary ready to share, book next, check-in, renew if empty.",
  },
  {
    t: "Between sessions",
    d: "Tasks, invoices, stage, quiet leads — the spine that keeps the week moving.",
  },
] as const;

const FOR = [
  "Solo PTs and micro-studios",
  "Trainers who live on the floor",
  "Self-host pilots (laptop → LXC)",
] as const;

const NOT_FOR = [
  "Multi-site franchise ERP",
  "Client self-service apps",
  "Card checkout & tax engines",
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-500/90">
      {children}
    </p>
  );
}

/** Decorative product chrome — not interactive */
function FloorMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-2xl shadow-black/50"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-zinc-800/90 px-3 py-2.5">
        <span className="h-2 w-2 rounded-full bg-zinc-700" />
        <span className="h-2 w-2 rounded-full bg-zinc-700" />
        <span className="h-2 w-2 rounded-full bg-zinc-700" />
        <span className="ml-2 text-[10px] font-medium text-zinc-600">
          Today · Floor
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/80">
              Floor · Fri
            </p>
            <p className="text-sm font-semibold text-zinc-100">Marcus Chen</p>
          </div>
          <span className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white">
            Start session
          </span>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Agenda · 48h
          </p>
          <p className="mt-1 text-xs text-zinc-300">
            Training session · Fri 9:00 PM
          </p>
        </div>
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/90">
            Needs you · 1
          </p>
          <p className="mt-1 text-xs text-zinc-300">
            10-pack · SGD 600 unpaid
          </p>
        </div>
        <div className="flex gap-2 text-[10px] text-zinc-600">
          <span className="rounded-md border border-zinc-800 px-2 py-1">
            9 left
          </span>
          <span className="rounded-md border border-zinc-800 px-2 py-1">
            Profile
          </span>
          <span className="rounded-md border border-zinc-800 px-2 py-1">
            Check-in
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-emerald-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <BrandMark href="/marketing" size="md" />
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Product"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-zinc-400 transition hover:text-zinc-100"
            >
              Sign in
            </Link>
            <Link href="/register" className="inline-flex">
              <Button size="sm" className="min-h-11 px-3">
                Create studio
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-zinc-800/60">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 90% 70% at 20% -20%, rgba(16,185,129,0.2), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 40%, rgba(16,185,129,0.07), transparent 50%)",
            }}
          />
          <div className="relative mx-auto grid max-w-5xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10 lg:py-24">
            <div>
              <SectionLabel>Floor OS · personal trainers</SectionLabel>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl sm:leading-[1.08]">
                Run the floor.
                <span className="mt-1 block text-emerald-400">
                  Not the paperwork.
                </span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
                FloorScribe is the day board for PTs — sessions, packs,
                bookings, check-ins, invoices, and coach — designed for the gym
                floor first, desk second.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/register" className="inline-flex">
                  <Button size="lg" className="min-h-11 gap-2 px-5">
                    Create your studio
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
                <Link href="/login" className="inline-flex">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="min-h-11 px-5"
                  >
                    Sign in
                  </Button>
                </Link>
              </div>
              <p className="mt-5 text-xs text-zinc-600">
                Self-host first · one volume to back up · no card processor
                required
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
              <FloorMock />
            </div>
          </div>
        </section>

        {/* For / not for */}
        <section className="border-b border-zinc-800/60">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:grid-cols-2 sm:px-6 sm:py-14">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
              <SectionLabel>Built for</SectionLabel>
              <ul className="mt-4 space-y-2.5">
                {FOR.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2.5 text-sm text-zinc-300"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/20 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                Not trying to be
              </p>
              <ul className="mt-4 space-y-2.5">
                {NOT_FOR.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2.5 text-sm text-zinc-500"
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-700"
                      aria-hidden
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Problem / board */}
        <section className="border-b border-zinc-800/60">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:grid-cols-2 sm:gap-10 sm:px-6 sm:py-16">
            <div>
              <SectionLabel>The mess</SectionLabel>
              <p className="mt-3 text-xl font-medium leading-snug text-zinc-100 sm:text-2xl">
                Notes in chat. Packs in a sheet. Calendar elsewhere. Money in
                your head.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                Generic CRMs want pipelines. Spreadsheets don’t burn a pack when
                you complete a session. FloorScribe keeps the commercial spine
                next to the floor log — without enterprise gym bloat.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/25 p-5 sm:p-6">
              <SectionLabel>The board</SectionLabel>
              <p className="mt-3 text-xl font-medium leading-snug text-zinc-50 sm:text-2xl">
                One Today view. Sticky client. Needs you. Agenda. Start.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-emerald-100/65">
                Between sessions: stage, pack, book, invoice, check-in. On the
                floor: log, complete, share, rebook. Docker + PGlite — one volume
                to back up when you go to LXC.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="scroll-mt-20 border-b border-zinc-800/60"
        >
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
            <SectionLabel>Capabilities</SectionLabel>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              What’s in the box
            </h2>
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Enough for a solo studio pilot. Not a franchise ERP.
            </p>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="group rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/30"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-900/40 bg-emerald-950/40 text-emerald-400 transition group-hover:border-emerald-800/50">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-zinc-100">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Day flow */}
        <section id="day" className="scroll-mt-20 border-b border-zinc-800/60">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
            <SectionLabel>Happy path</SectionLabel>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              A training day
            </h2>
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              From open board to close-loop — the loop FloorScribe is built for.
            </p>
            <ol className="relative mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {DAY.map((step, i) => (
                <li
                  key={step.t}
                  className={cn(
                    "relative rounded-xl border border-zinc-800 bg-zinc-900/30 p-4",
                    i < DAY.length - 1 &&
                      "lg:after:absolute lg:after:right-0 lg:after:top-1/2 lg:after:hidden lg:after:h-px lg:after:w-3 lg:after:translate-x-full lg:after:-translate-y-1/2 lg:after:bg-zinc-800 xl:after:block"
                  )}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-900/50 bg-emerald-950/40 text-[11px] font-bold tabular-nums text-emerald-400">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-zinc-100">
                    {step.t}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                    {step.d}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Self-host */}
        <section id="host" className="scroll-mt-20">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/50 via-zinc-950 to-zinc-950 p-6 sm:p-10">
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl"
                aria-hidden
              />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 text-emerald-400/90">
                    <Server className="h-4 w-4" aria-hidden />
                    <SectionLabel>Pilot & deploy</SectionLabel>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                    Your machine. Your LXC. Your volume.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                    FloorScribe is self-host first. Create a studio on this
                    instance, or use the local demo seed. Data lives in one
                    PGlite volume — back it up before busy weeks. Ship with
                    Docker on Proxmox when the laptop isn’t enough.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="/register" className="inline-flex">
                      <Button size="lg" className="min-h-11 gap-2 px-5">
                        Create studio account
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Button>
                    </Link>
                    <Link href="/login" className="inline-flex">
                      <Button
                        size="lg"
                        variant="secondary"
                        className="min-h-11 px-5"
                      >
                        Sign in
                      </Button>
                    </Link>
                  </div>
                  <p className="mt-6 text-xs leading-relaxed text-zinc-600">
                    Local demo seed:{" "}
                    <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-500">
                      pt@demo.local
                    </code>{" "}
                    /{" "}
                    <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-500">
                      trainer123
                    </code>
                  </p>
                </div>
                <ul className="shrink-0 space-y-2 text-sm text-zinc-500 sm:pt-8">
                  {[
                    "Register → own studio",
                    "Settings → profile & password",
                    "Docker · DEPLOY.md for LXC",
                  ].map((line) => (
                    <li key={line} className="flex items-center gap-2">
                      <Check
                        className="h-4 w-4 text-emerald-500/80"
                        aria-hidden
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800/80">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <BrandMark href="/marketing" />
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-600">
              Floor OS for personal trainers — sessions, clients, programs, CRM.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
            <a href="#features" className="min-h-11 inline-flex items-center hover:text-zinc-300">
              Features
            </a>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center hover:text-zinc-300"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center hover:text-zinc-300"
            >
              Create studio
            </Link>
            <a
              href="https://github.com/CyberoniOntoni/floorscribe"
              className="inline-flex min-h-11 items-center hover:text-zinc-300"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </div>
        </div>
        <p className="border-t border-zinc-900/80 px-4 py-4 text-center text-[11px] leading-relaxed text-zinc-700">
          FloorScribe provides coaching support tools for qualified personal
          trainers. It does not diagnose medical conditions. Refer red-flag
          symptoms to appropriate clinicians.
        </p>
      </footer>
    </>
  );
}
