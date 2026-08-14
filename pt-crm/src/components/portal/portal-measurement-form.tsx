"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addSeekerMeasurementAction } from "@/app/actions/marketplace-seeker";

export function PortalMeasurementForm() {
  const router = useRouter();
  const [measMsg, setMeasMsg] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-zinc-800 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const num = (k: string) => {
          const v = String(fd.get(k) || "").trim();
          return v ? Number(v) : null;
        };
        const result = await addSeekerMeasurementAction({
          heightCm: num("heightCm"),
          weightKg: num("weightKg"),
          waistCm: num("waistCm"),
          notes: String(fd.get("notes") || "") || null,
        });
        setMeasMsg(result.ok ? "Measurement saved." : result.error);
        if (result.ok) {
          form.reset();
          router.refresh();
        }
      }}
    >
      <h2 className="font-medium">Add a measurement</h2>
      <p className="text-xs text-zinc-500">Optional. You control what you log.</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-sm text-zinc-500">
          Weight (kg)
          <input
            name="weightKg"
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
        <label className="text-sm text-zinc-500">
          Waist (cm)
          <input
            name="waistCm"
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
        <label className="text-sm text-zinc-500">
          Height (cm)
          <input
            name="heightCm"
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
      </div>
      <label className="block text-sm text-zinc-500">
        Note (optional)
        <input
          name="notes"
          className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
        />
      </label>
      <button
        type="submit"
        className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm"
      >
        Save measurement
      </button>
      {measMsg ? <p className="text-sm text-zinc-400">{measMsg}</p> : null}
    </form>
  );
}
