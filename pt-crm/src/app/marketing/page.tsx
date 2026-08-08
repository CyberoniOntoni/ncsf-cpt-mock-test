import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  Dumbbell,
  Library,
  LineChart,
  Package,
  Receipt,
  Sparkles,
  Timer,
  Users,
  UserPlus,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { MarketingHeader } from "@/components/marketing-header";
import { MarketingScrollProgress } from "@/components/marketing-scroll-progress";
import { Reveal, RevealStagger } from "@/components/reveal";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#detail", label: "Inside" },
  { href: "#day", label: "Day" },
  { href: "#start", label: "Start" },
] as const;

const FEATURES = [
  {
    icon: Timer,
    title: "Floor command board",
    body: "Sticky client, open sessions, 48h agenda, Needs you — one primary action: Start or Resume.",
  },
  {
    icon: Dumbbell,
    title: "Session log → pack burn",
    body: "Sets, RPE, cues, shortcuts. Complete once and an active pack loses a credit.",
  },
  {
    icon: ClipboardList,
    title: "Programs that stick",
    body: "Multi-day plans from the bank. Sessions seed from the plan; floor adds promote back.",
  },
  {
    icon: Users,
    title: "Client CRM spine",
    body: "Stages, packs, bookings, tasks, check-ins, invoices — one profile, one timeline.",
  },
  {
    icon: CalendarDays,
    title: "Bookings ↔ floor",
    body: "Month calendar, book from the client, start from a booking. Past-due stays visible.",
  },
  {
    icon: Package,
    title: "Session packs",
    body: "Custom totals with remaining on the floor. Empty packs prompt renew after complete.",
  },
  {
    icon: Receipt,
    title: "Manual invoices",
    body: "Amount + title, mark paid when settled. Unpaid hits Needs you.",
  },
  {
    icon: Sparkles,
    title: "Coach assist",
    body: "Playbook-backed coaching. Optional LLM when you set a key.",
  },
  {
    icon: UserPlus,
    title: "Solo or studio team",
    body: "Individual practice or studio owner. Invite trainers from Settings.",
  },
] as const;

const DETAIL = [
  {
    id: "floor",
    icon: Timer,
    eyebrow: "01 · On the floor",
    title: "Log like you’re actually training",
    lead: "Between-set glances — not a spreadsheet on a laptop.",
    image: null as string | null,
    imageAlt: "",
    points: [
      "Current exercise expanded; others collapse until you peek",
      "Fill last / Prep open sets with undo; Apply tips",
      "Shortcuts: Space · N/P · +/− · S · R · ?",
      "Mid-session bank add; promote to plan when it sticks",
      "Complete → share → book next → check-in → renew",
    ],
  },
  {
    id: "clients",
    icon: Users,
    eyebrow: "02 · Clients & money",
    title: "Commercial spine next to the log",
    lead: "What keeps a paid relationship moving lives on the client.",
    image: "/marketing/timeline.jpg",
    imageAlt: "Abstract timeline of bookings, packs, and invoices",
    points: [
      "Stages: lead → active → paused",
      "Packages with remaining; one-tap renew",
      "Book, complete, no-show — linked to sessions",
      "Tasks, check-ins, manual invoices",
      "Timeline merges the whole relationship",
    ],
  },
  {
    id: "programs",
    icon: ClipboardList,
    eyebrow: "03 · Plans & progress",
    title: "Program once, train many times",
    lead: "Desk work stays desk. Floor work stays floor — same client.",
    image: "/marketing/programs.jpg",
    imageAlt: "Abstract glass steps for progressive programs",
    points: [
      "Wizard and day editor with bank picker",
      "Start from a program day; cues seed the log",
      "Measurements and progress over time",
      "Movement assessments when needed",
      "Coach history after the session",
    ],
  },
  {
    id: "studio",
    icon: Building2,
    eyebrow: "04 · Practice & team",
    title: "Solo to studio without re-platforming",
    lead: "Same product whether you train alone or bring on other PTs.",
    image: "/marketing/studio-team.jpg",
    imageAlt: "Abstract team around a shared hub",
    points: [
      "Solo practice or multi-trainer studio",
      "Invite by email + role",
      "14-day link — register or accept signed in",
      "Profile, credentials, units, timezone",
      "Shared library and equipment",
    ],
  },
] as const;

