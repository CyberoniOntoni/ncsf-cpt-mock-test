"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelSessionAction,
  findInProgressSessionForDayAction,
  startSessionFromProgramDayAction,
} from "@/app/actions/sessions";
import { Button } from "./ui";
import { Play, RotateCcw } from "lucide-react";

export function StartSessionButton({
  programDayId,
  label = "Start session",
}: {
  programDayId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inProgressId, setInProgressId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void findInProgressSessionForDayAction(programDayId)
      .then((s) => setInProgressId(s?.id ?? null))
      .catch(() => setInProgressId(null));
  }, [programDayId]);

  function go(forceNew?: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        if (forceNew && inProgressId) {
          // Avoid orphan in-progress sessions
          try {
            await cancelSessionAction(inProgressId);
          } catch {
            // continue to start new
          }
        }
        const res = await startSessionFromProgramDayAction(programDayId, {
          forceNew,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/sessions/${res.sessionId}`);
        router.refresh();
      } catch (e) {
        // Production often digests throws as React #441 — prefer result.ok path above
        const msg =
          e instanceof Error &&
          e.message &&
          !/digest|Server Components|Minified React|#441/i.test(e.message)
            ? e.message
            : "Could not start session — check the program still exists.";
        setError(msg);
      }
    });
  }

  if (inProgressId) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => router.push(`/sessions/${inProgressId}`)}
            className="min-h-11 font-semibold"
            aria-label="Resume session"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {pending ? "Opening…" : "Resume session"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => go(true)}
            title="Cancel the open log and start fresh"
            className="min-h-9 text-zinc-500"
            aria-label="Start new session"
          >
            {pending ? "…" : "New"}
          </Button>
        </div>
        {error && (
          <span className="text-[11px] text-red-400" role="status">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => go(false)}
        className="min-h-11 font-semibold"
        aria-label={label}
      >
        <Play className="h-3.5 w-3.5" />
        {pending ? "Starting…" : label}
      </Button>
      {error && (
        <span className="text-[11px] text-red-400" role="status">
          {error}
        </span>
      )}
    </div>
  );
}
