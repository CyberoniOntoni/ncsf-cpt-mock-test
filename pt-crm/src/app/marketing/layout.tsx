import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL || "https://floorscribe.com"
  ),
  title: "FloorScribe — Floor OS for personal trainers",
  description:
    "FloorScribe is the day board for personal trainers — sessions, programs, packs, bookings, invoices, and coach. Solo or studio.",
  alternates: {
    canonical: "https://floorscribe.com",
  },
  openGraph: {
    title: "FloorScribe — run the floor, not the paperwork",
    description:
      "Sessions, packs, CRM, and coach on one floor board. Built for solo PTs and micro-studios.",
    type: "website",
    url: "https://floorscribe.com",
    siteName: "FloorScribe",
    images: [{ url: "/marketing/hero-bg.jpg", width: 1920, height: 1080 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FloorScribe — Floor OS for personal trainers",
    description:
      "Sessions, packs, CRM, and coach on one floor board. Solo or studio.",
    images: ["/marketing/hero-bg.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
  colorScheme: "dark",
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
