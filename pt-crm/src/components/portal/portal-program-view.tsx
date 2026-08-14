"use client";

import { useEffect, useState } from "react";
import {
  cachePortalProgram,
  readCachedPortalProgram,
} from "@/components/portal/program-cache";
import type { PortalClientProgram } from "@/lib/portal-program";

const PHASE_LABEL = {
  warmup: "Warm-up",
  work: "Work",
  cooldown: "Cool-down",
} as const;

export function PortalProgramView({
  data,
}: {
  data: PortalClientProgram | null;
}) {
  const [program, setProgram] = useState<PortalClientProgram | null>(data);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (data) {
      cachePortalProgram(data);
      setProgram(data);
      setStale(false);
      return;
    }
    const cached = readCachedPortalProgram<PortalClientProgram>();
    if (cached) {
      setProgram(cached);
      setStale(true);
    }
  }, [data]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{program?.title || "Program"}</h1>
        <p className="text-sm text-zinc-500">
          {program
            ? `${program.daysPerWeek} days · ${program.sessionMinutes} min · ${program.goal.replace(/_/g, " ")}`
            : "Your program appears here after a trainer assigns an active plan."}
        </p>
        {stale ? (
          <p className="mt-1 text-[11px] text-amber-200/80">
            Showing the last plan saved on this phone.
          </p>
        ) : null}
      </div>
      {program
        ? program.days.map((day) => (
            <section
              key={day.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3"
            >
              <h2 className="font-medium text-zinc-100">{day.name}</h2>
              {day.focus ? (
                <p className="text-xs text-zinc-500">{day.focus}</p>
              ) : null}
              <div className="mt-3 space-y-3">
                {day.blocks.map((block, i) => {
                  const prev = day.blocks[i - 1];
                  const showPhase = !prev || prev.phase !== block.phase;
                  return (
                    <div key={block.key}>
                      {showPhase ? (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          {PHASE_LABEL[block.phase]}
                        </p>
                      ) : null}
                      <div
                        className={
                          block.groupLabel
                            ? "rounded-xl border border-emerald-900/60 px-2.5 py-2"
                            : ""
                        }
                      >
                        {block.groupLabel ? (
                          <p className="mb-1 text-xs font-medium text-emerald-300">
                            {block.groupLabel}
                          </p>
                        ) : null}
                        <ol className="space-y-2">
                          {block.items.map((ex, n) => (
                            <li key={ex.id} className="text-sm">
                              <span className="tabular-nums text-zinc-500">
                                {n + 1}.
                              </span>{" "}
                              <span className="font-medium text-zinc-200">
                                {ex.name}
                              </span>
                              <span className="ml-2 text-xs tabular-nums text-zinc-500">
                                {ex.prescription}
                                {ex.schemeLabel ? ` · ${ex.schemeLabel}` : ""}
                                {ex.restLabel ? ` · ${ex.restLabel}` : ""}
                              </span>
                              {ex.cue ? (
                                <p className="pl-5 text-[11px] leading-snug text-zinc-500">
                                  {ex.cue}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        : null}
    </div>
  );
}
