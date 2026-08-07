import Link from "next/link";
import { listEquipmentAction, listExercisesAction } from "@/app/actions/library";
import { AreaEyebrow } from "@/components/area-eyebrow";
import { LibraryEquipment } from "@/components/library-equipment";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const [equipment, exercises] = await Promise.all([
    listEquipmentAction(),
    listExercisesAction(),
  ]);

  const exerciseCountByEqId = new Map<string, number>();
  for (const ex of exercises) {
    for (const eqId of ex.equipmentIds || []) {
      exerciseCountByEqId.set(eqId, (exerciseCountByEqId.get(eqId) || 0) + 1);
    }
  }

  const rows = equipment.map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    category: e.category,
    description: e.description ?? null,
    available: e.available,
    exerciseCount: exerciseCountByEqId.get(e.id) || 0,
  }));

  const exerciseReqs = exercises.map((e) => ({
    equipmentIds: e.equipmentIds || [],
    equipmentAny: e.equipmentAny,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Equipment inventory"
        eyebrow={<AreaEyebrow areaId="studio" current="Equipment" />}
        description="Toggle what is on the floor. Coach and program design only suggest exercises that match this inventory. Bodyweight is always available."
        actions={
          <Link
            href="/library"
            className="text-sm font-medium text-emerald-400 hover:underline"
          >
            ← Exercise library
          </Link>
        }
      />
      <LibraryEquipment initial={rows} exerciseReqs={exerciseReqs} />
    </PageShell>
  );
}
