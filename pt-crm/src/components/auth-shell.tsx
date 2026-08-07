import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

/**
 * Shared backdrop + brand header for /login and /register.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16,185,129,0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(16,185,129,0.06), transparent)",
        }}
      />
      <div className="relative w-full max-w-md animate-in">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center rounded-full border border-emerald-900/40 bg-emerald-950/30 px-3.5 py-1.5">
            <BrandMark size="sm" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-50">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}
