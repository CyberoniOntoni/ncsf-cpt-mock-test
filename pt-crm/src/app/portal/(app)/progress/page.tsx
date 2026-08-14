import { PortalMeasurementForm } from "@/components/portal/portal-measurement-form";
import { requireClientSession, resolvePortalStudio } from "@/lib/client-auth";
import {
  getPortalAssessments,
  getPortalMeasurements,
} from "@/db/queries/portal";
import {
  getSeekerById,
  listSeekerMeasurements,
} from "@/lib/seeker-auth";

type ProgressItem = {
  id: string;
  at: Date;
  source: "you" | "trainer";
  label: string;
};

function measLabel(m: {
  weightKg: number | null;
  waistCm?: number | null;
  heightCm?: number | null;
}): string {
  const parts: string[] = [];
  if (m.weightKg != null) parts.push(`${m.weightKg} kg`);
  if (m.waistCm != null) parts.push(`waist ${m.waistCm} cm`);
  if (m.heightCm != null) parts.push(`ht ${m.heightCm} cm`);
  return parts.join(" · ") || "Logged";
}

export default async function PortalProgressPage() {
  const session = await requireClientSession();
  const studio = await resolvePortalStudio(session);
  const seeker = session.seekerId ? await getSeekerById(session.seekerId) : null;
  const selfMeas = seeker ? await listSeekerMeasurements(seeker.id) : [];

  const trainer =
    studio
      ? await Promise.all([
          getPortalMeasurements(studio.clientId),
          getPortalAssessments(studio.clientId),
        ])
      : [[], []];
  const [meas, assessments] = trainer;

  const items: ProgressItem[] = [
    ...selfMeas.map((m) => ({
      id: m.id,
      at: new Date(m.takenAt),
      source: "you" as const,
      label: measLabel(m),
    })),
    ...meas.map((m) => ({
      id: m.id,
      at: new Date(m.takenAt),
      source: "trainer" as const,
      label: measLabel(m),
    })),
    ...assessments.map((a) => ({
      id: a.id,
      at: new Date(a.takenAt),
      source: "trainer" as const,
      label: a.summary || "Movement check",
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const emptyCopy = !studio
    ? "Nothing logged yet. Add a measurement when you want."
    : "Nothing logged yet. Your trainer’s checks will show up here.";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Progress</h1>
      {session.seekerId ? (
        <PortalMeasurementForm />
      ) : (
        <p className="text-sm text-zinc-500">
          Sign in with a password next time to log your own measurements.
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyCopy}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl border border-zinc-800 px-3 py-2 text-sm"
            >
              <span className="text-zinc-400">
                {item.at.toLocaleDateString()}
              </span>
              <span className="text-zinc-500">
                {item.source === "you" ? "You" : "Trainer"}
              </span>
              <span className="min-w-0 flex-1 text-right tabular-nums text-zinc-200">
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
