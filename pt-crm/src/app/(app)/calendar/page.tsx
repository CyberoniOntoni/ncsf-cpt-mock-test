import type { Metadata } from "next";
import { AreaEyebrow } from "@/components/area-eyebrow";
import { CalendarMonth } from "@/components/calendar-month";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/ui";
import { StickyClientFilterBanner } from "@/components/sticky-client-filter-banner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "Month calendar of bookings — pick a day, book a client, start the floor session.",
};

export default function CalendarPage() {
  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Calendar"
        description="Pick a day, choose a client, set time and session type — book without leaving the calendar."
        eyebrow={<AreaEyebrow areaId="people" current="Calendar" />}
      />
      <StickyClientFilterBanner />
      <CalendarMonth />
    </PageShell>
  );
}
