"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deactivateClientAction,
  reactivateClientAction,
} from "@/app/actions/clients";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

/**
 * Deactivate / reactivate a client (status → inactive / active).
 * Intended for page header / inactive banner — not the CRM panel stage section.
 * History, packages, and sessions are kept.
 */
export function ClientDeactivateControl({
  clientId,
  clientName,
  status,
  className,
  compact = false,
}: {
  clientId: string;
  /** Used in the deactivate confirm dialog */
  clientName?: string;
  status: string;
  className?: string;
  /** Tighter hit target for dense toolbars (header actions) */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inactive = (status || "").toLowerCase() === "inactive";
  const name = clientName?.trim() || "this client";

  function deactivate() {
    const ok = window.confirm(
      `Deactivate ${name}?\n\nThey leave the active roster and floor picker. History, packages, and sessions stay. You can reactivate anytime.`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await deactivateClientAction(clientId);
        router.refresh();
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : "Could not deactivate client"
        );
      }
    });
  }

  function reactivate() {
    startTransition(async () => {
      try {
        await reactivateClientAction(clientId);
        router.refresh();
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : "Could not reactivate client"
        );
      }
    });
  }

  if (inactive) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={pending}
        disabled={pending}
        onClick={reactivate}
        aria-label={`Reactivate ${name}`}
        className={cn(compact ? "min-h-9" : "min-h-11", className)}
      >
        Reactivate
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      loading={pending}
      disabled={pending}
      onClick={deactivate}
      aria-label={`Deactivate ${name}`}
      className={cn(
        "min-h-9 text-zinc-500 hover:text-zinc-200",
        className
      )}
    >
      Deactivate
    </Button>
  );
}
