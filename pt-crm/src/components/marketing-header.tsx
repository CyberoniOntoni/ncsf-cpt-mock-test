"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#features", id: "features", label: "Features" },
  { href: "#detail", id: "detail", label: "Inside" },
  { href: "#day", id: "day", label: "Day" },
  { href: "#start", id: "start", label: "Start" },
] as const;

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";

/** Link styled as primary button — never nest <button> inside <Link>. */
const btnPrimarySm =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-950/40 transition hover:bg-emerald-500 active:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 sm:min-h-11 sm:px-3.5 sm:text-sm";

export function MarketingHeader() {
  const [active, setActive] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sections = NAV.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (sections.length === 0) return;

    const onScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0)
          );
        if (visible[0]?.target?.id) {
          setActive(visible[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0, 0.15, 0.35, 0.55],
      }
    );

    for (const el of sections) observer.observe(el);
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 motion-reduce:transition-none",
        scrolled
          ? "border-zinc-800/90 bg-zinc-950/92 shadow-lg shadow-black/25 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/80"
          : "border-zinc-800/50 bg-zinc-950/75 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/65"
      )}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark href="/marketing" size="md" />
          <span
            className="hidden h-4 w-px bg-zinc-800 sm:block"
            aria-hidden
          />
          <span className="hidden truncate text-[11px] font-medium tracking-wide text-zinc-500 sm:inline">
            Floor OS for PTs
          </span>
        </div>

        <nav
          className="hidden items-center gap-0.5 md:flex"
          aria-label="Product"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-10 items-center rounded-lg px-3 text-sm transition",
                linkFocus,
                active === item.id
                  ? "bg-emerald-950/45 font-medium text-emerald-400"
                  : "text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100"
              )}
              aria-current={active === item.id ? "true" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/login"
            className={cn(
              "inline-flex min-h-10 items-center rounded-lg px-2.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-900/60 hover:text-zinc-100 sm:min-h-11 sm:px-3",
              linkFocus
            )}
          >
            Sign in
          </Link>
          <Link href="/register" className={cn(btnPrimarySm, linkFocus)}>
            Get started
          </Link>
        </div>
      </div>

      {/* Mobile section chips */}
      <nav
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain border-t border-zinc-900/80 px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
        aria-label="On this page"
      >
        {NAV.map((item) => {
          const isActive = active === item.id;
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-9 shrink-0 snap-start items-center rounded-full border px-3.5 py-1.5 text-[11px] font-medium tracking-wide transition",
                linkFocus,
                isActive
                  ? "border-emerald-700/55 bg-emerald-950/55 text-emerald-300 shadow-sm shadow-emerald-950/30"
                  : "border-zinc-800/90 bg-zinc-950/90 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 active:bg-zinc-900"
              )}
              aria-current={isActive ? "true" : undefined}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
