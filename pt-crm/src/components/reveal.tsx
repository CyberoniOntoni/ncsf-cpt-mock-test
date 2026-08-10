"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type RevealVariant = "up" | "down" | "left" | "right" | "scale" | "fade";

/** Force-reveal if IntersectionObserver never fires (stuck IO / offscreen layout). */
const IO_FAILSAFE_MS = 2000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Scroll-triggered reveal. Plays once when the element enters the viewport.
 * Always ends visible: reduced-motion, missing IO, or failsafe timeout.
 */
export function Reveal({
  children,
  className,
  variant = "up",
  delay = 0,
  duration = 700,
  once = true,
  as: Tag = "div",
  id,
}: {
  children: ReactNode;
  className?: string;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  once?: boolean;
  as?: "div" | "section" | "article" | "li" | "ul" | "header" | "footer";
  id?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setReady(true);
      setInView(true);
      return;
    }

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setReady(true);
      setInView(true);
      return;
    }

    // Arm animation classes on next frame so first paint isn't stuck hidden
    const raf = requestAnimationFrame(() => setReady(true));
    let failSafe = 0;

    const reveal = () => {
      setInView(true);
      if (failSafe) window.clearTimeout(failSafe);
    };

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          reveal();
          if (once) obs.unobserve(el);
        } else if (!once) {
          setInView(false);
        }
      },
      {
        threshold: 0.06,
        // Trigger slightly before fully in view so content isn't blank mid-scroll
        rootMargin: "48px 0px 48px 0px",
      }
    );
    obs.observe(el);

    // If IO never intersects (layout/sticky quirks), show content anyway
    failSafe = window.setTimeout(() => {
      setReady(true);
      setInView(true);
    }, IO_FAILSAFE_MS);

    // Already in viewport on mount (above-fold / hash scroll)
    if (el.getBoundingClientRect().top < window.innerHeight + 48) {
      // Defer so transition can still run once classes arm
      requestAnimationFrame(() => {
        if (el.getBoundingClientRect().top < window.innerHeight + 48) {
          reveal();
          if (once) obs.unobserve(el);
        }
      });
    }

    return () => {
      cancelAnimationFrame(raf);
      if (failSafe) window.clearTimeout(failSafe);
      obs.disconnect();
    };
  }, [once]);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      id={id}
      className={cn(
        ready && "mkt-reveal",
        ready && `mkt-reveal--${variant}`,
        ready && inView && "mkt-reveal--in",
        // Fallback: never leave content invisible if JS fails mid-flight
        !ready && "opacity-100",
        className
      )}
      style={
        {
          "--mkt-delay": `${delay}ms`,
          "--mkt-duration": `${duration}ms`,
        } as CSSProperties
      }
    >
      {children}
    </Tag>
  );
}

export function RevealStagger({
  children,
  className,
  step = 80,
  base = 0,
  variant = "up",
}: {
  children: ReactNode;
  className?: string;
  step?: number;
  base?: number;
  variant?: RevealVariant;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setReady(true);
      setInView(true);
      return;
    }

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setReady(true);
      setInView(true);
      return;
    }

    const raf = requestAnimationFrame(() => setReady(true));
    let failSafe = 0;

    const reveal = () => {
      setInView(true);
      if (failSafe) window.clearTimeout(failSafe);
    };

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          reveal();
          obs.unobserve(el);
        }
      },
      { threshold: 0.04, rootMargin: "48px 0px 48px 0px" }
    );
    obs.observe(el);

    failSafe = window.setTimeout(() => {
      setReady(true);
      setInView(true);
    }, IO_FAILSAFE_MS);

    if (el.getBoundingClientRect().top < window.innerHeight + 48) {
      requestAnimationFrame(() => {
        if (el.getBoundingClientRect().top < window.innerHeight + 48) {
          reveal();
          obs.unobserve(el);
        }
      });
    }

    return () => {
      cancelAnimationFrame(raf);
      if (failSafe) window.clearTimeout(failSafe);
      obs.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        ready && "mkt-stagger",
        ready && `mkt-stagger--${variant}`,
        ready && inView && "mkt-stagger--in",
        // Fallback: never leave staggered children invisible if not armed
        !ready && "opacity-100",
        className
      )}
      style={
        {
          "--mkt-step": `${step}ms`,
          "--mkt-base": `${base}ms`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
