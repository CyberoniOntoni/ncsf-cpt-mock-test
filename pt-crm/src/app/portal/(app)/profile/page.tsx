import Link from "next/link";
import { logoutPortalAction } from "@/app/actions/portal/auth";
import { SeekerAccountForms } from "@/components/seeker-account-forms";
import { Button } from "@/components/ui";
import {
  listPublicBrands,
  listPublicGyms,
} from "@/db/queries/marketplace";
import {
  getPortalClient,
  getPortalDocuments,
  getPortalInvoices,
} from "@/db/queries/portal";
import { requireClientSession, resolvePortalStudio } from "@/lib/client-auth";
import { formatMoney } from "@/lib/money";
import {
  getSeekerById,
  isSeekerProfileComplete,
  listSeekerMeasurements,
} from "@/lib/seeker-auth";

export default async function PortalProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const session = await requireClientSession();
  const studio = await resolvePortalStudio(session);
  const seeker = session.seekerId ? await getSeekerById(session.seekerId) : null;
  const sp = await searchParams;
  const setup = Boolean(
    seeker && (sp.setup === "1" || !isSeekerProfileComplete(seeker))
  );
  const gyms = await listPublicGyms();
  const brands = listPublicBrands(gyms);
  const selfMeas = seeker ? await listSeekerMeasurements(seeker.id) : [];

  const [me, invoices, docs] = studio
    ? await Promise.all([
        getPortalClient(studio.organizationId, studio.clientId),
        getPortalInvoices(studio.organizationId, studio.clientId),
        getPortalDocuments(studio.organizationId, studio.clientId),
      ])
    : [null, [], []];

  const displayName = seeker
    ? `${seeker.firstName} ${seeker.lastName}`.trim()
    : `${me?.firstName || session.firstName} ${me?.lastName || session.lastName}`.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{displayName}</h1>
        <p className="text-sm text-zinc-500">{session.email}</p>
        {studio ? (
          <p className="text-xs text-zinc-600">{studio.organizationName}</p>
        ) : null}
        {setup ? (
          <p className="mt-3 text-sm text-zinc-300">
            Tell us where you train. After you save, you stay on your profile —
            then you can search for a trainer.
          </p>
        ) : (
          <p className="mt-3">
            <Link
              href="/portal/find"
              className="inline-flex min-h-11 items-center rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-stone-50"
            >
              Find a trainer
            </Link>
          </p>
        )}
      </div>

      {seeker ? (
        <SeekerAccountForms seeker={seeker} gyms={gyms} brands={brands} setup={setup} />
      ) : (
        <p className="text-sm text-zinc-500">
          Sign in with a password next time to save gym prefs and measurements.
        </p>
      )}

      <section>
        <h2 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Your measurements
        </h2>
        {selfMeas.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nothing logged yet.</p>
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
                <span className="tabular-nums">
                  {m.weightKg != null ? `${m.weightKg} kg` : "—"}
                  {m.waistCm != null ? ` · waist ${m.waistCm} cm` : ""}
                  {m.heightCm != null ? ` · ht ${m.heightCm} cm` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {studio ? (
        <>
          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Billing
            </h2>
            {invoices.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No invoices yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="rounded-xl border border-zinc-800 px-3 py-2.5 text-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-zinc-200">{inv.title}</span>
                      <span className="tabular-nums">
                        {formatMoney(inv.amountCents, inv.currency, {
                          compact: true,
                        })}
                      </span>
                    </div>
                    <p className="text-xs capitalize text-zinc-500">
                      {inv.effectiveStatus}
                    </p>
                    {inv.paymentUrl && inv.effectiveStatus !== "paid" && (
                      <a
                        href={inv.paymentUrl}
                        className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-emerald-400"
                      >
                        Pay now
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Signed documents
            </h2>
            {docs.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No documents yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                {docs.map((d) => (
                  <li key={d.id}>
                    {d.title} · {d.status}
                    {d.signedAt
                      ? ` · ${new Date(d.signedAt).toLocaleDateString()}`
                      : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <form action={logoutPortalAction}>
        <Button type="submit" variant="ghost" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
