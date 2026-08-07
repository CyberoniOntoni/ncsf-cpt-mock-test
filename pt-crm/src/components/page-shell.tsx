import { cn } from "@/lib/utils";

/**
 * Design system layout shells — see docs/design-system.md §6.
 */

/** Full-width list / desk pages */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("page-pad page-shell animate-in", className)}>
      {children}
    </div>
  );
}

/** Centered focus flows (session logger, wizards) — max-w-3xl */
export function FocusShell({
  children,
  className,
  /** Extra bottom pad for sticky floor actions above bottom nav */
  floorFooter = false,
}: {
  children: React.ReactNode;
  className?: string;
  floorFooter?: boolean;
}) {
  return (
    <div
      className={cn(
        "page-pad page-focus animate-in",
        /* room for sticky bar + optional unsaved strip + safe area */
        floorFooter && "pb-32 md:pb-24",
        className
      )}
    >
      {children}
    </div>
  );
}
