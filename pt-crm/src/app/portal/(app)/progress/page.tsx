import { requireClientSession } from "@/lib/client-auth";
import {
  getPortalAssessments,
  getPortalMeasurements,
} from "@/db/queries/portal";

export default async function PortalProgressPage() {
  const session = await requireClientSession();
  const [meas, assessments] = await Promise.all([
    getPortalMeasurements(session.clientId),
    getPortalAssessments(session.clientId),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Progress</h1>
      <section>
        <h2 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Body metrics
        </h2>
        {meas.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No measurements yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {meas.map((m) => (
              <li
                key={m.id}
                className="flex justify-between rounded-xl border border-zinc-800 px-3 py-2 text-sm"
              >
                <span className="text-zinc-400">
                  {new Date(m.takenAt).toLocaleDateString()}
                </span>
                <span className="tabular-nums text-zinc-200">
                  {m.weightKg != null ? `${m.weightKg} kg` : "—"}
                  {m.waistCm != null ? ` · waist ${m.waistCm}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Movement checks
        </h2>
        {assessments.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No movement checks logged yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {assessments.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-zinc-800 px-3 py-2 text-sm"
              >
                <p className="text-zinc-400">
                  {new Date(a.takenAt).toLocaleDateString()}
                </p>
                <p className="text-zinc-200">{a.summary || "Screen logged"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