const ALSO = [
  { icon: Library, title: "Exercise library", body: "Programs & mid-session adds." },
  { icon: BookOpen, title: "Knowledge", body: "Playbooks for real floor situations." },
  { icon: LineChart, title: "Needs you", body: "Tasks, unpaid, low packs — deep-linked." },
  { icon: CalendarDays, title: "Calendar", body: "Month view + 48h Home agenda." },
] as const;

const DAY = [
  { t: "Open Today", d: "Sticky client, agenda, Needs you." },
  { t: "Start session", d: "From program or booking. Log on the floor." },
  { t: "Complete", d: "Pack burns, share, book next, check-in." },
  { t: "Between", d: "Tasks, invoices, stage — keep the week moving." },
] as const;

const FOR = [
  "Solo PTs and micro-studios",
  "Trainers who live on the floor",
  "Studios that want packs + money in one place",
] as const;

const NOT_FOR = [
  "Multi-site franchise ERP",
  "Client self-service apps",
  "Card checkout & tax engines",
] as const;

/** Shared section shell: consistent max-width + padding rhythm. */
const sectionShell = "mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:py-20";
const sectionBorder =
  "scroll-mt-28 border-b border-zinc-800/60 md:scroll-mt-20";

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";

/** Match Button from ui.tsx — Links styled as buttons (no nested <button>). */
const btnBase =
  "inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";
const btnPrimaryLg = cn(
  btnBase,
  "min-h-11 gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm text-white shadow-sm shadow-emerald-950/40 hover:bg-emerald-500 active:bg-emerald-600"
);
const btnSecondaryLg = cn(
  btnBase,
  "min-h-11 gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm text-zinc-100 hover:bg-zinc-700 active:bg-zinc-800"
);

const imgBrand =
  "object-cover [filter:saturate(0.92)_contrast(1.06)_brightness(0.98)]";

const cardPanel =
  "h-full rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5 sm:p-6";

function SectionLabel({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.14em]",
        muted ? "text-zinc-600" : "text-emerald-500/90"
      )}
    >
      {children}
    </p>
  );
}

