export type PublicAudience = "trainer" | "seeker" | "client";

export const SITE_COPY = {
  productName: "FloorScribe",
  tagline: "Run the day. Not the paperwork.",
  oneLiner: "Floor OS for personal trainers — sessions, packs, programs, and the follow-through.",
  heroEyebrow: "For personal trainers — solo or with a small team",
  heroBody:
    "FloorScribe keeps the session log, packs, bookings, programs, and simple invoices together so you can stay with the client instead of juggling tabs.",
  primaryCta: { href: "/register", label: "Create account" },
  soloCta: { href: "/register/solo", label: "Start solo" },
  studioCta: { href: "/register/studio", label: "Start a studio" },
  signInCta: { href: "/login", label: "Sign in" },
  findCta: { href: "/find", label: "Find a trainer" },
  portalCta: { href: "/portal/login", label: "Client portal" },
  marketingHome: { href: "/marketing", label: "For trainers" },
} as const;

export const PUBLIC_NAV = [
  { href: "/marketing", label: "For trainers", audience: "trainer" as const },
  { href: "/find", label: "Find a trainer", audience: "seeker" as const },
  { href: "/portal/login", label: "Client portal", audience: "client" as const },
] as const;

export const TRAINER_SECTION_NAV = [
  { href: "#how", id: "how", label: "How it works" },
  { href: "#included", id: "included", label: "What's included" },
  { href: "#doors", id: "doors", label: "Who it's for" },
  { href: "#start", id: "start", label: "Get started" },
] as const;

export const FEATURE_PILLARS = [
  {
    title: "Session log",
    body: "Weight, reps, RPE, and cues between sets — without opening a spreadsheet.",
  },
  {
    title: "Session packs",
    body: "Finishing a session uses a pack credit. See what is left before they walk in.",
  },
  {
    title: "Bookings",
    body: "Schedule from the client, see the week on the calendar, start the session from the booking.",
  },
  {
    title: "Programs",
    body: "Design a week from screens and equipment. Auto-design uses NSCA/ACSM-minded rules you can still edit.",
  },
  {
    title: "Client portal",
    body: "Assigned clients sign in with a one-time code to see their plan, progress, and invoices. Not a public social app.",
  },
  {
    title: "Find a trainer",
    body: "People search by named area or gym and send an intro. You accept into the CRM. FloorScribe introduces; session pay stays with you.",
  },
] as const;

export const AUDIENCE_DOORS = [
  {
    audience: "trainer" as const,
    title: "I am a trainer",
    body: "Run Today, log sessions, design programs, and keep packs and bookings on the same board.",
    href: "/register",
    cta: "Create a trainer account",
  },
  {
    audience: "client" as const,
    title: "I already train with someone",
    body: "If your trainer uses FloorScribe, sign in with the email they have on file. We send a one-time code.",
    href: "/portal/login",
    cta: "Open client portal",
  },
  {
    audience: "seeker" as const,
    title: "I am looking for a trainer",
    body: "Search by area or gym, read credentials and rates, and request an intro. Training payments are with the trainer.",
    href: "/find",
    cta: "Find a trainer",
  },
] as const;

export const DAY_STEPS = [
  {
    t: "See the day",
    d: "Open Today and you know who you are training, what is booked, and what still needs you.",
  },
  {
    t: "Train on the floor",
    d: "Log sets, RPE, and cues. When you finish, the pack count updates with the session.",
  },
  {
    t: "Keep the week moving",
    d: "Rebook, send a check-in, or mark an invoice. Design the next block when the current one is done.",
  },
] as const;

export const START_STEPS = [
  "Create a solo or studio account",
  "Add a client and open Today",
  "Log a session — packs stay in sync",
  "Publish a trainer card or invite the client to the portal when you are ready",
] as const;

export const SITE_DISCLAIMERS = {
  medical:
    "FloorScribe provides coaching support tools for qualified personal trainers. It does not diagnose medical conditions. Refer red-flag symptoms to appropriate clinicians.",
  findIntro:
    "FloorScribe introduces you. Training and session payments are between you and the trainer.",
} as const;
