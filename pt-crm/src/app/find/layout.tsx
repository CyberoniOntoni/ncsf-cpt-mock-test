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
    <div className="min-h-dvh bg-[#141210] text-stone-100">
      <FindChrome />
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
      <PublicSiteFooter />
    </div>
  );
}
