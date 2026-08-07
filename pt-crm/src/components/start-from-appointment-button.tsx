"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, RotateCcw } from "lucide-react";
import { startSessionFromAppointmentAction } from "@/app/actions/sessions";
import { setStoredActiveClient } from "@/lib/active-client";
import { Button } from "./ui";

/**
 * Floor entry from a booking — starts/resumes linked session on active program day 1.
 */
export function StartFromAppointmentButton({
  appointmentId,
  clientId,
  clientName,
  hasLinkedSession,
  size = "sm",
  className,
}: {
  appointmentId: string;
  clientId: string;
  clientName?: string | null;
  /** When booking already points at a session (may be in progress) */
  hasLinkedSession?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      try {
        setStoredActiveClient(clientId, clientName ?? null);
        const res = await startSessionFromAppointmentAction(appointmentId);
        router.push(`/sessions/${res.sessionId}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start session");
      }
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <Button
        type="button"
        size={size}
        disabled={pending}
        onClick={go}
        className={className ?? "min-h-11 font-semibold"}
        aria-busy={pending}
        aria-label={
          hasLinkedSession
            ? "Resume or open session from booking"
            : "Start session from booking"
        }
      >
        {hasLinkedSession ? (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Play className="h-3.5 w-3.5" aria-hidden />
        )}
        {pending
          ? "Opening…"
          : hasLinkedSession
            ? "Resume session"
            : "Start session"}
      </Button>
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="max-w-[16rem] text-[11px] leading-snug text-red-300/90"
        >
          {error}
        </p>
      )}
    </div>
  );
}
