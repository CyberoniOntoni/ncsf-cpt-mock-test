import Link from "next/link";
import {
  acceptIntroAction,
  declineIntroAction,
  listOrgIntrosAction,
} from "@/app/actions/marketplace-trainer";
import { AreaEyebrow } from "@/components/area-eyebrow";
import { PageShell } from "@/components/page-shell";
import { Card, PageHeader } from "@/components/ui";
import { listPublicGyms } from "@/db/queries/marketplace";

export const dynamic = "force-dynamic";

export default async function IntrosPage() {
  const [intros, gyms] = await Promise.all([
    listOrgIntrosAction(),
    listPublicGyms(),
  ]);
  const gymName = new Map(gyms.map((g) => [g.id, g.name]));
  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Intros"
        eyebrow={<AreaEyebrow areaId="people" current="Intros" />}
        description="Marketplace requests. Accepting creates a CRM lead."
      />
      {intros.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">
            No intro requests yet. Publish your trainer card in{" "}
            <Link href="/settings" className="text-emerald-400">
              Settings
            </Link>{" "}
            — clients send intros from /find.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {intros.map((row) => (
            <li key={row.id}>
              <Card className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-medium">{row.seekerName}</h2>
                  <span className="text-xs uppercase text-zinc-500">
                    {row.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">{row.seekerEmail}</p>
                <p className="text-xs text-zinc-500">
                  {row.createdAt
                    ? new Date(row.createdAt).toLocaleString()
                    : ""}
                  {row.seekerPhone ? ` · ${row.seekerPhone}` : ""}
                  {row.facilityId && gymName.get(row.facilityId)
                    ? ` · ${gymName.get(row.facilityId)}`
                    : ""}
                </p>
                {row.message ? (
                  <p className="text-sm">{row.message}</p>
                ) : null}
                {row.status === "pending" ? (
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await acceptIntroAction(row.id);
                      }}
                    >
                      <button className="min-h-11 rounded-lg bg-emerald-800 px-3 text-sm font-semibold text-stone-50">
                        Accept
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await declineIntroAction(row.id);
                      }}
                    >
                      <button className="min-h-11 rounded-lg border border-zinc-700 px-3 text-sm">
                        Decline
                      </button>
                    </form>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
