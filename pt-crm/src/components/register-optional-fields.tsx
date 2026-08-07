"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input, Label, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Phone, credentials, units, timezone — collapsed by default. */
export function RegisterOptionalFields() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Optional · phone, credentials, units</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-zinc-800/80 px-3 pb-3 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+65 …"
                className="mt-0.5 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="title">Credentials</Label>
              <Input
                id="title"
                name="title"
                type="text"
                placeholder="NCSF-CPT"
                className="mt-0.5 min-h-11"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="unitSystem">Units</Label>
              <Select
                id="unitSystem"
                name="unitSystem"
                defaultValue="metric"
                className="mt-0.5"
              >
                <option value="metric">Metric (kg)</option>
                <option value="imperial">Imperial (lb)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                name="timezone"
                type="text"
                defaultValue="Asia/Singapore"
                placeholder="Asia/Singapore"
                className="mt-0.5 min-h-11"
              />
            </div>
          </div>
        </div>
      )}
      {/* Defaults when collapsed so form still posts values */}
      {!open && (
        <>
          <input type="hidden" name="unitSystem" value="metric" />
          <input type="hidden" name="timezone" value="Asia/Singapore" />
        </>
      )}
    </div>
  );
}
