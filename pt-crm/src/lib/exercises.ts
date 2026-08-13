import { and, asc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { equipmentItems, exercises, orgEquipment } from "@/db/schema";

export type ExerciseWithAvailability = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  movementPattern: string;
  primaryMuscles: string;
  secondaryMuscles: string;
  difficulty: string;
  tags: string;
  cues: string | null;
  equipmentIds: string[];
  equipmentAny: boolean;
  equipmentNames: string[];
  /** true if org has all required equipment (or bodyweight) */
  available: boolean;
  missingEquipment: string[];
};

export async function getAvailableEquipmentIds(organizationId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(orgEquipment)
    .where(
      and(eq(orgEquipment.organizationId, organizationId), eq(orgEquipment.available, true))
    );
  return new Set(rows.map((r) => r.equipmentId));
}

export async function listEquipmentCatalogWithOrg(organizationId: string) {
  const db = await getDb();
  const catalog = await db
    .select()
    .from(equipmentItems)
    .orderBy(asc(equipmentItems.sortOrder));

  const orgRows = await db
    .select()
    .from(orgEquipment)
    .where(eq(orgEquipment.organizationId, organizationId));
  const byEq = new Map(orgRows.map((r) => [r.equipmentId, r]));

  return catalog
    .filter((c) => c.slug !== "bodyweight")
    .map((c) => {
      const oe = byEq.get(c.id);
      return {
        ...c,
        // Default true when no org row yet (matches seed defaults for most gear)
        available: oe ? oe.available : true,
        orgEquipmentId: oe?.id ?? null,
        notes: oe?.notes ?? null,
      };
    });
}

function isExerciseAvailable(
  equipmentIds: string[],
  equipmentAny: boolean,
  availableIds: Set<string>
): { available: boolean; missing: string[] } {
  if (!equipmentIds.length) return { available: true, missing: [] };
  if (equipmentAny) {
    const anyOk = equipmentIds.some((id) => availableIds.has(id));
    return {
      available: anyOk,
      missing: anyOk ? [] : equipmentIds,
    };
  }
  const missing = equipmentIds.filter((id) => !availableIds.has(id));
  return { available: missing.length === 0, missing };
}

export async function listExercisesForOrg(
  organizationId: string,
  opts?: { equipmentIds?: string[] }
): Promise<ExerciseWithAvailability[]> {
  const db = await getDb();
  const availableIds =
    opts?.equipmentIds && opts.equipmentIds.length > 0
      ? new Set(opts.equipmentIds)
      : await getAvailableEquipmentIds(organizationId);
  const catalog = await db.select().from(equipmentItems);
  const nameById = new Map(catalog.map((c) => [c.id, c.name]));

  const rows = await db
    .select()
    .from(exercises)
    .where(
      and(
        eq(exercises.active, true),
        or(isNull(exercises.organizationId), eq(exercises.organizationId, organizationId))
      )
    )
    .orderBy(asc(exercises.sortOrder), asc(exercises.name));

  return rows.map((ex) => {
    const eqIds = ex.equipmentIds ?? [];
    const { available, missing } = isExerciseAvailable(eqIds, ex.equipmentAny, availableIds);
    return {
      id: ex.id,
      slug: ex.slug,
      name: ex.name,
      description: ex.description,
      movementPattern: ex.movementPattern,
      primaryMuscles: ex.primaryMuscles,
      secondaryMuscles: ex.secondaryMuscles,
      difficulty: ex.difficulty,
      tags: ex.tags,
      cues: ex.cues,
      equipmentIds: eqIds,
      equipmentAny: ex.equipmentAny,
      equipmentNames: eqIds.map((id) => nameById.get(id) || id),
      available,
      missingEquipment: missing.map((id) => nameById.get(id) || id),
    };
  });
}

/** Score exercises for a free-text coach query / playbook tags */
export function scoreExerciseForQuery(
  ex: ExerciseWithAvailability,
  query: string,
  playbookTags: string[] = []
): number {
  const hay = [
    ex.name,
    ex.tags,
    ex.primaryMuscles,
    ex.secondaryMuscles || "",
    ex.movementPattern,
    ex.cues || "",
    ex.description || "",
  ]
    .join(" ")
    .toLowerCase();
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += 1;
  }
  for (const tag of playbookTags) {
    for (const part of tag.toLowerCase().split(/[,\s]+/).filter(Boolean)) {
      if (part.length > 2 && hay.includes(part)) score += 2;
    }
  }
  // Boost mobility when shoulder / scratch language present
  if (/scratch|shoulder|apley|mobility/i.test(query) && /mobility|shoulder|scapula|tspine/.test(hay)) {
    score += 3;
  }
  if (/program|workout|training|hypertrophy|strength|fat.?loss/i.test(query)) {
    if (["squat", "hinge", "horizontal_push", "horizontal_pull", "vertical_pull", "vertical_push"].includes(ex.movementPattern)) {
      score += 1;
    }
  }
  if (ex.available) score += 0.5;
  return score;
}

export async function suggestExercisesForCoach(
  organizationId: string,
  query: string,
  playbookTags: string[] = [],
  limit = 8
): Promise<ExerciseWithAvailability[]> {
  const all = await listExercisesForOrg(organizationId);
  const available = all.filter((e) => e.available);
  const scored = available
    .map((ex) => ({ ex, score: scoreExerciseForQuery(ex, query, playbookTags) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length >= 3) {
    return scored.slice(0, limit).map((x) => x.ex);
  }

  // Fallback: pattern diversity from available bank
  const patterns = ["mobility", "horizontal_pull", "horizontal_push", "squat", "hinge", "core"];
  const picks: ExerciseWithAvailability[] = scored.map((x) => x.ex);
  const have = new Set(picks.map((p) => p.id));
  for (const p of patterns) {
    if (picks.length >= limit) break;
    const hit = available.find((e) => e.movementPattern === p && !have.has(e.id));
    if (hit) {
      picks.push(hit);
      have.add(hit.id);
    }
  }
  return picks.slice(0, limit);
}
