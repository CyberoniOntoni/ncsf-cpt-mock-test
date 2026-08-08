import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL || "https://floorscribe.com"
  ),
  title: "FloorScribe - run the day, not the paperwork",
  description:
    "FloorScribe helps personal trainers keep session logs, packs, bookings, and simple invoices in one place - solo or with a small team.",
  alternates: {
    canonical: "https://floorscribe.com",
  },
  openGraph: {
    title: "FloorScribe - run the day, not the paperwork",
    description:
      "Session logs, packs, bookings, and invoices together - so you can stay with the client instead of juggling tabs.",
    type: "website",
    url: "https://floorscribe.com",
    siteName: "FloorScribe",
    images: [{ url: "/marketing/hero-calm.jpg", width: 1920, height: 1080 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FloorScribe - run the day, not the paperwork",
    description:
      "Session logs, packs, bookings, and invoices in one place for personal trainers.",
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
