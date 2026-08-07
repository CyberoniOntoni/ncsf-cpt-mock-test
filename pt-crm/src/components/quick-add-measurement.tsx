"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addClientMeasurementFormAction,
  type MeasurementFormState,
} from "@/app/actions/clients";
import { METRIC_GIRTH_FIELDS } from "@/lib/measurements";

export type MeasurementPrefill = {
  heightCm?: number | null;
};

const inputClass =
  "w-full min-h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm tabular-nums text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

const labelClass =
  "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400";

function Field({
  id,
  name,
  label,
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        step="0.1"
        inputMode="decimal"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={inputClass}
      />
    </div>
  );
}

/**
 * Expand/collapse uses native <details>.
 * Save uses a server form action via useActionState.
 */
export function QuickAddMeasurement({
  clientId,
  prefill = null,
}: {
  clientId: string;
  prefill?: MeasurementPrefill | null;
}) {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [flash, setFlash] = useState(false);
  const [state, formAction, pending] = useActionState<
    MeasurementFormState,
    FormData
  >(addClientMeasurementFormAction, null);

  useEffect(() => {
    if (state?.ok) {
      if (detailsRef.current) detailsRef.current.open = false;
      formRef.current?.reset();
      setFlash(true);
      router.refresh();
    }
  }, [state?.ok, state?.savedAt, router]);

  // Transient success — visible, then clears
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 2800);
    return () => clearTimeout(t);
  }, [flash]);

  const heightDefault =
    prefill?.heightCm != null && !Number.isNaN(Number(prefill.heightCm))
      ? String(prefill.heightCm)
      : "";

  const torsoExtras = METRIC_GIRTH_FIELDS.filter((f) => f.group === "torso");
  const armFields = METRIC_GIRTH_FIELDS.filter((f) => f.group === "arms");
  const legFields = METRIC_GIRTH_FIELDS.filter((f) => f.group === "legs");

  return (
    <div className="space-y-2">
      {flash && (
        <p
          role="status"
          className="rounded-lg border border-emerald-900/50 bg-emerald-950/35 px-3 py-2 text-xs font-medium text-emerald-300"
        >
          Measurement saved
        </p>
      )}

      <details
        ref={detailsRef}
        className="group rounded-xl border border-zinc-800 bg-zinc-950/40 open:border-zinc-700 open:bg-zinc-900/40"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-100 marker:content-none [&::-webkit-details-marker]:hidden">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-emerald-400 group-open:border-zinc-600 group-open:text-zinc-400"
            aria-hidden
          >
            <span className="group-open:hidden">+</span>
            <span className="hidden group-open:inline">▾</span>
          </span>
          <span className="group-open:hidden">Add measurement</span>
          <span className="hidden text-zinc-300 group-open:inline">
            New measurement
          </span>
          <span className="ml-auto hidden text-xs font-normal text-zinc-500 group-open:inline">
            Tap to close
          </span>
        </summary>

        <form
          ref={formRef}
          action={formAction}
          className="space-y-3 border-t border-zinc-800 px-3 py-3"
        >
          <input type="hidden" name="clientId" value={clientId} />

          {state?.error && (
            <p
              role="alert"
              className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2.5 text-sm text-red-200"
            >
              {state.error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <Field
              id="qm-weight"
              name="weightKg"
              label="Weight (kg)"
              placeholder="e.g. 78.5"
            />
            <Field
              id="qm-bf"
              name="bodyFatPct"
              label="Body fat %"
              placeholder="optional"
            />
          </div>

          {/* Core torso — always visible when expanded */}
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 p-2.5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Torso
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Field
                id="qm-height"
                name="heightCm"
                label="Height (cm)"
                defaultValue={heightDefault}
                placeholder="optional"
              />
              <Field id="qm-chest" name="chestCm" label="Chest (cm)" />
              <Field id="qm-waist" name="waistCm" label="Waist (cm)" />
              <Field id="qm-hips" name="hipsCm" label="Hips (cm)" />
              {torsoExtras.map((f) => (
                <Field
                  key={f.key}
                  id={`qm-${f.key}`}
                  name={f.key}
                  label={`${f.label} (${f.unit})`}
                />
              ))}
            </div>
          </div>

          {/* Optional girths — quieter nested wells */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
              Optional girths
            </p>

            <details className="rounded-lg border border-zinc-800/50 bg-zinc-950/40">
              <summary className="flex min-h-10 cursor-pointer list-none items-center px-2.5 py-2 text-xs text-zinc-500 marker:content-none hover:text-zinc-400 [&::-webkit-details-marker]:hidden">
                <span className="mr-1.5 text-zinc-600">+</span>
                Arms — biceps, forearm, wrist
              </summary>
              <div className="grid grid-cols-2 gap-2.5 border-t border-zinc-800/60 px-2.5 py-2.5 sm:grid-cols-3">
                {armFields.map((f) => (
                  <Field
                    key={f.key}
                    id={`qm-${f.key}`}
                    name={f.key}
                    label={`${f.label} (${f.unit})`}
                  />
                ))}
              </div>
            </details>

            <details className="rounded-lg border border-zinc-800/50 bg-zinc-950/40">
              <summary className="flex min-h-10 cursor-pointer list-none items-center px-2.5 py-2 text-xs text-zinc-500 marker:content-none hover:text-zinc-400 [&::-webkit-details-marker]:hidden">
                <span className="mr-1.5 text-zinc-600">+</span>
                Legs — thigh, calf, ankle
              </summary>
              <div className="grid grid-cols-2 gap-2.5 border-t border-zinc-800/60 px-2.5 py-2.5 sm:grid-cols-3">
                {legFields.map((f) => (
                  <Field
                    key={f.key}
                    id={`qm-${f.key}`}
                    name={f.key}
                    label={`${f.label} (${f.unit})`}
                  />
                ))}
              </div>
            </details>
          </div>

          <div>
            <label htmlFor="qm-notes" className={labelClass}>
              Notes
            </label>
            <input
              id="qm-notes"
              name="notes"
              type="text"
              placeholder="Scale, flexed vs relaxed, time of day…"
              className="w-full min-h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-emerald-950/40 hover:bg-emerald-500 disabled:opacity-45"
            >
              {pending ? "Saving…" : "Save measurement"}
            </button>
          </div>
          <p className="text-[11px] text-zinc-600">
            Fill only what you measured — empty fields are skipped.
          </p>
        </form>
      </details>
    </div>
  );
}
