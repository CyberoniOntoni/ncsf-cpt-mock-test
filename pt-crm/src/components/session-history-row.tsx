"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "./ui";
import { SessionRemoveButton } from "./session-remove-button";
import { cn } from "@/lib/utils";

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

/**
 * Session history row with remove control (does not navigate when removing).
 */
export function SessionHistoryRow({
  id,
  title,
  subtitle,
  status,
  showStatusBadge = true,
}: {
  id: string;
  title: string;
  subtitle?: React.ReactNode;
  status: string;
  showStatusBadge?: boolean;
}) {
  const tone =
    status === "completed"
      ? "green"
      : status === "cancelled"
        ? "red"
        : status === "in_progress"
          ? "amber"
          : "default";

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-2 py-2 transition",
        "hover:border-zinc-700 hover:bg-zinc-900/50"
      )}
    >
      <Link
        href={`/sessions/${id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-100">
            {title}
          </div>
          {subtitle != null && subtitle !== false && (
            <div className="mt-0.5 truncate text-xs text-zinc-500">
              {subtitle}
            </div>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          {showStatusBadge && (
            <Badge tone={tone as "green" | "red" | "amber" | "default"}>
              {statusLabel(status)}
            </Badge>
          )}
          <ChevronRight className="h-4 w-4 text-zinc-600" aria-hidden />
        </span>
      </Link>
      <SessionRemoveButton
        sessionId={id}
        sessionTitle={title}
        iconOnly
        className="mr-0.5"
      />
    </div>
  );
}
