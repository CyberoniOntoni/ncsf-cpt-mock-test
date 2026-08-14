import Link from "next/link";
import { requireClientSession, resolvePortalStudio } from "@/lib/client-auth";
import {
  getPortalClient,
  getPortalInvoices,
  getPortalNextAppointment,
  getPortalNotifications,
} from "@/db/queries/portal";
import { getSeekerById, isSeekerProfileComplete } from "@/lib/seeker-auth";
import { formatMoney } from "@/lib/money";

export default async function PortalDashboardPage() {
  const session = await requireClientSession();
  const studio = await resolvePortalStudio(session);
  const seeker = session.seekerId ? await getSeekerById(session.seekerId) : null;
  const readyToSearch = seeker ? isSeekerProfileComplete(seeker) : false;

  if (!studio) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">
            Hi {seeker?.firstName || session.firstName}
          </h1>
          <p className="text-sm text-zinc-500">
            Your client home. Find a trainer, then your plan shows up here.
          </p>
        </div>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Find a trainer
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {readyToSearch
              ? "Your profile is ready. Search by area or gym and send an intro."
              : "Tell us where you train on your profile, then you can search."}
          </p>
          <Link
            href={readyToSearch ? "/portal/find" : "/portal/profile?setup=1"}
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-stone-50"
          >
            {readyToSearch ? "Search trainers" : "Complete profile"}
          </Link>
        </section>
      </div>
    );
  }

  const [me, next, invoices, notes] = await Promise.all([
    getPortalClient(studio.organizationId, studio.clientId),
    getPortalNextAppointment(studio.organizationId, studio.clientId),
    getPortalInvoices(studio.organizationId, studio.clientId),
    getPortalNotifications(studio.organizationId, studio.clientId),
  ]);

  const unpaid = invoices.filter(
    (i) => i.effectiveStatus === "unpaid" || i.effectiveStatus === "overdue"
  );
  const dueCents = unpaid.reduce((s, i) => s + i.amountCents, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">
          Hi {me?.firstName || session.firstName}
        </h1>
        <p className="text-sm text-zinc-500">
          Your plan with {studio.organizationName}
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Next session
        </p>
        {next ? (
          <>
            <p className="mt-1 text-lg font-medium text-zinc-100">{next.title}</p>
            <p className="text-sm text-zinc-400">
              {new Date(next.startsAt).toLocaleString()}
              {next.location ? ` · ${next.location}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-400">Nothing booked yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Balance
        </p>
        <p className="mt-1 text-lg font-medium tabular-nums">
          {formatMoney(dueCents, unpaid[0]?.currency || "SGD", { compact: true })}
        </p>
        <p className="text-xs text-zinc-500">
          {unpaid.length
            ? `${unpaid.length} open invoice${unpaid.length === 1 ? "" : "s"}`
            : "Nothing due"}
        </p>
        {unpaid.length > 0 && (
          <Link
            href="/portal/profile"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-emerald-400"
          >
            Billing →
          </Link>
        )}
      </section>

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Updates
        </p>
        {notes.length === 0 ? (
          <p className="text-sm text-zinc-500">No notifications yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-zinc-800/80 px-3 py-2.5"
              >
                <p className="text-sm font-medium text-zinc-200">{n.title}</p>
                {n.body && (
                  <p className="mt-0.5 text-xs text-zinc-500">{n.body}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
