"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";

/** Element id of the full client PageHeader block — sticky appears only after it leaves view. */
export const CLIENT_PAGE_HEADER_ID = "client-page-header";

const STICKY_NAME_ID = "client-sticky-bar-name";

export type ClientDetailStickyBarProps = {
  name: string;
  stageLabel: string;
  stageTone: "green" | "amber" | "default";
  hasRisk: boolean;
  /**
   * Quiet commercial whisper (e.g. "3 left" / "Renew package") → #crm-pack.
   */
  packLabel?: string | null;
  packTone?: "amber" | "muted" | "default";
  packHref?: string;
  /**
   * Link primary CTA. Ignored when `primarySlot` is provided.
   * Pass null when there is no primary action.
   */
  primary?: { label: string; href: string } | null;
  /** Optional ReactNode replaces the Link button (e.g. StartSessionButton). */
  primarySlot?: ReactNode;
};

function shellMobileHeaderHeight(): number {
  if (typeof document === "undefined") return 0;
  const el = document.querySelector<HTMLElement>("[data-shell-mobile-header]");
  if (!el) return 0;
  // md:hidden — still in DOM; use offsetParent / computed display
  const style = window.getComputedStyle(el);
  if (style.display === "none") return 0;
  return el.getBoundingClientRect().height;
}

function setShellCssVars(shellH: number, stickyH: number) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--shell-mobile-h", `${shellH}px`);
  root.style.setProperty("--client-sticky-h", `${stickyH}px`);
}

/**
 * Mini client chrome after the full page header scrolls away.
 * Docks under the mobile shell top bar (menu + sticky client), not over it.
 */
export function ClientDetailStickyBar({
  name,
  stageLabel,
  stageTone,
  hasRisk,
  packLabel = null,
  packTone = "muted",
  packHref = "#crm-pack",
  primary = null,
  primarySlot,
}: ClientDetailStickyBarProps) {
  const [show, setShow] = useState(false);
  const [topPx, setTopPx] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateShow = () => {
      const header = document.getElementById(CLIENT_PAGE_HEADER_ID);
      const shellH = shellMobileHeaderHeight();
      setTopPx(shellH);

      if (!header) {
        // Fallback: show after a modest scroll
        setShow(window.scrollY > 160);
        return;
      }

      // Show once the full identity header has scrolled above the shell chrome
      const bottom = header.getBoundingClientRect().bottom;
      setShow(bottom <= shellH + 4);
    };

    updateShow();

    window.addEventListener("scroll", updateShow, { passive: true });
    window.addEventListener("resize", updateShow, { passive: true });

    // Re-measure when mobile shell header height changes (chip, safe-area, etc.)
    const shellEl = document.querySelector<HTMLElement>(
      "[data-shell-mobile-header]"
    );
    let ro: ResizeObserver | null = null;
    if (shellEl && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updateShow());
      ro.observe(shellEl);
    }

    return () => {
      window.removeEventListener("scroll", updateShow);
      window.removeEventListener("resize", updateShow);
      ro?.disconnect();
      setShellCssVars(0, 0);
    };
  }, []);

  // Publish scroll-offset CSS vars for in-page anchors under stacked chrome
  useEffect(() => {
    if (!show) {
      setShellCssVars(shellMobileHeaderHeight(), 0);
      return;
    }

    const measure = () => {
      const shellH = shellMobileHeaderHeight();
      const stickyH = barRef.current?.getBoundingClientRect().height ?? 0;
      setTopPx(shellH);
      setShellCssVars(shellH, stickyH);
    };

    measure();

    const barEl = barRef.current;
    let ro: ResizeObserver | null = null;
    if (barEl && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(barEl);
    }

    return () => {
      ro?.disconnect();
    };
  }, [show]);

  const showPrimaryLink = !primarySlot && primary?.label && primary?.href;

  if (!show) return null;

  return (
    <div
      ref={barRef}
      role="complementary"
      aria-labelledby={STICKY_NAME_ID}
      className={cn(
        "fixed inset-x-0 z-20 border-b border-zinc-800/70 bg-zinc-950/75 px-3 py-2 shadow-sm shadow-black/15 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/65",
        "md:left-56"
      )}
      style={{ top: topPx }}
    >
      <div className="mx-auto flex min-h-11 max-w-6xl items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              id={STICKY_NAME_ID}
              className="truncate text-sm font-semibold tracking-tight text-zinc-50"
              title={name}
            >
              {name}
            </span>
            <Badge tone={stageTone} className="shrink-0 capitalize">
              {stageLabel.replaceAll("_", " ")}
            </Badge>
            {packLabel && (
              <Link
                href={packHref}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                  packTone === "amber"
                    ? "bg-amber-900/40 text-amber-200 hover:bg-amber-900/55"
                    : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                )}
                title="Jump to packages"
              >
                {packLabel}
              </Link>
            )}
            {hasRisk && (
              <Link
                href="#goals-constraints"
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-amber-900/40 px-2.5 py-1 text-[11px] font-medium text-amber-200",
                  "transition hover:bg-amber-900/55",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                )}
                title="Injuries or contraindications on file — jump to goals & constraints"
              >
                <AlertTriangle
                  className="h-3 w-3 text-amber-400"
                  aria-hidden
                />
                Risk
              </Link>
            )}
          </div>
        </div>
        {(primarySlot || showPrimaryLink) && (
          <div className="shrink-0">
            {primarySlot ? (
              primarySlot
            ) : showPrimaryLink ? (
              <Link
                href={primary!.href}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold",
                  "bg-emerald-600 text-white shadow-sm shadow-emerald-950/40",
                  "transition hover:bg-emerald-500 active:bg-emerald-600",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                )}
                aria-label={primary!.label}
              >
                {primary!.label}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
