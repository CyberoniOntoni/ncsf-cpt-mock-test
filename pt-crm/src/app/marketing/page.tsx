import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Package,
  Timer,
  User,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { MarketingHeader } from "@/components/marketing-header";
import { MarketingScrollProgress } from "@/components/marketing-scroll-progress";
import { Reveal, RevealStagger } from "@/components/reveal";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#included", label: "What's included" },
  { href: "#start", label: "Get started" },
] as const;

const DAY = [
  {
    t: "See the day",
    d: "Open Today and you'll know who you're training, what's booked, and anything that still needs attention.",
  },
  {
    t: "Train on the floor",
    d: "Log sets, RPE, and cues as you go. When you finish the session, the pack count updates with it.",
  },
  {
    t: "Wrap the loose ends",
    d: "Rebook, send a check-in, or mark an invoice paid - still on that client, not in another app.",
  },
] as const;

const PROOF = [
  {
    icon: Timer,
    title: "Session log",
    body: "Built for glances between sets: weight, reps, RPE, and cues without digging through a spreadsheet.",
  },
  {
    icon: Package,
    title: "Session packs",
    body: "See how many sessions are left on a pack, and renew when it runs out.",
  },
  {
    icon: CalendarDays,
    title: "Bookings",
    body: "Schedule from the client profile, see the month on the calendar, and start a session from the booking.",
  },
  {
    icon: Users,
    title: "Solo or studio",
    body: "Start on your own. When you hire, invite trainers onto the same board.",
  },
] as const;

const START_STEPS = [
  "Create a solo or studio account",
  "Add a client and open Today",
  "Log a session - packs stay in sync",
  "Invite trainers when you need them",
] as const;

const sectionShell = "mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:py-20";
const sectionBorder =
  "scroll-mt-32 border-b border-stone-800/45 md:scroll-mt-24";

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";

const btnBase =
  "inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";
const btnPrimaryLg = cn(
  btnBase,
  "min-h-11 gap-2 rounded-lg bg-emerald-800 px-5 py-2.5 text-sm text-stone-50 shadow-sm shadow-black/30 hover:bg-emerald-700 active:bg-emerald-800"
);
const btnSecondaryLg = cn(
  btnBase,
  "min-h-11 gap-2 rounded-lg border border-stone-700/90 bg-stone-900/70 px-5 py-2.5 text-sm text-stone-100 hover:border-stone-600 hover:bg-stone-800/90 active:bg-stone-900"
);

const imgCalm =
  "object-cover [filter:saturate(0.86)_contrast(1.03)_brightness(0.97)]";

const pathCard =
  "group flex h-full min-h-[11.5rem] flex-col rounded-2xl border border-stone-700/70 bg-[#1a1816]/90 p-4 shadow-sm shadow-black/20 transition duration-300 hover:border-emerald-800/45 hover:bg-stone-900/55 hover:shadow-md hover:shadow-black/25 sm:p-5";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium tracking-[0.1em] text-emerald-600/90">
      {children}
    </p>
  );
}

function FloorMock() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-stone-700/65 bg-[#1a1816]/96 shadow-2xl shadow-black/45 backdrop-blur-md"
      aria-hidden
    >
      <div className="flex items-center gap-1.5 border-b border-stone-800/90 px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-stone-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-stone-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-stone-600" />
        <span className="ml-1.5 text-[10px] font-medium text-stone-500">
          Today · Floor
        </span>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-wide text-emerald-600/90">
              Floor · Fri
            </p>
            <p className="truncate text-sm font-semibold text-stone-100">
              Marcus Chen
            </p>
            <p className="mt-0.5 text-[10px] tabular-nums text-stone-500">
              10-pack · 4 left
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-emerald-800 px-2.5 py-1.5 text-[11px] font-semibold text-stone-50 shadow-sm shadow-black/25">
            Start session
          </span>
        </div>
        <div className="rounded-lg border border-stone-800/90 bg-stone-900/55 px-2.5 py-1.5">
          <p className="text-[10px] font-medium tracking-wide text-stone-500">
            Agenda · 48h
          </p>
          <p className="mt-0.5 text-xs text-stone-300">Training · Fri 9:00</p>
        </div>
        <div className="rounded-lg border border-amber-900/30 bg-amber-950/20 px-2.5 py-1.5">
          <p className="text-[10px] font-medium tracking-wide text-amber-600/85">
            Needs you · 1
          </p>
          <p className="mt-0.5 text-xs text-stone-300">10-pack unpaid</p>
        </div>
      </div>
    </div>
  );
}

