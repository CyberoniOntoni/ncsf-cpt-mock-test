import { PublicSiteFooter } from "@/components/public-site-footer";
import { PublicSiteHeader } from "@/components/public-site-header";
import { SITE_COPY, SITE_DISCLAIMERS } from "@/lib/site/copy";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export const metadata = { title: "Client portal" };

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  return (
    <div className="min-h-dvh bg-[#141210] text-stone-100">
      <PublicSiteHeader variant="portal" scrolled />
      <div className="mx-auto flex max-w-md flex-col px-4 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          {SITE_COPY.portalCta.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Sign in to your plan
        </h1>
        <p className="mt-2 text-sm text-stone-400">
          We email a one-time code. No password. If you train at more than one
          studio, you will pick which one.
        </p>
        <div className="mt-6">
          <PortalLoginForm redirectTo={redirectTo} />
        </div>
        <p className="mt-8 text-center text-xs text-stone-600">
          Trainer?{" "}
          <a href={SITE_COPY.signInCta.href} className="text-emerald-500 hover:underline">
            Staff login
          </a>
          {" · "}
          Looking for a trainer?{" "}
          <a href={SITE_COPY.findCta.href} className="text-emerald-500 hover:underline">
            {SITE_COPY.findCta.label}
          </a>
        </p>
        <p className="mt-4 text-center text-[11px] text-stone-600">
          {SITE_DISCLAIMERS.findIntro}
        </p>
      </div>
      <PublicSiteFooter />
    </div>
  );
}
