"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { User, X } from "lucide-react";
import {
  getStoredActiveClient,
  setStoredActiveClient,
  subscribeActiveClient,
  syncActiveClientUrl,
  type StoredActiveClient,
} from "@/lib/active-client";
import { cn } from "@/lib/utils";

/** Client detail route — name already in page chrome; chip goes icon-only. */
const CLIENT_DETAIL_PATH = /^\/clients\/[^/]+$/;

/**
 * Global sticky client chip — design system Phase 2.
 * Reads localStorage; same-tab updates via ACTIVE_CLIENT_EVENT.
 */
export function StickyClientChip({
  className,
  compact,
}: {
  className?: string;
  /** Smaller for mobile top bar */
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [client, setClient] = useState<StoredActiveClient | null>(null);

  const refresh = useCallback(() => {
    setClient(getStoredActiveClient());
  }, []);

  useEffect(() => {
    refresh();
    return subscribeActiveClient(refresh);
  }, [refresh]);

  if (!client?.id) return null;

  const label = client.name?.trim() || "Client";
  const homeHref = `/?client=${encodeURIComponent(client.id)}`;
  /** On client detail, hide name text so dual-name chrome is reduced. */
  const iconOnly = CLIENT_DETAIL_PATH.test(pathname);

  function clear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setStoredActiveClient(null);
    syncActiveClientUrl(null);
    refresh();
    // Drop server-side ?client= filters on desk lists so clear is trustworthy
    if (
      (pathname === "/programs" || pathname === "/sessions") &&
      typeof window !== "undefined" &&
      window.location.search.includes("client=")
    ) {
      router.replace(pathname);
    }
    router.refresh();
  }

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full items-center gap-0.5 rounded-lg border border-emerald-900/50 bg-emerald-950/35 shadow-sm shadow-black/10",
        compact || iconOnly ? "px-1 py-0.5" : "px-1.5 py-1",
        className
      )}
      role="group"
      aria-label={`Sticky client: ${label}`}
    >
      <Link
        href={homeHref}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-emerald-100/95 transition hover:bg-emerald-900/30 hover:text-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
          compact || iconOnly ? "px-1 py-1 text-[11px]" : "px-1.5 py-1 text-xs",
          iconOnly && "flex-none"
        )}
        title={`Open Today for ${label}`}
        aria-label={`Open Today for ${label}`}
      >
        <User
          className={cn(
            "shrink-0 text-emerald-400",
            compact || iconOnly ? "h-3 w-3" : "h-3.5 w-3.5"
          )}
          aria-hidden
        />
        {!iconOnly && (
          <span className="min-w-0 truncate font-medium" title={label}>
            {label}
          </span>
        )}
      </Link>
      <button
        type="button"
        onClick={clear}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md text-emerald-400/70 transition hover:bg-emerald-900/50 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
          compact || iconOnly ? "h-7 w-7" : "h-8 w-8"
        )}
        aria-label={`Clear sticky client ${label}`}
        title="Clear sticky client"
      >
        <X
          className={compact || iconOnly ? "h-3 w-3" : "h-3.5 w-3.5"}
          aria-hidden
        />
      </button>
    </div>
  );
}
