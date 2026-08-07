import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Design system Phase 2 — list row pattern (resume strips, needs-you, lists).
 * Prefer over ad-hoc flex rows with mixed padding.
 */

export function ListRow({
  href,
  onClick,
  leading,
  title,
  subtitle,
  trailing,
  tone = "default",
  className,
  as: Tag,
}: {
  href?: string;
  onClick?: () => void;
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  tone?: "default" | "accent" | "warn";
  className?: string;
  /** Force element; default Link if href else button/div */
  as?: "div" | "button";
}) {
  const tones = {
    default:
      "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/50",
    accent:
      "border-emerald-900/50 bg-emerald-950/25 hover:border-emerald-700/60 hover:bg-emerald-950/40",
    warn:
      "border-amber-900/50 bg-amber-950/20 hover:border-amber-800/60",
  }[tone];

  const body = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-100">{title}</div>
        {subtitle != null && subtitle !== false && (
          <div className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</div>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </>
  );

  const base = cn(
    "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
    tones,
    className
  );

  if (href && !Tag) {
    return (
      <Link href={href} onClick={onClick} className={base}>
        {body}
      </Link>
    );
  }

  if (Tag === "button" || onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {body}
      </button>
    );
  }

  return <div className={base}>{body}</div>;
}
