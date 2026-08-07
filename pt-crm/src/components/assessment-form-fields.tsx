"use client";

import type { AssessmentFieldDef } from "@/lib/assessments";
import { Input, Label } from "./ui";

/** Shared field renderer for intake + re-test forms */
export function AssessmentFormFields({
  fields,
  values,
  onChange,
}: {
  fields: AssessmentFieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      {fields.map((f) => {
        const help = f.help;
        const isNotes = f.type === "text" && /note/i.test(f.key);
        return (
          <div key={f.key}>
            <Label>
              {f.label}
              {f.side === "left" && (
                <span className="ml-1.5 font-normal normal-case tracking-normal text-zinc-600">
                  (L)
                </span>
              )}
              {f.side === "right" && (
                <span className="ml-1.5 font-normal normal-case tracking-normal text-zinc-600">
                  (R)
                </span>
              )}
            </Label>
            {f.type === "pass_fail" || f.type === "select" ? (
              <select
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                value={values[f.key] || ""}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                <option value="">— Select —</option>
                {f.type === "pass_fail" ? (
                  <>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail / limited</option>
                  </>
                ) : (
                  (f.options || []).map((o) => (
                    <option key={o} value={o}>
                      {formatOption(o)}
                    </option>
                  ))
                )}
              </select>
            ) : f.type === "number" ? (
              <Input
                type="number"
                step="any"
                inputMode="decimal"
                value={values[f.key] || ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder="0"
              />
            ) : isNotes ? (
              <Input
                value={values[f.key] || ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder="Optional — pain, cues, environment"
              />
            ) : (
              <Input
                value={values[f.key] || ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder="Optional"
              />
            )}
            {help && (
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                {help}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatOption(o: string) {
  return o
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AssessmentHowTo({
  description,
  purpose,
  instructions,
  defaultOpen = false,
}: {
  description?: string | null;
  purpose?: string | null;
  instructions?: string | null;
  defaultOpen?: boolean;
}) {
  if (!description && !purpose && !instructions) return null;

  return (
    <details
      className="group rounded-lg border border-zinc-800 bg-zinc-950/50 open:border-emerald-900/40"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-emerald-400/90 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-zinc-500 group-open:hidden">▸</span>
          <span className="hidden text-zinc-500 group-open:inline">▾</span>
          How to run this screen
        </span>
        {description && (
          <span className="mt-0.5 block font-normal normal-case tracking-normal text-zinc-500">
            {description}
          </span>
        )}
      </summary>
      <div className="space-y-3 border-t border-zinc-800 px-3 py-3 text-xs leading-relaxed text-zinc-400">
        {purpose && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Why it matters
            </div>
            <p className="whitespace-pre-wrap text-zinc-300">{purpose}</p>
          </div>
        )}
        {instructions && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              How to run
            </div>
            <p className="whitespace-pre-wrap text-zinc-300">{instructions}</p>
          </div>
        )}
        <p className="text-[11px] text-zinc-600">
          Coaching screen only — not a medical diagnosis. Stop if sharp pain or
          red-flag symptoms appear.
        </p>
      </div>
    </details>
  );
}
