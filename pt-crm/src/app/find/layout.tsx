import { FindChrome } from "@/components/find-chrome";
import { PublicSiteFooter } from "@/components/public-site-footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find a trainer",
  description:
    "Search FloorScribe trainers by area or gym and request an intro. Training and session payments are with the trainer.",
};

export default async function FindLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mkt-root mkt-grain min-h-dvh bg-[#12100e] text-stone-100">
      <FindChrome />
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
      <PublicSiteFooter variant="find" />
    </div>
  );
}
