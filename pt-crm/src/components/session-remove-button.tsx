"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteSessionAction } from "@/app/actions/sessions";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

/**
 * Permanently delete a session (history cleanup).
 * Confirms first; restores one pack credit when the session was completed.
 */
export function SessionRemoveButton({
  sessionId,
  sessionTitle,
  variant = "ghost",
  size = "sm",
  className,
  /** Where to go after delete (default: stay / refresh list) */
  redirectTo,
  label = "Remove",
  iconOnly = false,
}: {
  sessionId: string;
  sessionTitle?: string;
  variant?: "ghost" | "secondary" | "danger";
  size?: "sm" | "md";
  className?: string;
  redirectTo?: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onRemove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const name = sessionTitle?.trim() || "this session";
    const ok = window.confirm(
      `Remove “${name}” permanently?\n\nSet logs are deleted. If this was a completed session, one pack credit may be restored.`
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        await deleteSessionAction(sessionId);
        if (redirectTo) {
          router.push(redirectTo);
        }
        router.refresh();
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Could not remove session"
        );
      }
    });
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={onRemove}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition",
          "hover:bg-red-950/40 hover:text-red-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40",
          "disabled:opacity-45",
          className
        )}
        aria-label={`Remove session${sessionTitle ? ` ${sessionTitle}` : ""}`}
        title="Remove session"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      loading={pending}
      disabled={pending}
      onClick={onRemove}
      className={cn(
        variant === "ghost" && "text-zinc-500 hover:text-red-300",
        className
      )}
      aria-label={`Remove session${sessionTitle ? ` ${sessionTitle}` : ""}`}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Button>
  );
}
