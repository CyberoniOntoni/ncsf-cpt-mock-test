import type { ClientProgressData } from "@/app/actions/progress";

/**
 * Plain-text client progress snapshot for WhatsApp / email / notes.
 * Pure — no server, no I/O.
 */
export function buildClientProgressShareText(data: ClientProgressData): string {
  const { clientName, stats, metrics, exerciseBests, assessments } = data;
  const lines: string[] = [
    `${clientName} · progress snapshot`,
    `Sessions (30d): ${stats.sessionsLast30} · Volume (30d): ${fmtKg(stats.volumeLast30Kg)}`,
  ];

  const weight = metrics.find((m) => m.key === "weightKg");
  if (weight?.latest != null) {
    const delta =
      weight.delta != null && weight.delta !== 0
        ? ` (${weight.delta > 0 ? "+" : ""}${fmtNum(weight.delta)} kg)`
        : "";
    lines.push(`Body weight: ${fmtNum(weight.latest)} kg${delta}`);
  }

  const bodyFat = metrics.find((m) => m.key === "bodyFatPct");
  if (bodyFat?.latest != null) {
    lines.push(`Body fat: ${fmtNum(bodyFat.latest)}%`);
  }

  const tops = exerciseBests.slice(0, 5);
  if (tops.length > 0) {
    lines.push("", "Best loads:");
    for (const ex of tops) {
      const reps = ex.bestReps ? ` × ${ex.bestReps}` : "";
      lines.push(`· ${ex.exerciseName}: ${fmtNum(ex.bestWeightKg)} kg${reps}`);
    }
  }

  if (stats.screensWithRetest > 0) {
    lines.push(
      "",
      `Screens: ${stats.screensImproved} improved · ${stats.screensDeclined} declined (${stats.screensWithRetest} with retest)`
    );
  } else if (assessments.length > 0) {
    lines.push("", `Screens logged: ${assessments.length} (baseline)`);
  }

  if (stats.lastSessionAt) {
    try {
      const d = new Date(stats.lastSessionAt);
      if (!Number.isNaN(d.getTime())) {
        lines.push(
          `Last session: ${d.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}`
        );
      }
    } catch {
      /* ignore */
    }
  }

  lines.push("", "— logged in PT CRM");
  return lines.join("\n");
}

function fmtNum(n: number, digits = 1): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(digits);
}

function fmtKg(kg: number): string {
  if (!kg || kg <= 0) return "0 kg";
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}
