"use client";

import { useEffect, useState, useTransition } from "react";
import { createClientCheckInAction } from "@/app/actions/crm";
import {
  CHECK_IN_CHANNELS,
  type CheckInChannel,
} from "@/lib/crm-constants";
import { cn } from "@/lib/utils";
import { CheckInTemplates } from "./check-in-templates";
import { Button, Textarea } from "./ui";

const CHANNEL_LABEL: Record<CheckInChannel, string> = {
  message: "Message",
  call: "Call",
  in_person: "In person",
  other: "Other",
};

/**
 * Compact check-in logger for the Home floor launch card.
 * Collapsed text control; expands to channel chips + note + save.
 */
export function HomeQuickCheckIn({
  clientId,
  clientName,
  onSaved,
}: {
  clientId: string;
  clientName?: string;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<CheckInChannel>("message");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  function cancel() {
    setOpen(false);
    setBody("");
    setChannel("message");
    setError(null);
  }

  function save() {
    const note = body.trim();
    if (!note) {
      setError("Note is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createClientCheckInAction({
          clientId,
          body: note,
          channel,
        });
        setBody("");
        setChannel("message");
        setOpen(false);
        setFlash(true);
        onSaved?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save check-in");
      }
    });
  }

  const who = clientName?.trim();
  const formAria = who ? `Log check-in for ${who}` : "Log check-in";

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        {flash && (
          <span
            role="status"
            className="text-[11px] font-medium text-emerald-400"
          >
            Saved
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setFlash(false);
            setError(null);
          }}
          aria-expanded={false}
          aria-controls="home-quick-checkin-form"
          className="inline-flex min-h-11 items-center font-medium text-zinc-400 hover:text-emerald-400 hover:underline"
        >
          Log check-in
        </button>
      </span>
    );
  }

  return (
    <form
      id="home-quick-checkin-form"
      className="basis-full w-full space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5"
      aria-label={formAria}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Channel"
      >
        {CHECK_IN_CHANNELS.map((c) => {
          const active = channel === c;
          return (
            <button
              key={c}
              type="button"
              disabled={pending}
              onClick={() => setChannel(c)}
              aria-pressed={active}
              className={cn(
                "min-h-8 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                active
                  ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-200"
                  : "border-zinc-800 bg-zinc-950/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
              )}
            >
              {CHANNEL_LABEL[c]}
            </button>
          );
        })}
      </div>

      <CheckInTemplates
        disabled={pending}
        onPick={(text) => {
          setBody(text);
          setChannel("message");
          setError(null);
        }}
      />

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Quick note from a touchpoint…"
        disabled={pending}
        rows={2}
        className="min-h-[56px] text-xs"
        aria-label="Check-in note"
        autoFocus
      />

      {error && (
        <p role="alert" className="text-[11px] text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          loading={pending}
          disabled={pending || !body.trim()}
          className="min-h-11 px-4"
        >
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={cancel}
          className="min-h-11 text-zinc-500"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
