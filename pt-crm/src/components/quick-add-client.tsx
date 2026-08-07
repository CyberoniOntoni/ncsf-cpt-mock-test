"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quickAddClientAction } from "@/app/actions/clients";
import { Button, Input, Label } from "./ui";

export type QuickAddResult = {
  clientId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  status: string;
  goals: string | null;
};

export function QuickAddClient({
  onCreated,
  compact = false,
  defaultOpen = false,
}: {
  /** Called after create; if omitted, navigates to client profile */
  onCreated?: (client: QuickAddResult) => void;
  compact?: boolean;
  /** Start expanded (parent controls visibility) */
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const created = await quickAddClientAction({
          firstName,
          lastName: lastName || undefined,
          phone: phone || undefined,
        });
        reset();
        setOpen(false);
        router.refresh();
        if (onCreated) {
          onCreated(created);
        } else {
          router.push(`/clients/${created.clientId}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add client");
      }
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant={compact ? "secondary" : "secondary"}
        className={compact ? "text-xs" : undefined}
        onClick={() => setOpen(true)}
      >
        Quick add
      </Button>
    );
  }

  return (
    <div
      className={
        compact
          ? "w-full space-y-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3"
          : "space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/80 p-4"
      }
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Quick add client
      </div>
      <p className="text-xs text-zinc-500">
        Name + phone only. Full intake can continue later from the profile.
      </p>
      <div className={compact ? "grid gap-2" : "grid gap-2 sm:grid-cols-3"}>
        <div>
          <Label>First name *</Label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <div>
          <Label>Last name</Label>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Doe"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+65 …"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={submit}
          disabled={pending || !firstName.trim()}
        >
          {pending ? "Saving…" : "Add client"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
