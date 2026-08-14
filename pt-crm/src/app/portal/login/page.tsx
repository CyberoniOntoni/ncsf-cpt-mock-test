import Link from "next/link";
import { PublicSiteFooter } from "@/components/public-site-footer";
import { PublicSiteHeader } from "@/components/public-site-header";
import { SITE_COPY } from "@/lib/site/copy";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export const metadata = { title: "Client portal" };

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; next?: string }>;
}) {
  const { redirectTo, next } = await searchParams;
  const dest = redirectTo || next;
  return (
    <div className="mkt-root min-h-dvh bg-[#12100e] text-stone-100">
      <PublicSiteHeader
        variant="portal"
        scrolled
        trailing={
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-stone-500 hover:text-stone-300"
          >
            Trainer? Staff login
          </Link>
        }
      />
      <div className="mx-auto flex max-w-md flex-col px-4 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          {SITE_COPY.portalCta.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-stone-400">
          Use the password you created, or a one-time code if your trainer
          already has you on file.
        </p>
        <div className="mt-6">
          <PortalLoginForm redirectTo={dest} />
        </div>
        <p className="mt-8 text-center text-xs text-stone-600">
          New here?{" "}
          <a href="/portal/register" className="text-emerald-500 hover:underline">
            Create an account
          </a>
          {" · "}
          Trainer?{" "}
          <a href={SITE_COPY.signInCta.href} className="text-emerald-500 hover:underline">
            Staff login
          </a>
        </p>
      </div>
      <PublicSiteFooter variant="portal" />
    </div>
  );
}
