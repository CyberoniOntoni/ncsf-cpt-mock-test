import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicSiteFooter } from "@/components/public-site-footer";
import { PublicSiteHeader } from "@/components/public-site-header";
import {
  getSeekerById,
  requireSeekerSession,
} from "@/lib/seeker-auth";
import { SeekerVerifyForm } from "./seeker-verify-form";

export default async function PortalSeekerVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const { setup } = await searchParams;
  const session = await requireSeekerSession("/portal/verify");
  const seeker = await getSeekerById(session.seekerId);
  if (seeker?.emailVerifiedAt) {
    redirect(setup === "1" ? "/portal/profile?setup=1" : "/portal/find");
  }

  return (
    <div className="mkt-root min-h-dvh bg-[#12100e] text-stone-100">
      <PublicSiteHeader
        variant="portal"
        scrolled
        trailing={
          <Link
            href="/portal/login"
            className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-stone-500 hover:text-stone-300"
          >
            Sign in
          </Link>
        }
      />
      <main className="mx-auto max-w-md space-y-4 px-4 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          Check your email
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Verify your email
        </h1>
        <p className="text-sm text-stone-400">
          {setup === "1"
            ? "Confirm this inbox before you finish setup and send intros."
            : "Confirm this inbox before you search trainers and send intros."}
        </p>
        <SeekerVerifyForm email={session.email} setup={setup === "1"} />
      </main>
      <PublicSiteFooter variant="portal" />
    </div>
  );
}
