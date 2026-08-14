"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { PUBLIC_NAV, SITE_COPY } from "@/lib/site/copy";
import { cn } from "@/lib/utils";

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";

const btnGhost =
  "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-stone-400 transition hover:bg-stone-900/70 hover:text-stone-100";

const btnPrimary =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-800 px-3.5 text-sm font-semibold text-stone-50 shadow-[0_8px_20px_-10px_rgb(6_78_59)] transition hover:bg-emerald-700 active:bg-emerald-800 motion-reduce:transition-none";

export type PublicSiteHeaderProps = {
  variant: "marketing" | "find" | "auth" | "portal";
  scrolled?: boolean;
  sectionNav?: readonly { href: string; id: string; label: string }[];
  activeSectionId?: string;
  trailing?: ReactNode;
};

export function PublicSiteHeader(props: PublicSiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();
  const isFind = props.variant === "find";
  const isPortal = props.variant === "portal";
  const isAuth = props.variant === "auth";
  const onRegister = pathname.startsWith("/register");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function isCurrent(audience: "trainer" | "seeker" | "client") {
    return (
      (audience === "seeker" && isFind) ||
      (audience === "client" && isPortal) ||
      (audience === "trainer" && props.variant === "marketing")
    );
  }

  const defaultTrailing = isAuth ? (
    onRegister ? (
      <Link href={SITE_COPY.signInCta.href} className={cn(btnPrimary, linkFocus)}>
        {SITE_COPY.signInCta.label}
      </Link>
    ) : (
      <Link href={SITE_COPY.primaryCta.href} className={cn(btnPrimary, linkFocus)}>
        {SITE_COPY.primaryCta.label}
      </Link>
    )
  ) : (
    <>
      <Link
        href={SITE_COPY.signInCta.href}
        className={cn(btnGhost, linkFocus, "hidden sm:inline-flex")}
      >
        {SITE_COPY.signInCta.label}
      </Link>
      <Link href={SITE_COPY.primaryCta.href} className={cn(btnPrimary, linkFocus)}>
        {SITE_COPY.primaryCta.label}
      </Link>
    </>
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 motion-reduce:transition-none",
        props.scrolled || open
          ? "border-white/[0.07] bg-[#12100e]/92 shadow-[0_12px_40px_-24px_rgb(0_0_0/0.85)] backdrop-blur-xl"
          : "border-transparent bg-[#12100e]/35 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <BrandMark href="/marketing" size="md" />

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
          aria-label="Site"
        >
          {PUBLIC_NAV.map((item) => {
            const current = isCurrent(item.audience);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-sm transition",
                  linkFocus,
                  current
                    ? "bg-white/[0.06] font-medium text-stone-50"
                    : "text-stone-400 hover:bg-white/[0.04] hover:text-stone-100"
                )}
                aria-current={current ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {props.trailing ?? defaultTrailing}
          <button
            type="button"
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-300 hover:bg-stone-900 hover:text-stone-50 lg:hidden",
              linkFocus
            )}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id={menuId}
          className="border-t border-white/[0.06] bg-[#12100e]/96 lg:hidden"
        >
          <nav className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-3 sm:px-6" aria-label="Site">
            {PUBLIC_NAV.map((item) => {
              const current = isCurrent(item.audience);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center rounded-xl px-3 text-sm",
                    linkFocus,
                    current
                      ? "bg-white/[0.06] font-medium text-stone-50"
                      : "text-stone-300 hover:bg-white/[0.04]"
                  )}
                  aria-current={current ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
            {isAuth || props.trailing ? null : (
              <Link
                href={SITE_COPY.signInCta.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center rounded-xl px-3 text-sm text-stone-300 hover:bg-white/[0.04] sm:hidden",
                  linkFocus
                )}
              >
                {SITE_COPY.signInCta.label}
              </Link>
            )}
            {props.sectionNav && props.sectionNav.length > 0 ? (
              <>
                <p className="mt-2 px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-600">
                  On this page
                </p>
                {props.sectionNav.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center rounded-xl px-3 text-sm",
                      linkFocus,
                      props.activeSectionId === item.id
                        ? "text-emerald-400"
                        : "text-stone-400 hover:bg-white/[0.04] hover:text-stone-200"
                    )}
                  >
                    {item.label}
                  </a>
                ))}
              </>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
