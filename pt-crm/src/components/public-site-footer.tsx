import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PUBLIC_NAV, SITE_COPY, SITE_DISCLAIMERS } from "@/lib/site/copy";
import { cn } from "@/lib/utils";

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";

export function PublicSiteFooter() {
  return (
    <footer className="border-t border-stone-800/70">
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
              href={SITE_COPY.signInCta.href}
              className={cn("inline-flex min-h-10 items-center px-2.5 hover:text-stone-300", linkFocus)}
            >
              {SITE_COPY.signInCta.label}
            </Link>
            <Link
              href={SITE_COPY.primaryCta.href}
              className={cn(
                "inline-flex min-h-10 items-center px-2.5 font-medium text-emerald-600 hover:text-emerald-500",
                linkFocus
              )}
            >
              {SITE_COPY.primaryCta.label}
            </Link>
          </nav>
        </div>
        <div className="mt-8 border-t border-stone-900/90 pt-5">
          <p className="text-center text-[11px] leading-relaxed text-stone-600 sm:text-left">
            {SITE_DISCLAIMERS.medical}
          </p>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-stone-600 sm:text-left">
            {SITE_DISCLAIMERS.findIntro}
          </p>
        </div>
      </div>
    </footer>
  );
}
