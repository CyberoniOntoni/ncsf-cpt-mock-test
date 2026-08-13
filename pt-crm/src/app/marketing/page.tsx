import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  KeyRound,
  MapPin,
  Package,
  Timer,
  User,
} from "lucide-react";
import { MarketingHeader } from "@/components/marketing-header";
import { MarketingScrollProgress } from "@/components/marketing-scroll-progress";
import { PublicSiteFooter } from "@/components/public-site-footer";
import { Reveal, RevealStagger } from "@/components/reveal";
import {
  AUDIENCE_DOORS,
  DAY_STEPS,
  FEATURE_PILLARS,
  SITE_COPY,
  START_STEPS,
} from "@/lib/site/copy";
import { cn } from "@/lib/utils";

const PILLAR_ICONS = {
  "Session log": Timer,
  "Session packs": Package,
  Bookings: CalendarDays,
  Programs: ClipboardList,
  "Client portal": KeyRound,
  "Find a trainer": MapPin,
} as const;

const sectionShell = "mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:py-20";
const sectionBorder =
  "scroll-mt-32 border-b border-stone-800/45 md:scroll-mt-24";

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";

const btnBase =
  "inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";
const btnPrimaryLg = cn(
  btnBase,
  "min-h-11 gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm text-stone-50 shadow-[0_10px_24px_-12px_rgb(6_78_59/0.9)] hover:bg-emerald-700 active:bg-emerald-800 motion-safe:hover:-translate-y-px"
);
const btnSecondaryLg = cn(
  btnBase,
  "min-h-11 gap-2 rounded-xl border border-stone-600/50 bg-stone-900/50 px-5 py-2.5 text-sm text-stone-100 backdrop-blur-md hover:border-stone-500 hover:bg-stone-800/80 active:bg-stone-900"
);

const imgCalm =
  "object-cover [filter:saturate(0.9)_contrast(1.06)_brightness(1.02)]";

