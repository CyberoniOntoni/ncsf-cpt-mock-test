import { AreaEyebrow } from "@/components/area-eyebrow";
import { MarketplaceListingForm } from "@/components/marketplace-listing-form";
import { PageShell } from "@/components/page-shell";
import { Card, PageHeader } from "@/components/ui";
import { getMyMarketplaceListingAction } from "@/app/actions/marketplace-trainer";
import { getUserProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TrainerCardPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const paid = (await searchParams).paid;
  const { session, user } = await getUserProfile();
  const canEditCard =
    session.role === "owner" ||
    session.role === "admin" ||
    session.role === "trainer";
  const listing = canEditCard ? await getMyMarketplaceListingAction() : null;

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Trainer card"
        eyebrow={<AreaEyebrow areaId="people" current="Trainer card" />}
        description="What people see on Find a trainer. Intros land next door."
      />
      {paid === "1" ? (
        <p className="text-sm text-emerald-400">
          Featured / fee marked. Refresh if the badge is not updated yet.
        </p>
      ) : null}
      {paid === "0" ? (
        <p className="text-sm text-zinc-400">Checkout canceled.</p>
      ) : null}

      {listing ? (
        <Card>
          <MarketplaceListingForm
            profile={listing.profile}
            gyms={listing.gyms}
            dueIntroCharges={listing.dueIntroCharges}
            defaultCredentials={user?.title || ""}
          />
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-zinc-500">
            Only trainers can publish a Find a trainer card. Account and studio
            stay in Settings.
          </p>
        </Card>
      )}
    </PageShell>
  );
}
