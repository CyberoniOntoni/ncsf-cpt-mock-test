import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Floor OS for personal trainers",
  description:
    "FloorScribe — run the training day on one board: sessions, packs, bookings, invoices, and coach. Built for the gym floor, not desk CRM bloat. Self-host first.",
  openGraph: {
    title: "FloorScribe — floor OS for personal trainers",
    description:
      "Sessions, clients, programs, CRM, invoices — floor first. Self-host pilot ready.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FloorScribe",
    description: "Floor OS for personal trainers.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-zinc-950 font-sans text-zinc-100 antialiased selection:bg-emerald-500/25 selection:text-emerald-50">
      {children}
    </div>
  );
}
