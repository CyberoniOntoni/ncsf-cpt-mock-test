"use client";

import { useEffect, useState } from "react";
import { evaluateClientRulesAction } from "@/app/actions/programs";
import { Badge, SectionLabel } from "./ui";

/** Flags from assessments + measurements. Optional trainer dismiss list. */
export function ClientDeficiencySelector({
  clientId,
  goal = "general",
  suppressedSlugs,
  onToggleSuppress,
}: {
  clientId: string;
  goal?: string;
  suppressedSlugs?: string[];
  onToggleSuppress?: (slug: string) => void;
}) {
  const [rows, setRows] = useState<
    Array<{ slug: string; name: string; severity: string; triggerDescription?: string }>
  >([]);
  const [phase, setPhase] = useState<string | null>(null);
  const suppressed = new Set(suppressedSlugs || []);

  useEffect(() => {
    let cancelled = false;
    void evaluateClientRulesAction(clientId, goal)
      .then((res) => {
        if (cancelled) return;
        setRows(res.deficiencies);
        setPhase(res.mesocyclePhase);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, goal]);

  if (!rows.length && !phase) return null;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
      <SectionLabel className="mb-1.5">Movement flags</SectionLabel>
      <p className="mb-2 text-[11px] leading-snug text-zinc-500">
        From latest screens and measurements — Mesocycle 1 uses these for
        corrective warm-ups
        {phase ? ` (${phase.replace(/_/g, " ")})` : ""}.
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500">No active flags — general prep.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {rows.map((d) => {
            const off = suppressed.has(d.slug);
            if (onToggleSuppress) {
              return (
                <button
                  key={d.slug}
                  type="button"
                  aria-pressed={!off}
                  onClick={() => onToggleSuppress(d.slug)}
                  className="min-h-11"
                >
                  <Badge tone={off ? "default" : "amber"}>
                    {off ? "Ignored · " : ""}
                    {d.name} · {d.severity}
                  </Badge>
                </button>
              );
            }
            return (
              <Badge key={d.slug} tone="amber">
                {d.name} · {d.severity}
              </Badge>
            );
          })}
        </div>
      )}
      {onToggleSuppress && rows.length > 0 && (
        <p className="mt-1.5 text-[11px] text-zinc-600">
          Tap a flag to ignore it on this generate (trainer override).
        </p>
      )}
    </div>
  );
}
