import Link from "next/link";
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

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Progress</h1>
      <section>
        <h2 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Your measurements
        </h2>
        {session.seekerId ? (
          <div className="mt-2">
            <PortalMeasurementForm />
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Sign in with a password next time to log your own measurements.
          </p>
        )}
        {selfMeas.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Nothing logged yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {selfMeas.map((m) => (
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
          With your trainer
        </h2>
        {!studio ? (
          <p className="mt-2 text-sm text-zinc-500">
            Trainer logs show up after you are accepted.{" "}
            <Link href="/portal/find" className="text-emerald-400">
              Find a trainer
            </Link>
          </p>
        ) : meas.length === 0 && assessments.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Your trainer has not logged progress yet.
          </p>
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
