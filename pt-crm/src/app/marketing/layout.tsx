import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://floorscribe.com"),
  title: "FloorScribe — run the day, not the paperwork",
  description:
    "Floor OS for personal trainers: session logs, packs, bookings, programs, a client portal, and Find a trainer. Solo or a small studio.",
  alternates: { canonical: "https://floorscribe.com" },
  openGraph: {
    title: "FloorScribe — run the day, not the paperwork",
    description:
      "The floor log, packs, programs, and follow-through in one place. Clients can open a portal. People looking for a PT can request an intro.",
    type: "website",
    url: "https://floorscribe.com",
    siteName: "FloorScribe",
    images: [{ url: "/marketing/hero-calm.jpg", width: 1920, height: 1080 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FloorScribe — run the day, not the paperwork",
    description:
      "Session logs, packs, programs, client portal, and Find a trainer — for personal trainers.",
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
    <div className="mkt-root mkt-grain min-h-dvh bg-[#12100e] font-sans text-stone-100 antialiased selection:bg-emerald-800/35 selection:text-stone-50">
      {children}
    </div>
  );
}
