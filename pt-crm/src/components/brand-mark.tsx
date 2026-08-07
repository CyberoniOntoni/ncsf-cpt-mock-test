import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Product wordmark — FloorScribe.
 * Use in shell, login, and any chrome that should feel branded.
 */
export function BrandMark({
  href,
  className,
  size = "md",
  onNavigate,
}: {
  /** When set, wraps the mark in a link (usually `/`). */
  href?: string;
  className?: string;
  size?: "sm" | "md";
  /** e.g. close mobile drawer after navigating home */
  onNavigate?: () => void;
}) {
  const mark = (
    <span
      className={cn(
        "font-semibold tracking-tight text-emerald-400",
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      FloorScribe
    </span>
  );

  if (!href) return mark;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
      aria-label="FloorScribe home"
    >
      {mark}
    </Link>
  );
}
