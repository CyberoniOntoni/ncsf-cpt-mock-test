"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateOrganizationAction } from "@/app/actions/auth";
import { Alert, Button, Input, Label } from "@/components/ui";

export function SettingsOrgForm({
  initial,
  canEdit,
}: {
  initial: {
    name: string;
    unitSystem: string;
    timezone: string;
  };
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null
  );
  const [name, setName] = useState(initial.name);
  const [unitSystem, setUnitSystem] = useState(
    initial.unitSystem === "imperial" ? "imperial" : "metric"
  );
  const [timezone, setTimezone] = useState(initial.timezone || "UTC");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMsg(null);
    startTransition(async () => {
      const res = await updateOrganizationAction({
        name,
        unitSystem,
        timezone,
      });
      if ("error" in res && res.error) {
        setMsg({ tone: "err", text: res.error });
        return;
      }
      setMsg({ tone: "ok", text: "Studio settings saved" });
    });
  }

  if (!canEdit) {
    return (
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-zinc-500">Name</dt>
          <dd className="text-zinc-200">{initial.name}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Units</dt>
          <dd className="text-zinc-200">{initial.unitSystem}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Timezone</dt>
          <dd className="text-zinc-200">{initial.timezone}</dd>
        </div>
        <p className="text-xs text-zinc-600">
          Only studio owners can edit organization settings.
        </p>
      </dl>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {msg && (
        <Alert tone={msg.tone === "ok" ? "success" : "error"}>{msg.text}</Alert>
      )}
      <div>
        <Label htmlFor="org-name">Studio name</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={pending}
          className="mt-0.5"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="org-units">Units</Label>
          <select
            id="org-units"
            value={unitSystem}
            onChange={(e) =>
              setUnitSystem(e.target.value === "imperial" ? "imperial" : "metric")
            }
            disabled={pending}
            className="mt-0.5 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          >
            <option value="metric">Metric (kg)</option>
            <option value="imperial">Imperial (lb)</option>
          </select>
        </div>
        <div>
          <Label htmlFor="org-tz">Timezone</Label>
          <Input
            id="org-tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={pending}
            placeholder="Asia/Singapore"
            className="mt-0.5"
          />
        </div>
      </div>
      <Button type="submit" size="sm" loading={pending} className="min-h-11">
        Save studio
      </Button>
    </form>
  );
}
