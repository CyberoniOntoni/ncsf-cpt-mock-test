import { logoutPortalAction } from "@/app/actions/portal/auth";
import { requireClientSession } from "@/lib/client-auth";
import {
  getPortalClient,
  getPortalDocuments,
  getPortalInvoices,
} from "@/db/queries/portal";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui";

export default async function PortalProfilePage() {
  const session = await requireClientSession();
  const [me, invoices, docs] = await Promise.all([
    getPortalClient(session.organizationId, session.clientId),
    getPortalInvoices(session.organizationId, session.clientId),
    getPortalDocuments(session.organizationId, session.clientId),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">
          {me?.firstName} {me?.lastName}
        </h1>
        <p className="text-sm text-zinc-500">{me?.email}</p>
        <p className="text-xs text-zinc-600">{session.organizationName}</p>
      </div>

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
                    {formatMoney(inv.amountCents, inv.currency, { compact: true })}
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

      <form action={logoutPortalAction}>
        <Button type="submit" variant="ghost" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
