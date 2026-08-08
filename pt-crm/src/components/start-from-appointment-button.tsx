"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Play, RotateCcw } from "lucide-react";
import { startSessionFromAppointmentAction } from "@/app/actions/sessions";
import { setStoredActiveClient } from "@/lib/active-client";
import { Button } from "./ui";

/**
 * Floor entry from a booking — starts/resumes linked session on active program day.
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
  const [programHint, setProgramHint] = useState(false);
  const [openLogOnly, setOpenLogOnly] = useState(false);

  function go() {
    setError(null);
    setProgramHint(false);
    startTransition(async () => {
      try {
        setStoredActiveClient(clientId, clientName ?? null);
        const res = await startSessionFromAppointmentAction(appointmentId);
        if (!res.ok) {
          setError(res.error);
          setProgramHint(
            res.code === "no_program" || /program/i.test(res.error)
          );
          return;
        }
        if (res.alreadyCompleted) {
          setOpenLogOnly(true);
        }
        router.push(`/sessions/${res.sessionId}`);
        router.refresh();
      } catch (e) {
        const msg =
          e instanceof Error &&
          e.message &&
          !/digest|Server Components|Minified React|#441/i.test(e.message)
            ? e.message
            : "Could not start session from booking.";
        setError(msg);
        setProgramHint(/program/i.test(msg));
      }
    });
  }

  const label = openLogOnly
    ? "Open log"
    : hasLinkedSession
      ? "Resume session"
      : "Start session";

  return (
    <div className="flex flex-col items-stretch gap-1">
      <Button
        type="button"
        size={size}
        variant={
          openLogOnly || hasLinkedSession ? "secondary" : "primary"
        }
        disabled={pending}
        onClick={go}
        className={className ?? "min-h-11 gap-1.5 font-semibold"}
        aria-busy={pending}
        aria-label={
          openLogOnly
            ? "Open completed session log"
            : hasLinkedSession
              ? "Resume or open session from booking"
              : "Start floor session from this booking"
        }
      >
        {openLogOnly ? (
          <FileText className="h-3.5 w-3.5" aria-hidden />
        ) : hasLinkedSession ? (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Play className="h-3.5 w-3.5" aria-hidden />
        )}
        {pending ? "Opening…" : label}
      </Button>
      {error && (
        <div className="max-w-[16rem] space-y-1">
          <p
            role="alert"
            aria-live="assertive"
            className="text-[11px] leading-snug text-red-300/90"
          >
            {error}
          </p>
          {programHint && (
            <Link
              href={`/programs/new?client=${clientId}`}
              className="inline-flex min-h-9 items-center text-[11px] font-medium text-emerald-400 hover:underline"
            >
              Design program →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
