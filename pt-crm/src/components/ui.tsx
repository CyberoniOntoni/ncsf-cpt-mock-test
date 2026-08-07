import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const styles = {
    primary:
      "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-950/40 active:bg-emerald-600",
    secondary:
      "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700 active:bg-zinc-800",
    ghost: "bg-transparent text-zinc-300 hover:bg-zinc-800/80 active:bg-zinc-800",
    danger: "bg-red-700 text-white hover:bg-red-600 active:bg-red-700",
  }[variant];
  const sizes = {
    sm: "min-h-9 px-2.5 py-1.5 text-xs rounded-md gap-1.5",
    md: "min-h-11 px-3.5 py-2 text-sm rounded-lg gap-2",
    lg: "min-h-11 px-4 py-2.5 text-sm rounded-lg gap-2",
  }[size];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-45",
        styles,
        sizes,
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full min-h-[88px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400",
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  padding = "md",
}: {
  className?: string;
  children: React.ReactNode;
  /** Design system: sm = floor/dense, md = default */
  padding?: "sm" | "md" | "none";
}) {
  const pad =
    padding === "none" ? "p-0" : padding === "sm" ? "p-3" : "p-4";
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-sm shadow-black/20",
        pad,
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  /** sky = info / load chips (design system) */
  tone?: "default" | "green" | "amber" | "red" | "sky";
  className?: string;
}) {
  const tones = {
    default: "bg-zinc-800 text-zinc-300",
    green: "bg-emerald-900/50 text-emerald-300",
    amber: "bg-amber-900/40 text-amber-200",
    red: "bg-red-900/40 text-red-200",
    sky: "bg-sky-950/50 text-sky-200 ring-1 ring-sky-900/40",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones,
        className
      )}
    >
      {children}
    </span>
  );
}

/** Design system section label — “In progress”, form groups, etc. */
export function SectionLabel({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "h2" | "h3" | "span" | "p";
}) {
  return (
    <Tag className={cn("section-label", className)}>{children}</Tag>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-4 w-4 animate-spin text-emerald-400", className)}
      aria-hidden
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-800/80",
        className
      )}
      aria-hidden
    />
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-10 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-emerald-400 ring-1 ring-zinc-800">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
  titleAside,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Optional small label above title (e.g. “People”, or a breadcrumb) */
  eyebrow?: ReactNode;
  /** Sits on the same row as the title (e.g. compact chart next to name) */
  titleAside?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow != null && eyebrow !== false && (
          <div className="section-label mb-1 text-emerald-500/90">{eyebrow}</div>
        )}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            {title}
          </h1>
          {titleAside != null && titleAside !== false && (
            <div className="inline-flex translate-y-[-1px] items-center">
              {titleAside}
            </div>
          )}
        </div>
        {description != null && description !== false && (
          <div className="mt-1.5 text-sm text-zinc-500">{description}</div>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-zinc-700 bg-zinc-900/80 text-zinc-300",
    success: "border-emerald-900/50 bg-emerald-950/30 text-emerald-200",
    warning: "border-amber-900/50 bg-amber-950/30 text-amber-100",
    error: "border-red-900/50 bg-red-950/30 text-red-200",
  }[tone];
  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn("rounded-lg border px-3 py-2 text-sm", tones, className)}
    >
      {children}
    </div>
  );
}

/** Shared select styling (auth + settings). */
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
