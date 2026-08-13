import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import {
  PORTAL_FOOTER_NOTE,
  PUBLIC_NAV,
  SEEKER_AUTH,
  SITE_COPY,
  SITE_DISCLAIMERS,
} from "@/lib/site/copy";
import { cn } from "@/lib/utils";

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";

export function PublicSiteFooter(props: {
  variant?: "marketing" | "find" | "auth" | "portal";
}) {
  const variant = props.variant ?? "marketing";
  const authCtas =
    variant === "find"
      ? { signIn: SEEKER_AUTH.signIn, register: SEEKER_AUTH.register }
      : variant === "portal"
        ? { signIn: SITE_COPY.signInCta, register: null }
        : { signIn: SITE_COPY.signInCta, register: SITE_COPY.primaryCta };

  return (
    <footer className="border-t border-white/[0.06] bg-[#12100e]/80 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <BrandMark href="/marketing" className="text-emerald-600" />
            <p className="mt-2.5 text-xs leading-relaxed text-stone-500">
              {SITE_COPY.oneLiner}
            </p>
            <a
              href="https://floorscribe.com"
              className={cn(
                "mt-3 inline-flex min-h-9 items-center text-xs font-medium text-stone-500 hover:text-emerald-600",
                linkFocus
              )}
            >
              floorscribe.com
            </a>
          </div>
          <nav className="flex flex-wrap gap-x-1 text-xs text-stone-500" aria-label="Footer">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn("inline-flex min-h-10 items-center px-2.5 hover:text-stone-300", linkFocus)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={authCtas.signIn.href}
              className={cn("inline-flex min-h-10 items-center px-2.5 hover:text-stone-300", linkFocus)}
            >
              {authCtas.signIn.label}
            </Link>
            {authCtas.register ? (
              <Link
                href={authCtas.register.href}
                className={cn(
                  "inline-flex min-h-10 items-center px-2.5 font-medium text-emerald-600 hover:text-emerald-500",
                  linkFocus
                )}
              >
                {authCtas.register.label}
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="mt-8 border-t border-stone-900/90 pt-5">
          <p className="text-center text-[11px] leading-relaxed text-stone-600 sm:text-left">
            {SITE_DISCLAIMERS.medical}
          </p>
          {variant === "find" ? (
            <p className="mt-2 text-center text-[11px] leading-relaxed text-stone-600 sm:text-left">
              {SITE_DISCLAIMERS.findIntro}
            </p>
          ) : null}
          {variant === "portal" ? (
            <p className="mt-2 text-center text-[11px] leading-relaxed text-stone-600 sm:text-left">
              {PORTAL_FOOTER_NOTE}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
