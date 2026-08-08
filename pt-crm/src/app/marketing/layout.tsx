import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL || "https://floorscribe.com"
  ),
  title: "FloorScribe - run the day, not the paperwork",
  description:
    "Session logs, packs, bookings, and simple invoices for personal trainers. Solo practice or studio team - one board for the floor day.",
  alternates: {
    canonical: "https://floorscribe.com",
  },
  openGraph: {
    title: "FloorScribe - run the day, not the paperwork",
    description:
      "Session logs, packs, bookings, and invoices on one board. Built for solo PTs and small studios.",
    type: "website",
    url: "https://floorscribe.com",
    siteName: "FloorScribe",
    images: [{ url: "/marketing/hero-calm.jpg", width: 1920, height: 1080 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FloorScribe - run the day, not the paperwork",
    description:
      "Session logs, packs, bookings, and invoices on one board. Solo or studio.",
    images: ["/marketing/hero-calm.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#141210",
  colorScheme: "dark",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mkt-root min-h-dvh bg-[#141210] font-sans text-stone-100 antialiased selection:bg-emerald-800/35 selection:text-stone-50">
      {children}
    </div>
  );
}
