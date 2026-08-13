import type { ReactNode } from "react";
import Link from "next/link";
import { PublicSiteFooter } from "@/components/public-site-footer";
import { PublicSiteHeader } from "@/components/public-site-header";
import { SITE_COPY } from "@/lib/site/copy";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#141210] text-stone-100">
      <PublicSiteHeader variant="auth" scrolled />
      <div className="relative mx-auto flex max-w-md flex-col px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-50">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-stone-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
        {footer}
        <p className="mt-8 text-center text-xs text-stone-600">
          Looking for a trainer?{" "}
          <Link href={SITE_COPY.findCta.href} className="text-emerald-500 hover:underline">
            {SITE_COPY.findCta.label}
          </Link>
          {" · "}
          Already a client?{" "}
          <Link href={SITE_COPY.portalCta.href} className="text-emerald-500 hover:underline">
            {SITE_COPY.portalCta.label}
          </Link>
        </p>
      </div>
      <PublicSiteFooter />
    </div>
  );
}
