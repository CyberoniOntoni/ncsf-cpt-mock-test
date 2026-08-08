"use client";

import { useEffect, useState } from "react";

/** Thin top progress bar that fills as the page is scrolled. */
export function MarketingScrollProgress() {
  const [p, setP] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] bg-stone-900/50"
      aria-hidden
    >
      <div
        className="h-full origin-left bg-emerald-800/90 motion-safe:transition-[width] motion-safe:duration-150 motion-safe:ease-out"
        style={{ width: `${p * 100}%` }}
      />
    </div>
  );
}
