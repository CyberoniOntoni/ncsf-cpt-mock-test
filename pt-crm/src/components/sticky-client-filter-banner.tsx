"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getStoredActiveClient,
  subscribeActiveClient,
  type StoredActiveClient,
} from "@/lib/active-client";

/**
 * Desk list pages: sticky client context + optional deep-link filter chips.
 * Server lists respect `?client=` when present (see programs/sessions pages).
 */
export function StickyClientFilterBanner({
  programsHref,
  listPath,
  filterClientId,
}: {
  /** Show “New program” deep link */
  programsHref?: boolean;
  /** Current list base path for “Filter list” e.g. /programs or /sessions */
  listPath?: "/programs" | "/sessions";
  /** Active server-side filter from ?client= */
  filterClientId?: string | null;
}) {
  const [client, setClient] = useState<StoredActiveClient | null>(null);

  useEffect(() => {
    setClient(getStoredActiveClient());
    return subscribeActiveClient(() => setClient(getStoredActiveClient()));
  }, []);

  if (!client?.id) return null;

  const name = client.name?.trim() || "Selected client";
  const filteredHere =
    !!filterClientId && filterClientId === client.id && !!listPath;
  const filterHref = listPath
    ? `${listPath}?client=${encodeURIComponent(client.id)}`
    : null;
  const listNoun =
    listPath === "/sessions"
      ? "sessions"
      : listPath === "/programs"
        ? "programs"
        : "list";

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-100/90"
      role="status"
      aria-label={`Workspace client ${name}${filteredHere ? `, filtered to this ${listNoun} list` : ""}`}
    >
      <span className="shrink-0 font-medium text-emerald-200/90">
        Workspace
      </span>
      <span className="min-w-0 max-w-[12rem] truncate font-medium text-zinc-100 sm:max-w-[16rem]" title={name}>
        {name}
      </span>
      <span className="hidden text-emerald-800 sm:inline" aria-hidden>
        ·
      </span>
      <nav
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
        aria-label="Sticky client actions"
      >
        <Link
          href={`/?client=${encodeURIComponent(client.id)}`}
          className="font-medium text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-sm"
        >
          Today
        </Link>
        <Link
          href={`/clients/${client.id}`}
          className="font-medium text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-sm"
        >
          Profile
        </Link>
        {programsHref && (
          <Link
            href={`/programs/new?client=${encodeURIComponent(client.id)}`}
            className="font-medium text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-sm"
          >
            New program
          </Link>
        )}
        {listPath && filterHref && !filteredHere && (
          <Link
            href={filterHref}
            className="font-medium text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-sm"
            title={`Show only ${listNoun} for ${name}`}
          >
            Filter list
          </Link>
        )}
        {listPath && filteredHere && (
          <Link
            href={listPath}
            className="font-medium text-zinc-400 hover:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-sm"
            title={`Show all ${listNoun}`}
          >
            Show all
          </Link>
        )}
      </nav>
    </div>
  );
}
