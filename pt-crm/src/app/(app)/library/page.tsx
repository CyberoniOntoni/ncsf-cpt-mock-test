import Link from "next/link";
import { listEquipmentAction, listExercisesAction } from "@/app/actions/library";
import { LibraryExercises } from "@/components/library-exercises";
import { PageShell } from "@/components/page-shell";
import { AreaEyebrow } from "@/components/area-eyebrow";
import { Badge, Button, Card, PageHeader, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const [equipment, exercises] = await Promise.all([
    listEquipmentAction(),
    listExercisesAction(),
  ]);
  const availableEq = equipment.filter((e) => e.available).length;
  const availableEx = exercises.filter((e) => e.available).length;
  const patterns = new Set(exercises.map((e) => e.movementPattern));
  const patternsOpen = new Set(
    exercises.filter((e) => e.available).map((e) => e.movementPattern)
  );

  return (
    <PageShell>
      <PageHeader
        title="Exercise library"
        eyebrow={<AreaEyebrow areaId="studio" current="Library" />}
        description="Global exercise bank with coaching cues — filtered by your studio inventory for program design and the coach."
        actions={
          <Link href="/library/equipment">
            <Button variant="secondary" size="sm">
              Manage equipment
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Card>
          <SectionLabel>Equipment on</SectionLabel>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {availableEq}
            <span className="text-base font-normal text-zinc-500">
              /{equipment.length}
            </span>
          </div>
        </Card>
        <Card>
          <SectionLabel>Exercises usable</SectionLabel>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {availableEx}
            <span className="text-base font-normal text-zinc-500">
              /{exercises.length}
            </span>
          </div>
        </Card>
        <Card>
          <SectionLabel>Patterns open</SectionLabel>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {patternsOpen.size}
            <span className="text-base font-normal text-zinc-500">
              /{patterns.size}
            </span>
          </div>
        </Card>
        <Card>
          <SectionLabel>Coach filtering</SectionLabel>
          <div className="mt-2">
            <Badge tone="green">On</Badge>
            <p className="mt-1 text-xs text-zinc-500">
              Suggestions respect inventory toggles
            </p>
          </div>
        </Card>
      </div>

      <LibraryExercises initial={exercises} />
    </PageShell>
  );
}
