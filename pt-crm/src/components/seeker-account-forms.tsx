"use client";

import { useState } from "react";
import {
  addSeekerMeasurementAction,
  saveSeekerPrefsAction,
} from "@/app/actions/marketplace-seeker";
import { TRAINING_AREAS } from "@/lib/marketplace/areas";
import type { SeekerPublic } from "@/lib/seeker-auth";

export function SeekerAccountForms(props: {
  seeker: SeekerPublic;
  gyms: { id: string; name: string; brand: string | null }[];
  brands: string[];
}) {
  const s = props.seeker;
  const [prefMsg, setPrefMsg] = useState<string | null>(null);
  const [measMsg, setMeasMsg] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <form
        className="space-y-3 rounded-xl border border-zinc-800 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const result = await saveSeekerPrefsAction({
            preferredArea: String(fd.get("preferredArea") || ""),
            radiusKm: Number(fd.get("radiusKm") || 15),
            preferredFacilityId: String(fd.get("preferredFacilityId") || ""),
            preferredBrand: String(fd.get("preferredBrand") || ""),
          });
          setPrefMsg(result.ok ? "Saved. Search now uses these filters." : result.error);
        }}
      >
        <h2 className="font-medium">Where you train</h2>
        <label className="block text-sm text-zinc-500">
          Area
          <select
            name="preferredArea"
            defaultValue={s.preferredArea || ""}
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          >
            <option value="">No area</option>
            {TRAINING_AREAS.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.label}, {a.city}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-zinc-500">
          Specific gym
          <select
            name="preferredFacilityId"
            defaultValue={s.preferredFacilityId || ""}
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          >
            <option value="">No specific gym</option>
            {props.gyms.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-zinc-500">
          Gym network
          <select
            name="preferredBrand"
            defaultValue={s.preferredBrand || ""}
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          >
            <option value="">No network</option>
            {props.brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-zinc-500">
          Search radius (km)
          <input
            name="radiusKm"
            type="number"
            min={5}
            max={80}
            defaultValue={s.radiusKm}
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-stone-50"
        >
          Save training spots
        </button>
        {prefMsg ? <p className="text-sm text-zinc-400">{prefMsg}</p> : null}
      </form>

      <form
        className="space-y-3 rounded-xl border border-zinc-800 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
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
          if (result.ok) e.currentTarget.reset();
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
    </div>
  );
}
