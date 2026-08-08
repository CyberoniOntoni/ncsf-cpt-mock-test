"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#paths", id: "paths", label: "Paths" },
  { href: "#day", id: "day", label: "Day" },
  { href: "#start", id: "start", label: "Start" },
] as const;

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";

const btnPrimarySm =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-2 text-sm font-semibold text-stone-50 shadow-sm shadow-black/25 transition hover:bg-emerald-700 active:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";

export function MarketingHeader() {
  const [active, setActive] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sections = NAV.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (sections.length === 0) return;

    const onScroll = () => {
      setScrolled(window.scrollY > 8);
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
        rootMargin: "-22% 0px -52% 0px",
        threshold: [0, 0.12, 0.3, 0.5],
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
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 motion-reduce:transition-none",
        scrolled
          ? "border-stone-800/80 bg-[#141210]/96 shadow-lg shadow-black/20 backdrop-blur-md supports-[backdrop-filter]:bg-[#141210]/88"
          : "border-transparent bg-[#141210]/55 backdrop-blur-md supports-[backdrop-filter]:bg-[#141210]/40"
      )}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark
            href="/marketing"
            size="md"
            className="text-emerald-600"
          />
          <span
            className="hidden h-4 w-px bg-stone-800/90 sm:block"
            aria-hidden
          />
          <span className="hidden truncate text-[11px] font-medium text-stone-500 sm:inline">
            For trainers who run the day
          </span>
        </div>

        <nav
          className="hidden items-center gap-0.5 md:flex"
          aria-label="On this page"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-10 items-center rounded-lg px-3 text-sm transition",
                linkFocus,
                active === item.id
                  ? "bg-emerald-950/45 font-medium text-emerald-500"
                  : "text-stone-400 hover:bg-stone-900/60 hover:text-stone-100"
              )}
              aria-current={active === item.id ? "true" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-stone-400 transition hover:bg-stone-900/50 hover:text-stone-100 sm:px-3",
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

      <nav
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain border-t border-stone-900/70 px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
        aria-label="Sections"
      >
        {NAV.map((item) => {
          const isActive = active === item.id;
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-9 shrink-0 snap-start items-center rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition",
                linkFocus,
                isActive
                  ? "border-emerald-800/55 bg-emerald-950/45 text-emerald-400"
                  : "border-stone-800/80 bg-[#141210]/90 text-stone-400 hover:border-stone-700 hover:text-stone-200"
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
