import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FloorScribe — the floor OS for personal trainers",
  description:
    "Run the training day on one board: sessions, packs, bookings, invoices, and coach — built for the gym floor, not a desk CRM.",
  openGraph: {
    title: "FloorScribe",
    description:
      "Floor OS for personal trainers — sessions, clients, programs, CRM, invoices.",
    type: "website",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 antialiased">
      {children}
    </div>
  );
}