function PathCard({
  href,
  icon: Icon,
  title,
  body,
  cta,
}: {
  href: string;
  icon: typeof User;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link href={href} className={cn(pathCard, linkFocus)}>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-700/90 bg-stone-900/80 text-emerald-600 transition duration-300 group-hover:border-emerald-800/40 group-hover:bg-emerald-950/30">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="mt-3 text-sm font-semibold text-stone-50">{title}</span>
      <span className="mt-1 flex-1 text-xs leading-relaxed text-stone-500">
        {body}
      </span>
      <span className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-emerald-600">
        {cta}
        <ArrowRight
          className="h-3.5 w-3.5 transition duration-300 group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

export default function MarketingPage() {
  return (
    <div className="overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-emerald-800 focus:px-3 focus:py-2 focus:text-sm focus:text-stone-50"
      >
        Skip to content
      </a>

      <MarketingScrollProgress />
      <MarketingHeader />

      <main id="main">
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="relative flex min-h-[min(88dvh,50rem)] flex-col overflow-hidden border-b border-stone-800/45"
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <Image
              src="/marketing/hero-calm.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className={cn(
                imgCalm,
                "object-[72%_center] opacity-40 sm:object-[58%_center] sm:opacity-50"
              )}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#141210]/94 via-[#141210]/80 to-[#141210] sm:bg-gradient-to-r sm:from-[#141210] sm:via-[#141210]/93 sm:to-[#141210]/55" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141210] via-transparent to-[#141210]/20" />
          </div>

          <div className="relative mx-auto grid w-full max-w-5xl flex-1 items-center gap-9 px-4 pb-10 pt-9 sm:gap-11 sm:px-6 sm:pb-14 sm:pt-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:pb-16 lg:pt-14">
            <div className="max-w-xl">
              <div className="mkt-hero-in mkt-hero-in-delay-1 inline-flex max-w-full items-center gap-2 rounded-full border border-stone-700/55 bg-[#1a1816]/75 px-3 py-1">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600"
                  aria-hidden
                />
                <span className="truncate text-[11px] font-medium text-stone-400">
                  For personal trainers - solo or with a small team
                </span>
              </div>
              <h1
                id="hero-heading"
                className="mkt-hero-in mkt-hero-in-delay-2 mt-5 text-[2.35rem] font-semibold leading-[1.08] tracking-tight text-stone-50 sm:text-5xl sm:leading-[1.04]"
              >
                Run the day.
                <span className="mt-1 block text-emerald-600">
                  Not the paperwork.
                </span>
              </h1>
              <p className="mkt-hero-in mkt-hero-in-delay-3 mt-5 max-w-md text-[0.95rem] leading-relaxed text-stone-400 sm:text-lg sm:leading-relaxed">
                FloorScribe keeps session logs, packs, bookings, and simple
                invoices together so you can stay with the client instead of
                juggling tabs.
              </p>

              <div
                id="paths"
                className="mkt-hero-in mkt-hero-in-delay-4 mt-8 scroll-mt-32 grid gap-3 sm:grid-cols-2 md:scroll-mt-24"
              >
                <PathCard
                  href="/register/solo"
                  icon={User}
                  title="I train on my own"
                  body="Your clients, packs, and floor log - set up for a single practice."
                  cta="Create account"
                />
                <PathCard
                  href="/register/studio"
                  icon={Building2}
                  title="I run a studio"
                  body="One board for the team. Invite trainers when you're ready."
                  cta="Create studio"
                />
              </div>

              <p className="mkt-hero-in mkt-hero-in-delay-4 mt-4 text-xs text-stone-500">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className={cn(
                    "font-medium text-stone-300 underline-offset-4 hover:text-emerald-500 hover:underline",
                    linkFocus
                  )}
                >
                  Sign in
                </Link>
              </p>
            </div>

            <div className="mkt-hero-in mkt-hero-in-delay-3 relative mx-auto w-full max-w-sm sm:max-w-md lg:mx-0 lg:max-w-none">
              <div
                className="absolute -inset-3 rounded-[2rem] bg-emerald-900/[0.08] blur-3xl sm:-inset-5"
                aria-hidden
              />
              <div className="relative">
                <div className="overflow-hidden rounded-2xl border border-stone-700/35 bg-stone-900 shadow-2xl shadow-black/45 ring-1 ring-stone-600/10">
                  <div className="relative aspect-[16/11] sm:aspect-[4/3]">
                    <Image
                      src="/marketing/paths-calm.jpg"
                      alt="Boutique gym with dumbbell rack and training zones"
                      fill
                      priority
                      sizes="(max-width: 640px) 100vw, 30rem"
                      className={cn(imgCalm, "object-[center_42%]")}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141210]/65 via-transparent to-[#141210]/12" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.04]" />
                  </div>
                </div>
                <div className="relative z-10 mx-2 -mt-11 sm:mx-5 sm:-mt-14">
                  <FloorMock />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section
          id="how"
          className={sectionBorder}
          aria-labelledby="problem-heading"
        >
          <div className={sectionShell}>
            <Reveal variant="up">
              <SectionLabel>How it works</SectionLabel>
              <h2
                id="problem-heading"
                className="mt-3 max-w-2xl text-[1.75rem] font-semibold leading-tight tracking-tight text-stone-50 sm:text-4xl"
              >
                Most trainers already have tools.{" "}
                <span className="text-emerald-600">
                  They just don&apos;t talk to each other.
                </span>
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-500 sm:text-base">
                Notes live in chat. Packs live in a spreadsheet. Invoices live
                somewhere else. FloorScribe puts the day in one place so the
                floor and the admin side stay connected.
              </p>
            </Reveal>

            <Reveal variant="scale" delay={40} className="mt-10 sm:mt-12">
              <div className="relative overflow-hidden rounded-2xl border border-stone-800/90 shadow-xl shadow-black/20">
                <div
                  className="pointer-events-none absolute inset-0"
                  aria-hidden
                >
                  <Image
                    src="/marketing/desk-calm.jpg"
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 64rem"
                    className={cn(imgCalm, "object-[center_32%] opacity-35")}
                  />
                  <div className="absolute inset-0 bg-[#141210]/90" />
                </div>
                <div className="relative grid sm:grid-cols-2">
                  <div className="border-b border-stone-800/80 p-5 sm:border-b-0 sm:border-r sm:p-7">
                    <p className="text-[11px] font-medium tracking-wide text-stone-500">
                      The scatter
                    </p>
                    <p className="mt-3 text-lg font-medium leading-snug text-stone-100 sm:text-xl">
                      Notes in chat. Packs in a sheet. Money in your head.
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-stone-500">
                      A spreadsheet won&apos;t use a pack credit when the
                      session ends. A generic CRM wants a sales pipeline, not a
                      set log between clients.
                    </p>
                  </div>
                  <div className="bg-emerald-950/20 p-5 sm:p-7">
                    <p className="text-[11px] font-medium tracking-wide text-emerald-600/90">
                      One board
                    </p>
                    <p className="mt-3 text-lg font-medium leading-snug text-stone-50 sm:text-xl">
                      See today, pick the client, start the session.
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-stone-400">
                      Between sessions you can update packs, book next, or
                      mark paid. On the floor you log, finish, and rebook -
                      same client, same day.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Day */}
        <section
          id="day"
          className={sectionBorder}
          aria-labelledby="day-heading"
        >
          <div className={sectionShell}>
            <Reveal variant="up">
              <SectionLabel>A normal day</SectionLabel>
              <h2
                id="day-heading"
                className="mt-3 text-[1.75rem] font-semibold tracking-tight text-stone-50 sm:text-3xl"
              >
                From open to done without leaving the flow.
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-stone-500">
                You still train the way you train. FloorScribe just keeps the
                day and the business side in one place.
              </p>
            </Reveal>

            <RevealStagger
              className="mt-9 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 sm:mt-10"
              step={70}
              base={30}
            >
              {DAY.map((step, i) => (
                <div key={step.t} className="mkt-card flex flex-col p-5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-900/35 bg-emerald-950/35 text-xs font-semibold tabular-nums text-emerald-500">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-stone-100">
                    {step.t}
                  </h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-stone-500">
                    {step.d}
                  </p>
                </div>
              ))}
            </RevealStagger>

            <Reveal variant="up" delay={50} className="mt-10 sm:mt-12">
              <div className="relative overflow-hidden rounded-2xl border border-stone-800/90 shadow-lg shadow-black/15">
                <div className="relative aspect-[21/9] min-h-[9.5rem] sm:min-h-[11.5rem]">
                  <Image
                    src="/marketing/studio-calm.jpg"
                    alt="Personal training floor with rack, kettlebells, and bands"
                    fill
                    sizes="(max-width: 1024px) 100vw, 64rem"
                    className={cn(imgCalm, "object-center opacity-65")}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#141210]/85 via-[#141210]/40 to-[#141210]/75" />
                  <div className="absolute inset-0 flex items-end p-5 sm:p-7">
                    <p className="max-w-md text-sm font-medium leading-relaxed text-stone-200 sm:text-base">
                      Made for the minutes between sets - not for catching up
                      on admin between clients.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Proof */}
        <section
          id="included"
          className={sectionBorder}
          aria-labelledby="proof-heading"
        >
          <div className={sectionShell}>
            <Reveal variant="up">
              <SectionLabel>What&apos;s included</SectionLabel>
              <h2
                id="proof-heading"
                className="mt-3 max-w-xl text-[1.75rem] font-semibold tracking-tight text-stone-50 sm:text-3xl"
              >
                The pieces you actually use every week.
              </h2>
              <p className="mt-2 max-w-md text-sm text-stone-500">
                Enough to run sessions and the business around them - without
                turning into a full office suite.
              </p>
            </Reveal>

            <RevealStagger
              className="mt-9 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:mt-10 lg:grid-cols-4"
              step={55}
              base={25}
            >
              {PROOF.map(({ icon: Icon, title, body }) => (
                <div key={title} className="mkt-card flex flex-col p-4 sm:p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-800 bg-[#141210]/60 text-emerald-600">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-stone-100">
                    {title}
                  </h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-stone-500">
                    {body}
                  </p>
                </div>
              ))}
            </RevealStagger>
          </div>
        </section>

        {/* Start */}
        <section
          id="start"
          className="scroll-mt-32 md:scroll-mt-24"
          aria-labelledby="start-heading"
        >
          <div className={sectionShell}>
            <Reveal variant="scale" duration={700}>
              <div className="relative overflow-hidden rounded-2xl border border-emerald-900/30 bg-gradient-to-br from-emerald-950/35 via-[#1a1816] to-[#141210] p-6 shadow-xl shadow-black/25 sm:p-10">
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-900/15 blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-stone-800/20 blur-3xl"
                  aria-hidden
                />
                <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-lg">
                    <SectionLabel>Get started</SectionLabel>
                    <h2
                      id="start-heading"
                      className="mt-3 text-[1.75rem] font-semibold tracking-tight text-stone-50 sm:text-3xl"
                    >
                      Ready when you are.
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-stone-400 sm:text-base">
                      Create an account, add a client, and start from Today.
                      You can invite trainers later if the practice grows.
                    </p>
                    <div className="mt-7 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3">
                      <Link
                        href="/register/solo"
                        className={cn(
                          btnPrimaryLg,
                          "w-full sm:w-auto",
                          linkFocus
                        )}
                      >
                        Start solo
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                      <Link
                        href="/register/studio"
                        className={cn(
                          btnSecondaryLg,
                          "w-full sm:w-auto",
                          linkFocus
                        )}
                      >
                        Start a studio
                      </Link>
                      <Link
                        href="/login"
                        className={cn(
                          "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-stone-400 transition hover:text-stone-200",
                          linkFocus
                        )}
                      >
                        Sign in
                      </Link>
                    </div>
                  </div>
                  <ul className="w-full overflow-hidden rounded-xl border border-stone-800/80 bg-[#141210]/55 lg:w-auto lg:min-w-[16.5rem]">
                    {START_STEPS.map((line, i) => (
                      <li
                        key={line}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3.5 text-sm text-stone-400",
                          i > 0 && "border-t border-stone-800/80"
                        )}
                      >
                        <Check
                          className="h-4 w-4 shrink-0 text-emerald-600"
                          aria-hidden
                        />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-800/70">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
            <div className="max-w-xs">
              <BrandMark href="/marketing" className="text-emerald-600" />
              <p className="mt-2.5 text-xs leading-relaxed text-stone-500">
                Session logs, packs, bookings, and the client follow-through
                that keeps a practice moving.
              </p>
              <a
                href="https://floorscribe.com"
                className={cn(
                  "mt-3 inline-flex min-h-9 items-center text-xs font-medium text-stone-500 transition hover:text-emerald-600",
                  linkFocus
                )}
              >
                floorscribe.com
              </a>
            </div>
            <nav
              className="flex flex-wrap gap-x-0.5 gap-y-0 text-xs text-stone-500 sm:max-w-md sm:justify-end"
              aria-label="Footer"
            >
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-10 items-center px-2.5 hover:text-stone-300",
                    linkFocus
                  )}
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/login"
                className={cn(
                  "inline-flex min-h-10 items-center px-2.5 hover:text-stone-300",
                  linkFocus
                )}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className={cn(
                  "inline-flex min-h-10 items-center px-2.5 font-medium text-emerald-600 hover:text-emerald-500",
                  linkFocus
                )}
              >
                Create account
              </Link>
            </nav>
          </div>
          <div className="mt-8 border-t border-stone-900/90 pt-5">
            <p className="text-center text-[11px] leading-relaxed text-stone-600 sm:text-left">
              FloorScribe provides coaching support tools for qualified personal
              trainers. It does not diagnose medical conditions. Refer red-flag
              symptoms to appropriate clinicians.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
