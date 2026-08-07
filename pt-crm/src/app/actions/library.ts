"use server";

import { revalidatePath } from "next/cache";
import { getPGlite } from "@/db";
import { requireSession } from "@/lib/auth";
import {
  listEquipmentCatalogWithOrg,
  listExercisesForOrg,
} from "@/lib/exercises";
import { id } from "@/lib/utils";

export async function listEquipmentAction() {
  const session = await requireSession();
  return listEquipmentCatalogWithOrg(session.organizationId);
}

/** Upsert — avoids unique-constraint errors when a row already exists. */
async function upsertOrgEquipment(
  organizationId: string,
  equipmentId: string,
  available: boolean
) {
  const client = await getPGlite();
  const safe = (s: string) => s.replace(/'/g, "''");
  const rowId = id("oe");

  // Guard FKs with clear errors (stale session / stale page after DB reset)
  const org = await client.query(
    `SELECT id FROM organizations WHERE id = '${safe(organizationId)}' LIMIT 1`
  );
  if (!org.rows?.length) {
    throw new Error("Organization not found — please sign out and sign in again.");
  }
  const eq = await client.query(
    `SELECT id FROM equipment_items WHERE id = '${safe(equipmentId)}' LIMIT 1`
  );
  if (!eq.rows?.length) {
    throw new Error("Equipment item not found — refresh the Library page.");
  }

  await client.exec(`
    INSERT INTO org_equipment (id, organization_id, equipment_id, available, notes)
    VALUES ('${safe(rowId)}', '${safe(organizationId)}', '${safe(equipmentId)}', ${available ? "TRUE" : "FALSE"}, NULL)
    ON CONFLICT (organization_id, equipment_id)
    DO UPDATE SET available = EXCLUDED.available
  `);
}

export async function setEquipmentAvailableAction(
  equipmentId: string,
  available: boolean
) {
  const session = await requireSession();
  if (!equipmentId) throw new Error("Missing equipment id");
  await upsertOrgEquipment(session.organizationId, equipmentId, available);
  revalidatePath("/library");
  revalidatePath("/library/equipment");
  return { ok: true };
}

export async function setAllEquipmentAction(available: boolean) {
  const session = await requireSession();
  const rows = await listEquipmentCatalogWithOrg(session.organizationId);

  for (const r of rows) {
    await upsertOrgEquipment(session.organizationId, r.id, available);
  }

  revalidatePath("/library");
  revalidatePath("/library/equipment");
  return { ok: true };
}

/** Bulk set availability (presets, multi-toggle). */
export async function setEquipmentBulkAction(
  updates: { equipmentId: string; available: boolean }[]
) {
  const session = await requireSession();
  if (!Array.isArray(updates) || !updates.length) {
    throw new Error("No equipment updates");
  }
  for (const u of updates) {
    if (!u.equipmentId) continue;
    await upsertOrgEquipment(session.organizationId, u.equipmentId, !!u.available);
  }
  revalidatePath("/library");
  revalidatePath("/library/equipment");
  return { ok: true };
}

export async function listExercisesAction(opts?: {
  availableOnly?: boolean;
  q?: string;
}) {
  const session = await requireSession();
  let rows = await listExercisesForOrg(session.organizationId);
  if (opts?.availableOnly) {
    rows = rows.filter((e) => e.available);
  }
  if (opts?.q?.trim()) {
    const tokens = opts.q
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    rows = rows.filter((e) => {
      const hay = [
        e.name,
        e.tags,
        e.primaryMuscles,
        e.secondaryMuscles || "",
        e.movementPattern,
        e.cues || "",
        e.description || "",
        ...(e.equipmentNames || []),
      ]
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }
  return rows;
}
