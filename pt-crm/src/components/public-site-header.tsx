"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PUBLIC_NAV, SITE_COPY } from "@/lib/site/copy";
import { cn } from "@/lib/utils";

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";

const btnPrimarySm =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-800 px-3.5 py-2 text-sm font-semibold text-stone-50 shadow-sm shadow-black/25 transition hover:bg-emerald-700 active:bg-emerald-800";

export type PublicSiteHeaderProps = {
  variant: "marketing" | "find" | "auth" | "portal";
  scrolled?: boolean;
  sectionNav?: readonly { href: string; id: string; label: string }[];
  activeSectionId?: string;
  trailing?: ReactNode;
};

export function PublicSiteHeader(props: PublicSiteHeaderProps) {
  const isFind = props.variant === "find";
  const isPortal = props.variant === "portal";
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 motion-reduce:transition-none",
        props.scrolled
          ? "border-stone-800/80 bg-[#141210]/96 shadow-lg shadow-black/20 backdrop-blur-md"
          : "border-transparent bg-[#141210]/55 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark href="/marketing" size="md" className="text-emerald-600" />
          <span className="hidden h-4 w-px bg-stone-800/90 sm:block" aria-hidden />
          <span className="hidden truncate text-[11px] font-medium text-stone-500 sm:inline">
            {SITE_COPY.oneLiner}
          </span>
        </div>
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Site">
          {PUBLIC_NAV.map((item) => {
            const current =
              (item.audience === "seeker" && isFind) ||
              (item.audience === "client" && isPortal) ||
              (item.audience === "trainer" && props.variant === "marketing");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-lg px-3 text-sm transition",
                  linkFocus,
                  current
                    ? "bg-emerald-950/45 font-medium text-emerald-500"
                    : "text-stone-400 hover:bg-stone-900/60 hover:text-stone-100"
                )}
                aria-current={current ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {props.trailing ?? (
            <>
              <Link
                href={SITE_COPY.signInCta.href}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-stone-400 hover:text-stone-100",
                  linkFocus
                )}
              >
                {SITE_COPY.signInCta.label}
              </Link>
              <Link
                href={SITE_COPY.primaryCta.href}
                className={cn(btnPrimarySm, linkFocus)}
              >
                {SITE_COPY.primaryCta.label}
              </Link>
            </>
          )}
        </div>
      </div>
      {props.sectionNav && props.sectionNav.length > 0 ? (
        <nav
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto border-t border-stone-900/70 px-3 py-2 md:hidden"
          aria-label="On this page"
        >
          {props.sectionNav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[11px] font-medium",
                linkFocus,
                props.activeSectionId === item.id
                  ? "border-emerald-800/55 bg-emerald-950/45 text-emerald-400"
                  : "border-stone-800/80 text-stone-400"
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
      ) : (
        <nav
          className="flex gap-2 overflow-x-auto border-t border-stone-900/70 px-3 py-2 md:hidden"
          aria-label="Site"
        >
          {PUBLIC_NAV.map((item) => {
            const current =
              (item.audience === "seeker" && isFind) ||
              (item.audience === "client" && isPortal) ||
              (item.audience === "trainer" && props.variant === "marketing");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[11px] font-medium",
                  linkFocus,
                  current
                    ? "border-emerald-800/55 bg-emerald-950/45 text-emerald-500"
                    : "border-stone-800/80 text-stone-400"
                )}
                aria-current={current ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
