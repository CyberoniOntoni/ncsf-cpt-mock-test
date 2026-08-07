import Link from "next/link";
import { NAV_AREAS, type NavArea } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Breadcrumb-style area label for desk pages (People / Plans / Studio).
 */
export function AreaEyebrow({
  areaId,
  current,
  className,
}: {
  areaId: NavArea["id"];
  /** Optional current leaf name (not linked) */
  current?: string;
  className?: string;
}) {
  const area = NAV_AREAS.find((a) => a.id === areaId);
  if (!area) return null;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <Link
        href={area.href}
        className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
      >
        {area.label}
      </Link>
      {current ? (
        <>
          <span className="text-zinc-600" aria-hidden>
            /
          </span>
          <span className="normal-case tracking-normal text-zinc-500">
            {current}
          </span>
        </>
      ) : null}
    </span>
  );
}
