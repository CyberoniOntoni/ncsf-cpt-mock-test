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
  try {
    const session = await requireSession();
    return await listEquipmentCatalogWithOrg(session.organizationId);
  } catch (e) {
    console.error("[listEquipmentAction]", e);
    return [];
  }
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
  try {
    const session = await requireSession();
    if (!equipmentId) {
      return { ok: false, success: false, error: "Missing equipment id" };
    }
    await upsertOrgEquipment(session.organizationId, equipmentId, available);
    revalidatePath("/library");
    revalidatePath("/library/equipment");
    return { ok: true, success: true };
  } catch (e) {
    console.error("[setEquipmentAvailableAction]", e);
    return {
      ok: false,
      success: false,
      error: e instanceof Error ? e.message : "Failed to update equipment",
    };
  }
}

export async function setAllEquipmentAction(available: boolean) {
  try {
    const session = await requireSession();
    const rows = await listEquipmentCatalogWithOrg(session.organizationId);
    if (!rows.length) {
      return { ok: true, success: true };
    }

    const client = await getPGlite();
    const safe = (s: string) => s.replace(/'/g, "''");

    const org = await client.query(
      `SELECT id FROM organizations WHERE id = '${safe(session.organizationId)}' LIMIT 1`
    );
    if (!org.rows?.length) {
      throw new Error("Organization not found — please sign out and sign in again.");
    }

    const values = rows
      .map(
        (r) =>
          `('${safe(id("oe"))}', '${safe(session.organizationId)}', '${safe(r.id)}', ${
            available ? "TRUE" : "FALSE"
          }, NULL)`
      )
      .join(", ");

    await client.exec(`
      INSERT INTO org_equipment (id, organization_id, equipment_id, available, notes)
      VALUES ${values}
      ON CONFLICT (organization_id, equipment_id)
      DO UPDATE SET available = EXCLUDED.available
    `);

    revalidatePath("/library");
    revalidatePath("/library/equipment");
    return { ok: true, success: true };
  } catch (e) {
    console.error("[setAllEquipmentAction]", e);
    return {
      ok: false,
      success: false,
      error: e instanceof Error ? e.message : "Failed to update all equipment",
    };
  }
}

/** Bulk set availability (presets, multi-toggle). */
export async function setEquipmentBulkAction(
  updates: { equipmentId: string; available: boolean }[]
) {
  try {
    const session = await requireSession();
    if (!Array.isArray(updates) || !updates.length) {
      return { ok: false, success: false, error: "No equipment updates" };
    }

    const valid = updates.filter((u) => u && u.equipmentId);
    if (!valid.length) {
      return { ok: true, success: true };
    }

    const client = await getPGlite();
    const safe = (s: string) => s.replace(/'/g, "''");

    const org = await client.query(
      `SELECT id FROM organizations WHERE id = '${safe(session.organizationId)}' LIMIT 1`
    );
    if (!org.rows?.length) {
      throw new Error("Organization not found — please sign out and sign in again.");
    }

    const values = valid
      .map(
        (u) =>
          `('${safe(id("oe"))}', '${safe(session.organizationId)}', '${safe(u.equipmentId)}', ${
            u.available ? "TRUE" : "FALSE"
          }, NULL)`
      )
      .join(", ");

    await client.exec(`
      INSERT INTO org_equipment (id, organization_id, equipment_id, available, notes)
      VALUES ${values}
      ON CONFLICT (organization_id, equipment_id)
      DO UPDATE SET available = EXCLUDED.available
    `);

    revalidatePath("/library");
    revalidatePath("/library/equipment");
    return { ok: true, success: true };
  } catch (e) {
    console.error("[setEquipmentBulkAction]", e);
    return {
      ok: false,
      success: false,
      error: e instanceof Error ? e.message : "Failed to update equipment bulk",
    };
  }
}

export async function listExercisesAction(opts?: {
  availableOnly?: boolean;
  q?: string;
}) {
  try {
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
  } catch (e) {
    console.error("[listExercisesAction]", e);
    return [];
  }
}
