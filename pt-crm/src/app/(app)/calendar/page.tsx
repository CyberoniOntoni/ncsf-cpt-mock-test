import type { Metadata } from "next";
import { AreaEyebrow } from "@/components/area-eyebrow";
import { CalendarMonth } from "@/components/calendar-month";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/ui";
import { StickyClientFilterBanner } from "@/components/sticky-client-filter-banner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Month view of FloorScribe appointments.",
};

export default function CalendarPage() {
  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Calendar"
        description="Month grid of bookings. Pick a sticky client, tap a day, then Book."
        eyebrow={<AreaEyebrow areaId="people" current="Calendar" />}
      />
      <StickyClientFilterBanner />
      <CalendarMonth />
    </PageShell>
  );
}
