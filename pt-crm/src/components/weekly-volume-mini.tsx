import type { WeekVolume } from "@/lib/progress";
import { cn } from "@/lib/utils";

function fmtVolume(kg: number): string {
  if (kg <= 0) return "—";
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

/**
 * Title-row volume whisper — sits next to the client name.
 * No card chrome (avoids competing with h1 / CTAs). Bars + one number only.
 */
export function WeeklyVolumeMini({
  weeks,
  className,
}: {
  weeks: WeekVolume[];
  className?: string;
}) {
  const series =
    weeks.length > 0
      ? weeks
      : Array.from({ length: 8 }, (_, i) => ({
          weekStart: `empty-${i}`,
          label: "—",
          volumeKg: 0,
          sessions: 0,
        }));

  const values = series.map((w) => w.volumeKg);
  const max = Math.max(0, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const hasData = total > 0;

  // Empty bars add noise next to the client title — hide until real volume exists
  if (!hasData) return null;

  const last = weeks.length ? weeks[weeks.length - 1] : null;
  const activeWeeks = values.filter((v) => v > 0).length;

  // Prefer this week; else average of weeks that had work
  const displayKg =
    last && last.volumeKg > 0
      ? last.volumeKg
      : activeWeeks > 0
        ? total / activeWeeks
        : 0;
  const displayHint =
    last && last.volumeKg > 0
      ? "this week"
      : activeWeeks > 0
        ? "avg / wk"
        : null;

  const tip = weeks
    .map((w) =>
      w.volumeKg > 0
        ? `${w.label}: ${fmtVolume(w.volumeKg)} · ${w.sessions} sess.`
        : `${w.label}: —`
    )
    .join("\n");

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 sm:gap-2.5",
        // Optical align with 2xl title without looking like a control
        "text-zinc-500",
        className
      )}
      title={tip}
      role="img"
      aria-label={`Training volume: ${fmtVolume(displayKg)} ${displayHint ?? ""}. ${activeWeeks}-week trend of ${weeks.length || 8}.`}
    >
      {/* Soft divider from name on wider screens */}
      <span
        className="hidden h-5 w-px shrink-0 bg-zinc-800 sm:block"
        aria-hidden
      />

      {/* Spark bars — zinc base, latest week emerald accent */}
      <div className="flex h-[1.125rem] items-end gap-px sm:h-5 sm:gap-0.5" aria-hidden>
        {values.map((v, i) => {
          const isLatest = i === values.length - 1;
          const h =
            max > 0
              ? Math.max(v > 0 ? 3 : 2, Math.round((v / max) * 18))
              : 2;
          return (
            <div
              key={series[i]?.weekStart ?? i}
              className={cn(
                "w-1 rounded-[1px] sm:w-1.5",
                v <= 0
                  ? "bg-zinc-800/90"
                  : isLatest
                    ? "bg-zinc-400/90"
                    : "bg-zinc-600"
              )}
              style={{ height: h }}
            />
          );
        })}
      </div>

      <div className="min-w-0 leading-none">
        <div className="flex items-baseline gap-1 tabular-nums">
          <span className="text-xs font-medium tracking-tight text-zinc-500">
            {fmtVolume(displayKg)}
          </span>
          {displayHint && (
            <span className="text-[10px] font-normal text-zinc-600">
              {displayHint}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
