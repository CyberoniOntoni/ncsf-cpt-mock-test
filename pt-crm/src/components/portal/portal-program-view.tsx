"use client";

import { useEffect, useState } from "react";
import {
  cachePortalProgram,
  readCachedPortalProgram,
} from "@/components/portal/program-cache";

export type PortalProgramPayload = {
  title: string;
  goal: string;
  daysPerWeek: number;
  sessionMinutes: number;
  days: Array<{
    id: string;
    name: string;
    focus: string | null;
    exercises: Array<{
      id: string;
      exerciseName: string;
      sets: number;
      reps: string;
      rpe: string | null;
      notes: string | null;
    }>;
  }>;
};

export function PortalProgramView({
  data,
}: {
  data: PortalProgramPayload | null;
}) {
  const [program, setProgram] = useState<PortalProgramPayload | null>(data);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (data) {
      cachePortalProgram(data);
      setProgram(data);
      setStale(false);
      return;
    }
    const cached = readCachedPortalProgram<PortalProgramPayload>();
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
            : "Your trainer has not assigned an active plan yet."}
        </p>
        {stale && (
          <p className="mt-1 text-[11px] text-amber-200/80">
            Showing the last plan saved on this phone (gym wifi may be down).
          </p>
        )}
      </div>
      {program && (
        <div className="space-y-3">
          {program.days.map((day) => (
            <section
              key={day.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3"
            >
              <h2 className="font-medium text-zinc-100">{day.name}</h2>
              {day.focus && (
                <p className="text-xs text-zinc-500">{day.focus}</p>
              )}
              <ol className="mt-2 space-y-2">
                {day.exercises.map((ex, i) => (
                  <li key={ex.id} className="text-sm">
                    <span className="tabular-nums text-zinc-500">{i + 1}.</span>{" "}
                    <span className="font-medium text-zinc-200">
                      {ex.exerciseName}
                    </span>
                    <span className="ml-2 text-xs tabular-nums text-zinc-500">
                      {ex.sets} × {ex.reps}
                      {ex.rpe ? ` @ ${ex.rpe}` : ""}
                    </span>
                    {ex.notes && (
                      <p className="pl-5 text-[11px] leading-snug text-zinc-600">
                        {ex.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
