import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Receipt,
  Sparkles,
  Timer,
  Users,
  ArrowRight,
  Check,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui";

const FEATURES = [
  {
    icon: Timer,
    title: "Floor command",
    body: "Today’s board: sticky client, open sessions, agenda, Needs you. One emerald action — Start or Resume.",
  },
  {
    icon: Dumbbell,
    title: "Session log that burns pack",
    body: "Log sets, RPE, cues. Complete once — pack credit drops, Home refreshes, close-loop prompts rebook and share.",
  },
  {
    icon: Users,
    title: "Client CRM spine",
    body: "Stage, packs, bookings, check-ins, tasks, invoices. Timeline merges the relationship — not five tabs.",
  },
  {
    icon: CalendarDays,
    title: "Bookings ↔ floor",
    body: "Calendar month view. Start session from a booking. Closing a slot doesn’t fake a pack burn.",
  },
  {
    icon: Receipt,
    title: "Simple invoices",
    body: "Record what they owe. Mark paid when cash lands. Unpaid surfaces on Needs you — no card processor required.",
  },
  {
    icon: Sparkles,
    title: "Coach assist",
    body: "Playbook-backed coaching (NCSF-informed). Optional LLM when you set a key — rules work without one.",
  },
] as const;

const DAY = [
  { t: "Open Today", d: "Sticky client, agenda, Needs you." },
  { t: "Start session", d: "Program day or booking → log sets on the floor." },
  { t: "Complete", d: "Pack burns, summary ready to share, book next." },
  { t: "Between sessions", d: "Check-in, task, invoice, renew pack." },
] as const;

const PITCH = [
  "Built for trainers who train people — not for front-desk software bloat",
  "Single studio, self-hosted first (your LXC, your data volume)",
  "Demo in minutes; register your own studio when ready",
] as const;

export default function MarketingPage() {
  return (
    <>
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <BrandMark href="/marketing" size="md" />
          <nav
            className="hidden items-center gap-6 text-sm text-zinc-400 sm:flex"
            aria-label="Marketing"
          >
            <a href="#features" className="hover:text-zinc-100">
              Features
            </a>
            <a href="#day" className="hover:text-zinc-100">
              The day
            </a>
            <a href="#pilot" className="hover:text-zinc-100">
              Pilot
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-zinc-400 hover:text-zinc-100"
            >
              Sign in
            </Link>
            <Link href="/register">
              <Button size="sm" className="min-h-11">
                Create studio
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-zinc-800/60">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(16,185,129,0.22), transparent), radial-gradient(ellipse 50% 40% at 100% 80%, rgba(16,185,129,0.08), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-500/90">
              Floor OS · for personal trainers
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
              Run the floor.
              <span className="block text-emerald-400">Not the paperwork.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              FloorScribe is the day board for PTs: sessions, packs, bookings,
              check-ins, invoices, and coach assist — designed for the gym floor
              first, desk second.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register">
                <Button size="lg" className="min-h-11 gap-2">
                  Start free on your server
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="secondary" className="min-h-11">
                  Sign in
                </Button>
              </Link>
            </div>
            <ul className="mt-10 grid gap-2 sm:grid-cols-3">
              {PITCH.map((line) => (
                <li
                  key={line}
                  className="flex gap-2 text-sm text-zinc-500"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500/90"
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Problem → solution */}
        <section className="border-b border-zinc-800/60">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:grid-cols-2 sm:px-6 sm:py-16">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                The mess
              </h2>
              <p className="mt-3 text-xl font-medium text-zinc-100">
                Notes in chat. Packs in a sheet. Calendar elsewhere. Money in
                your head.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                Generic CRMs want pipelines and funnels. Spreadsheets don’t burn
                a session credit when you complete a set log. FloorScribe keeps
                the commercial spine next to the floor log — without becoming
                “enterprise gym software.”
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-5 sm:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-400/90">
                The board
              </h2>
              <p className="mt-3 text-xl font-medium text-zinc-50">
                One Today view. Sticky client. Needs you. Agenda. Start.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-emerald-100/70">
                Between sessions: stage, pack, book, invoice, check-in. On the
                floor: log, complete, share, rebook. Self-host with Docker +
                PGlite — one volume to back up.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 border-b border-zinc-800/60">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
              What’s in the box
            </h2>
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Enough to run a solo studio pilot. Not a franchise ERP.
            </p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 transition hover:border-zinc-700"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-950/50 text-emerald-400">
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
        <section id="day" className="scroll-mt-16 border-b border-zinc-800/60">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
                  A training day
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  The happy path — from open to close-loop.
                </p>
              </div>
              <ClipboardList
                className="hidden h-8 w-8 text-zinc-700 sm:block"
                aria-hidden
              />
            </div>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DAY.map((step, i) => (
                <li
                  key={step.t}
                  className="relative rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <span className="text-[11px] font-bold tabular-nums text-emerald-500/90">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-zinc-100">
                    {step.t}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">{step.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pilot / CTA */}
        <section id="pilot" className="scroll-mt-16">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="rounded-2xl border border-emerald-900/45 bg-gradient-to-br from-emerald-950/40 to-zinc-950 p-6 sm:p-10">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                Pilot on your machine or LXC
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                FloorScribe is self-host first. Create a studio account on your
                instance, or use the local demo seed. Data lives in one PGlite
                volume — back it up before big days. Deploy later with Docker on
                Proxmox LXC when you’re ready.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register">
                  <Button size="lg" className="min-h-11 gap-2">
                    Create studio account
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="secondary" className="min-h-11">
                    Sign in to demo
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-xs text-zinc-600">
                Demo seed (local):{" "}
                <span className="text-zinc-500">pt@demo.local</span> /{" "}
                <span className="text-zinc-500">trainer123</span>
                {" · "}
                Not medical advice — coaching support for qualified trainers.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800/80">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <BrandMark href="/marketing" />
            <p className="mt-1 text-xs text-zinc-600">
              Floor OS for personal trainers.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <Link href="/login" className="hover:text-zinc-300">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-zinc-300">
              Register
            </Link>
            <a
              href="https://github.com/CyberoniOntoni/floorscribe"
              className="hover:text-zinc-300"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </div>
        </div>
        <p className="border-t border-zinc-900 px-4 py-4 text-center text-[11px] text-zinc-700">
          FloorScribe provides tools for personal trainers. It does not diagnose
          medical conditions. Refer red-flag symptoms to appropriate clinicians.
        </p>
      </footer>
    </>
  );
}