function FloorMock() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur-md"
      aria-hidden
    >
      <div className="flex items-center gap-1.5 border-b border-zinc-800/90 px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        <span className="ml-1.5 text-[10px] font-medium text-zinc-500">
          Today · Floor
        </span>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/80">
              Floor · Fri
            </p>
            <p className="truncate text-sm font-semibold text-zinc-100">
              Marcus Chen
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-emerald-950/40">
            Start session
          </span>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Agenda · 48h
          </p>
          <p className="mt-0.5 text-xs text-zinc-300">Training · Fri 9:00 PM</p>
        </div>
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/30 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/90">
            Needs you · 1
          </p>
          <p className="mt-0.5 text-xs text-zinc-300">10-pack unpaid</p>
        </div>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <div className="overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-emerald-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <MarketingScrollProgress />
      <MarketingHeader />

      <main id="main">
        {/* ─── Hero ─── */}
        <section className="relative flex min-h-[min(88dvh,50rem)] flex-col overflow-hidden border-b border-zinc-800/60">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <Image
              src="/marketing/hero-bg.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className={cn(
                imgBrand,
                "object-[78%_center] opacity-40 sm:object-[60%_center] sm:opacity-50"
              )}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/90 via-zinc-950/80 to-zinc-950 sm:bg-gradient-to-r sm:from-zinc-950 sm:via-zinc-950/94 sm:to-zinc-950/55" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/30" />
          </div>

          <div className="relative mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 pb-8 pt-10 sm:gap-12 sm:px-6 sm:pb-14 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-16 lg:pt-16">
            <div className="max-w-xl">
              <div className="mkt-hero-in mkt-hero-in-delay-1 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-900/50 bg-emerald-950/40 px-3 py-1">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] motion-safe:animate-pulse"
                  aria-hidden
                />
                <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400/95 sm:text-[11px]">
                  Floor OS · personal trainers
                </span>
              </div>
              <h1 className="mkt-hero-in mkt-hero-in-delay-2 mt-5 text-[2.25rem] font-semibold leading-[1.06] tracking-tight text-zinc-50 sm:text-5xl sm:leading-[1.04]">
                Run the floor.
                <span className="mt-1 block text-emerald-400">
                  Not the paperwork.
                </span>
              </h1>
              <p className="mkt-hero-in mkt-hero-in-delay-3 mt-5 text-[0.95rem] leading-relaxed text-zinc-400 sm:text-lg">
                Sessions, programs, packs, bookings, invoices, and coach — on
                one day board.{" "}
                <span className="text-zinc-300">
                  Less tab-switching between clients; more time on the floor.
                </span>
              </p>
              <div className="mkt-hero-in mkt-hero-in-delay-4 mt-8 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3">
                <Link
                  href="/register"
                  className={cn(btnPrimaryLg, "w-full sm:w-auto", linkFocus)}
                >
                  Get started
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href="#story"
                  className={cn(btnSecondaryLg, "w-full sm:w-auto", linkFocus)}
                >
                  See how it works
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>

            <div className="mkt-hero-in mkt-hero-in-delay-3 relative mx-auto w-full max-w-sm sm:max-w-md lg:mx-0 lg:max-w-none">
              <div
                className="absolute -inset-4 rounded-[2rem] bg-emerald-500/[0.08] blur-3xl sm:-inset-6"
                aria-hidden
              />
              <div className="relative">
                <div className="overflow-hidden rounded-2xl border border-zinc-700/40 bg-zinc-900 shadow-2xl shadow-black/60 ring-1 ring-emerald-500/15">
                  <div className="relative aspect-[16/11] sm:aspect-[4/3]">
                    <Image
                      src="/marketing/floor-panel.jpg"
                      alt="Abstract FloorScribe command board visualization"
                      fill
                      priority
                      sizes="(max-width: 640px) 100vw, 30rem"
                      className={cn(imgBrand, "object-[center_42%]")}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/55 via-transparent to-zinc-950/10" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.05]" />
                  </div>
                </div>
                <div className="relative z-10 mx-2 -mt-10 sm:mx-5 sm:-mt-14">
                  <FloorMock />
                </div>
              </div>
            </div>
          </div>

          <div className="relative mx-auto mb-5 flex justify-center sm:mb-7">
            <a
              href="#story"
              className={cn(
                "mkt-hero-in mkt-hero-in-delay-4 group inline-flex flex-col items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600 transition hover:text-emerald-400/90",
                linkFocus
              )}
            >
              How it works
              <ArrowDown className="h-4 w-4 text-emerald-500/70 motion-safe:animate-bounce group-hover:text-emerald-400" />
            </a>
          </div>
        </section>

        {/* ─── Story ─── */}
        <section id="story" className={sectionBorder}>
          <div className={sectionShell}>
            <Reveal variant="up">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/40 bg-emerald-950/25 px-3 py-1 text-[11px] font-medium text-emerald-400/90">
                Built for the floor hour
              </div>
              <SectionLabel>
                <span className="mt-4 block">The product</span>
              </SectionLabel>
              <h2 className="mt-3 max-w-2xl text-[1.75rem] font-semibold leading-tight tracking-tight text-zinc-50 sm:text-4xl">
                Board, floor, commercial spine, and team —{" "}
                <span className="text-emerald-400">one product</span> for the
                day you actually run.
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-4 md:mt-12 md:grid-cols-2 md:gap-5">
              <Reveal variant="left" delay={40}>
                <div className={cardPanel}>
                  <SectionLabel muted>Built for</SectionLabel>
                  <ul className="mt-4 space-y-3">
                    {FOR.map((line) => (
                      <li
                        key={line}
                        className="flex items-start gap-2.5 text-sm leading-snug text-zinc-300"
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
              </Reveal>
              <Reveal variant="right" delay={80}>
                <div className="h-full rounded-2xl border border-zinc-800/70 bg-zinc-950/20 p-5 sm:p-6">
                  <SectionLabel muted>Not for</SectionLabel>
                  <ul className="mt-4 space-y-3">
                    {NOT_FOR.map((line) => (
                      <li
                        key={line}
                        className="flex items-start gap-2.5 text-sm leading-snug text-zinc-500"
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
              </Reveal>
            </div>

            <Reveal variant="scale" delay={60} className="mt-4 sm:mt-5">
              <div className="relative overflow-hidden rounded-2xl border border-zinc-800">
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  <Image
                    src="/marketing/atmosphere.jpg"
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 64rem"
                    className={cn(imgBrand, "object-[80%_25%] opacity-50")}
                  />
                  <div className="absolute inset-0 bg-zinc-950/84" />
                </div>
                <div className="relative grid sm:grid-cols-2">
                  <div className="border-b border-zinc-800/80 p-5 sm:border-b-0 sm:border-r sm:p-7">
                    <SectionLabel muted>The mess</SectionLabel>
                    <p className="mt-3 text-lg font-medium leading-snug text-zinc-100 sm:text-xl">
                      Notes in chat. Packs in a sheet. Money in your head.
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                      Spreadsheets don’t burn a pack when you complete a
                      session. Generic CRMs want pipelines, not floor logs.
                    </p>
                  </div>
                  <div className="bg-emerald-950/30 p-5 sm:p-7">
                    <SectionLabel>The board</SectionLabel>
                    <p className="mt-3 text-lg font-medium leading-snug text-zinc-50 sm:text-xl">
                      Today. Sticky client. Needs you. Start.
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-emerald-100/70">
                      Between sessions: stage, pack, book, invoice. On the
                      floor: log, complete, share, rebook.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── Features ─── */}
        <section id="features" className={sectionBorder}>
          <div className={sectionShell}>
            <Reveal variant="up">
              <SectionLabel>Capabilities</SectionLabel>
              <h2 className="mt-3 max-w-xl text-[1.75rem] font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                What’s in FloorScribe
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
                Floor command through team invites — everything that keeps a
                paid practice moving.
              </p>
            </Reveal>

            <RevealStagger
              className="mt-9 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:mt-10 sm:gap-3.5 lg:grid-cols-3"
              step={60}
              base={30}
            >
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="mkt-card group flex flex-col p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-900/40 bg-emerald-950/40 text-emerald-400 transition duration-300 motion-safe:group-hover:scale-105">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-zinc-100">
                    {title}
                  </h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-500">
                    {body}
                  </p>
                </div>
              ))}
            </RevealStagger>
          </div>
        </section>

        {/* ─── Detail ─── */}
        <section id="detail" className={sectionBorder}>
          <div className={sectionShell}>
            <Reveal variant="up">
              <SectionLabel>Inside the product</SectionLabel>
              <h2 className="mt-3 max-w-xl text-[1.75rem] font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                From the board to the team
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
                Board → session log → CRM spine → team. Same client, same day.
              </p>
            </Reveal>

            <div className="mt-10 space-y-6 sm:mt-12 sm:space-y-8">
              {DETAIL.map(
                (
                  {
                    id,
                    icon: Icon,
                    eyebrow,
                    title,
                    lead,
                    points,
                    image,
                    imageAlt,
                  },
                  index
                ) => {
                  const withImage = Boolean(image);
                  const photoIndex = DETAIL.slice(0, index).filter(
                    (d) => d.image
                  ).length;
                  const imageRight = withImage && photoIndex % 2 === 1;

                  return (
                    <Reveal
                      key={id}
                      as="article"
                      id={id}
                      variant={imageRight ? "left" : "right"}
                      delay={30}
                      duration={700}
                      className="scroll-mt-28 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50 shadow-xl shadow-black/20 transition-[border-color,box-shadow] duration-300 hover:border-zinc-700/90 hover:shadow-2xl hover:shadow-black/30 md:scroll-mt-24"
                    >
                      <div
                        className={cn(
                          withImage ? "grid lg:grid-cols-2" : "block"
                        )}
                      >
                        {withImage && image ? (
                          <div
                            className={cn(
                              "relative aspect-[16/10] min-h-[12rem] bg-zinc-900 sm:min-h-0 lg:aspect-auto lg:min-h-[20rem]",
                              imageRight && "lg:order-2"
                            )}
                          >
                            <Image
                              src={image}
                              alt={imageAlt}
                              fill
                              sizes="(max-width: 1024px) 100vw, 28rem"
                              className={cn(imgBrand, "object-center")}
                            />
                            <div
                              className={cn(
                                "absolute inset-0",
                                imageRight
                                  ? "bg-gradient-to-l from-transparent to-zinc-950/35"
                                  : "bg-gradient-to-r from-transparent to-zinc-950/35"
                              )}
                            />
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.04]" />
                          </div>
                        ) : null}
                        <div
                          className={cn(
                            "flex flex-col justify-center gap-4 p-5 sm:p-7",
                            withImage &&
                              (imageRight
                                ? "border-t border-zinc-800 lg:border-r lg:border-t-0"
                                : "border-t border-zinc-800 lg:border-l lg:border-t-0"),
                            !withImage &&
                              "md:flex-row md:items-start md:gap-10"
                          )}
                        >
                          <div
                            className={cn(
                              !withImage && "md:max-w-xs md:shrink-0"
                            )}
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-900/40 bg-emerald-950/40 text-emerald-400">
                              <Icon className="h-5 w-5" aria-hidden />
                            </div>
                            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-500/85">
                              {eyebrow}
                            </p>
                            <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
                              {title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                              {lead}
                            </p>
                          </div>
                          <ul
                            className={cn(
                              "space-y-2.5 border-t border-zinc-800/80 pt-4",
                              !withImage &&
                                "md:flex-1 md:border-l md:border-t-0 md:pl-8 md:pt-0"
                            )}
                          >
                            {points.map((p) => (
                              <li
                                key={p}
                                className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-400"
                              >
                                <Check
                                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500/80"
                                  aria-hidden
                                />
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </Reveal>
                  );
                }
              )}
            </div>

            <Reveal variant="up" delay={40} className="mt-8 sm:mt-10">
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-zinc-200">
                  Also in the box
                </h3>
                <RevealStagger
                  className="mt-5 grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 lg:grid-cols-4"
                  step={50}
                >
                  {ALSO.map(({ icon: Icon, title, body }) => (
                    <div key={title} className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400">
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-200">
                          {title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                          {body}
                        </p>
                      </div>
                    </div>
                  ))}
                </RevealStagger>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── Day ─── */}
        <section id="day" className={sectionBorder}>
          <div className={sectionShell}>
            <Reveal variant="up">
              <SectionLabel>Happy path</SectionLabel>
              <h2 className="mt-3 text-[1.75rem] font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                A training day, step by step
              </h2>
              <p className="mt-2 max-w-lg text-sm text-zinc-500">
                Open Today, train, complete, keep the week moving.
              </p>
            </Reveal>

            <RevealStagger
              className="mt-9 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:mt-10 lg:grid-cols-4"
              step={80}
              base={40}
            >
              {DAY.map((step, i) => (
                <div key={step.t} className={cn("mkt-card p-5")}>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-900/50 bg-emerald-950/50 text-xs font-bold tabular-nums text-emerald-400">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-100">
                    {step.t}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                    {step.d}
                  </p>
                </div>
              ))}
            </RevealStagger>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section id="start" className="scroll-mt-28 md:scroll-mt-20">
          <div className={sectionShell}>
            <Reveal variant="scale" duration={750}>
              <div className="relative overflow-hidden rounded-2xl border border-emerald-900/45 bg-gradient-to-br from-emerald-950/60 via-zinc-950 to-zinc-950 p-6 sm:p-10">
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-emerald-600/10 blur-3xl"
                  aria-hidden
                />
                <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-lg">
                    <SectionLabel>Get started</SectionLabel>
                    <h2 className="mt-3 text-[1.75rem] font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                      Solo PT or studio team.
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                      Create an account, add clients, design a program, start
                      from Today. Invite trainers when you’re ready.
                    </p>
                    <div className="mt-7 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:gap-3">
                      <Link
                        href="/register"
                        className={cn(
                          btnPrimaryLg,
                          "w-full sm:w-auto",
                          linkFocus
                        )}
                      >
                        Create account
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                      <Link
                        href="/login"
                        className={cn(
                          btnSecondaryLg,
                          "w-full sm:w-auto",
                          linkFocus
                        )}
                      >
                        Sign in
                      </Link>
                    </div>
                  </div>
                  <RevealStagger
                    className="w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/60 lg:w-auto lg:min-w-[16.5rem]"
                    step={70}
                    base={80}
                  >
                    {[
                      "Register solo or studio",
                      "Today board & Needs you",
                      "Session → pack burn",
                      "Invite trainers",
                    ].map((line, i) => (
                      <div
                        key={line}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3.5 text-sm text-zinc-400",
                          i > 0 && "border-t border-zinc-800/80"
                        )}
                      >
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-950/70 text-[11px] font-bold tabular-nums text-emerald-400">
                          {i + 1}
                        </span>
                        {line}
                      </div>
                    ))}
                  </RevealStagger>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800/80">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
            <div className="max-w-xs">
              <BrandMark href="/marketing" />
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-500">
                Floor OS for personal trainers — sessions, programs, packs,
                bookings, CRM.
              </p>
              <a
                href="https://floorscribe.com"
                className={cn(
                  "mt-3 inline-flex min-h-9 items-center text-xs font-medium text-zinc-500 transition hover:text-emerald-400/90",
                  linkFocus
                )}
              >
                floorscribe.com
              </a>
            </div>
            <nav
              className="flex flex-wrap gap-x-1 gap-y-0 text-xs text-zinc-500 sm:max-w-md sm:justify-end"
              aria-label="Footer"
            >
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-10 items-center px-2.5 hover:text-zinc-300",
                    linkFocus
                  )}
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/login"
                className={cn(
                  "inline-flex min-h-10 items-center px-2.5 hover:text-zinc-300",
                  linkFocus
                )}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className={cn(
                  "inline-flex min-h-10 items-center px-2.5 font-medium text-emerald-500/90 hover:text-emerald-400",
                  linkFocus
                )}
              >
                Get started
              </Link>
              <a
                href="https://github.com/CyberoniOntoni/floorscribe"
                className={cn(
                  "inline-flex min-h-10 items-center px-2.5 hover:text-zinc-300",
                  linkFocus
                )}
                rel="noopener noreferrer"
                target="_blank"
              >
                GitHub
              </a>
            </nav>
          </div>
          <div className="mt-8 border-t border-zinc-900/90 pt-5">
            <p className="text-center text-[11px] leading-relaxed text-zinc-600 sm:text-left">
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