const pathCard =
  "mkt-card group flex h-full min-h-[11.5rem] flex-col p-4 sm:p-5";

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
      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1917]/90 shadow-[0_24px_50px_-20px_rgb(0_0_0/0.7)] backdrop-blur-xl"
      aria-hidden
    >
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-stone-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-stone-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mkt-pulse-dot" />
        <span className="ml-1.5 text-[10px] font-medium text-stone-400">
          Today · Floor
        </span>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-wide text-emerald-500">
              Floor · Fri
            </p>
            <p className="truncate text-sm font-semibold text-stone-50">
              Marcus Chen
            </p>
            <p className="mt-0.5 text-[10px] tabular-nums text-stone-500">
              10-pack · 4 left
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-emerald-800 px-2.5 py-1.5 text-[11px] font-semibold text-stone-50 shadow-[0_8px_18px_-10px_rgb(6_95_70)]">
            Start session
          </span>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-stone-950/40 px-2.5 py-1.5">
          <p className="text-[10px] font-medium tracking-wide text-stone-500">
            Agenda · 48h
          </p>
          <p className="mt-0.5 text-xs text-stone-300">Training · Fri 9:00</p>
        </div>
        <div className="rounded-lg border border-amber-800/35 bg-amber-950/30 px-2.5 py-1.5">
          <p className="text-[10px] font-medium tracking-wide text-amber-500">
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
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-emerald-950/30 text-emerald-500 transition duration-300 motion-reduce:transition-none group-hover:border-emerald-700/50 group-hover:bg-emerald-950/55">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="mt-3 text-sm font-semibold text-stone-50">{title}</span>
      <span className="mt-1 flex-1 text-xs leading-relaxed text-stone-500">
        {body}
      </span>
      <span className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-emerald-600">
        {cta}
        <ArrowRight
          className="h-3.5 w-3.5 transition duration-300 motion-reduce:transition-none group-hover:translate-x-1"
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
                "mkt-ken object-[72%_center] opacity-50 sm:object-[58%_center] sm:opacity-60"
              )}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#12100e]/90 via-[#12100e]/72 to-[#12100e] sm:bg-gradient-to-r sm:from-[#12100e] sm:via-[#12100e]/88 sm:to-[#12100e]/48" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12100e] via-transparent to-[#12100e]/15" />
            <div className="mkt-glow absolute -left-20 top-24 h-64 w-64 rounded-full bg-emerald-800/20 blur-3xl" />
          </div>

          <div className="relative mx-auto grid w-full max-w-5xl flex-1 items-center gap-9 px-4 pb-10 pt-9 sm:gap-11 sm:px-6 sm:pb-14 sm:pt-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:pb-16 lg:pt-14">
            <div className="max-w-xl">
              <div className="mkt-hero-in mkt-hero-in-delay-1 mkt-glass inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1">
                <span
                  className="mkt-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
                <span className="truncate text-[11px] font-medium text-stone-300">
                  {SITE_COPY.heroEyebrow}
                </span>
              </div>
              <h1
                id="hero-heading"
                className="mkt-hero-in mkt-hero-in-delay-2 mt-5 text-[2.55rem] font-semibold leading-[1.04] tracking-[-0.03em] text-stone-50 sm:text-[3.35rem] sm:leading-[0.98]"
              >
                Run the day.
                <span className="mt-1 block bg-gradient-to-r from-emerald-400 to-emerald-700 bg-clip-text text-transparent">
                  Not the paperwork.
                </span>
              </h1>
              <p className="mkt-hero-in mkt-hero-in-delay-3 mt-5 max-w-md text-[0.95rem] leading-relaxed text-stone-400 sm:text-lg sm:leading-relaxed">
                {SITE_COPY.heroBody}
              </p>

              <div
                id="paths"
                className="mkt-hero-in mkt-hero-in-delay-4 mt-8 scroll-mt-32 grid gap-3 sm:grid-cols-2 md:scroll-mt-24"
              >
                <PathCard
                  href={SITE_COPY.soloCta.href}
                  icon={User}
                  title="I train on my own"
                  body="Your clients, packs, and floor log - set up for a single practice."
                  cta={SITE_COPY.soloCta.label}
                />
                <PathCard
                  href={SITE_COPY.studioCta.href}
                  icon={Building2}
                  title="I run a studio"
                  body="One board for the team. Invite trainers when you're ready."
                  cta={SITE_COPY.studioCta.label}
                />
              </div>

              <p className="mkt-hero-in mkt-hero-in-delay-4 mt-4 text-xs text-stone-500">
                Already have an account?{" "}
                <Link
                  href={SITE_COPY.signInCta.href}
                  className={cn(
                    "font-medium text-stone-300 underline-offset-4 hover:text-emerald-500 hover:underline",
                    linkFocus
                  )}
                >
                  Sign in
                </Link>
                {" · "}
                <Link
                  href={SITE_COPY.findCta.href}
                  className={cn(
                    "font-medium text-stone-300 underline-offset-4 hover:text-emerald-500 hover:underline",
                    linkFocus
                  )}
                >
                  Find a trainer
                </Link>
                {" · "}
                <Link
                  href={SITE_COPY.portalCta.href}
                  className={cn(
                    "font-medium text-stone-300 underline-offset-4 hover:text-emerald-500 hover:underline",
                    linkFocus
                  )}
                >
                  Client portal
                </Link>
              </p>
            </div>

            <div className="mkt-hero-in mkt-hero-in-delay-3 relative mx-auto w-full max-w-sm sm:max-w-md lg:mx-0 lg:max-w-none">
              <div
                className="mkt-glow absolute -inset-4 rounded-[2rem] bg-emerald-800/20 blur-3xl sm:-inset-6"
                aria-hidden
              />
              <div className="relative">
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-stone-900 shadow-[0_30px_60px_-24px_rgb(0_0_0/0.75)] ring-1 ring-white/[0.04]">
                  <div className="relative aspect-[16/11] sm:aspect-[4/3]">
                    <Image
                      src="/marketing/paths-calm.jpg"
                      alt="Boutique gym with dumbbell rack and training zones"
                      fill
                      priority
                      sizes="(max-width: 640px) 100vw, 30rem"
                      className={cn(imgCalm, "mkt-ken object-[center_42%]")}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#12100e]/55 via-transparent to-[#12100e]/10" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />
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
                floor and the admin side stay connected. Programs and invoices
                live on the same client, not in another tab.
              </p>
            </Reveal>

            <Reveal variant="scale" delay={40} className="mt-10 sm:mt-12">
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] shadow-[0_24px_48px_-24px_rgb(0_0_0/0.7)]">
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
                  <div className="absolute inset-0 bg-[#12100e]/88" />
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
              {DAY_STEPS.map((step, i) => (
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

        {/* What's included */}
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
              className="mt-9 grid grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3"
              step={55}
              base={25}
            >
              {FEATURE_PILLARS.map((pillar) => {
                const Icon = PILLAR_ICONS[pillar.title];
                return (
                  <div
                    key={pillar.title}
                    className="mkt-card flex flex-col p-4 sm:p-5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-emerald-950/35 text-emerald-500">
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-stone-100">
                      {pillar.title}
                    </h3>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-stone-500">
                      {pillar.body}
                    </p>
                  </div>
                );
              })}
            </RevealStagger>
          </div>
        </section>

        {/* Who it's for */}
        <section
          id="doors"
          className={sectionBorder}
          aria-labelledby="doors-heading"
        >
          <div className={sectionShell}>
            <Reveal variant="up">
              <SectionLabel>Who it&apos;s for</SectionLabel>
              <h2
                id="doors-heading"
                className="mt-3 max-w-xl text-[1.75rem] font-semibold tracking-tight text-stone-50 sm:text-3xl"
              >
                Three ways in. One FloorScribe.
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-stone-500">
                Trainers run the floor. Assigned clients open a portal. People
                looking for a PT can request an intro.
              </p>
            </Reveal>

            <RevealStagger
              className="mt-9 grid grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-3"
              step={55}
              base={25}
            >
              {AUDIENCE_DOORS.map((door) => {
                const isTrainer = door.audience === "trainer";
                return (
                  <Link
                    key={door.href}
                    href={door.href}
                    className={cn(
                      "group flex h-full min-h-[11.5rem] flex-col rounded-2xl p-5 transition duration-300 motion-reduce:transition-none",
                      linkFocus,
                      isTrainer
                        ? "bg-gradient-to-br from-emerald-700 to-emerald-900 text-stone-50 shadow-[0_18px_36px_-20px_rgb(6_78_59)] hover:from-emerald-600 hover:to-emerald-800"
                        : "mkt-card"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isTrainer ? "text-stone-50" : "text-stone-100"
                      )}
                    >
                      {door.title}
                    </span>
                    <span
                      className={cn(
                        "mt-1.5 flex-1 text-sm leading-relaxed",
                        isTrainer ? "text-emerald-50/85" : "text-stone-500"
                      )}
                    >
                      {door.body}
                    </span>
                    <span
                      className={cn(
                        "mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold",
                        isTrainer ? "text-stone-50" : "text-emerald-600"
                      )}
                    >
                      {door.cta}
                      <ArrowRight
                        className="h-4 w-4 transition duration-300 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                );
              })}
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
              <div className="relative overflow-hidden rounded-2xl border border-emerald-800/25 bg-gradient-to-br from-emerald-950/45 via-[#1a1816] to-[#12100e] p-6 shadow-[0_28px_50px_-28px_rgb(0_0_0/0.75)] sm:p-10">
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
                        href={SITE_COPY.soloCta.href}
                        className={cn(
                          btnPrimaryLg,
                          "w-full sm:w-auto",
                          linkFocus
                        )}
                      >
                        {SITE_COPY.soloCta.label}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                      <Link
                        href={SITE_COPY.studioCta.href}
                        className={cn(
                          btnSecondaryLg,
                          "w-full sm:w-auto",
                          linkFocus
                        )}
                      >
                        {SITE_COPY.studioCta.label}
                      </Link>
                      <Link
                        href={SITE_COPY.signInCta.href}
                        className={cn(
                          "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-stone-400 transition hover:text-stone-200",
                          linkFocus
                        )}
                      >
                        {SITE_COPY.signInCta.label}
                      </Link>
                    </div>
                  </div>
                  <ul className="mkt-glass w-full overflow-hidden rounded-xl lg:w-auto lg:min-w-[16.5rem]">
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

      <PublicSiteFooter />
    </div>
  );
}
