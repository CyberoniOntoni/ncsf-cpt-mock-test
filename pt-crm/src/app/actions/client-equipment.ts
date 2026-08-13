"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, getPGlite } from "@/db";
import { clientEquipment } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import {
  DEFAULT_CLIENT_EQUIPMENT_LOCATION,
  resolveAvailableEquipmentIds,
  type FacilityEquipmentMode,
} from "@/lib/client-equipment";
import {
  EQUIPMENT_PRESETS,
  presetAvailability,
} from "@/lib/equipment-presets";
import { listEquipmentCatalogWithOrg } from "@/lib/exercises";
import { assertClientInOrg } from "@/lib/tenant";
import { id } from "@/lib/utils";

export type ClientEquipmentCatalogRow = Awaited<
  ReturnType<typeof listEquipmentCatalogWithOrg>
>[number] & {
  clientAvailable: boolean;
};

export type ClientEquipmentListResult = {
  catalog: ClientEquipmentCatalogRow[];
  configured: boolean;
  locationLabel: string;
};

type MutationResult = {
  ok: boolean;
  success: boolean;
  error?: string;
};

function loc(locationLabel?: string | null) {
  const trimmed = locationLabel?.trim();
  return trimmed || DEFAULT_CLIENT_EQUIPMENT_LOCATION;
}

function ok(): MutationResult {
  return { ok: true, success: true };
}

function fail(error: string): MutationResult {
  return { ok: false, success: false, error };
}

async function loadClientRows(clientId: string, locationLabel: string) {
  const db = await getDb();
  return db
    .select()
    .from(clientEquipment)
    .where(
      and(
        eq(clientEquipment.clientId, clientId),
        eq(clientEquipment.locationLabel, locationLabel)
      )
    );
}

async function upsertClientEquipment(
  clientId: string,
  updates: { equipmentId: string; available: boolean }[],
  locationLabel: string
) {
  const valid = updates.filter((u) => u && u.equipmentId);
  if (!valid.length) return;

  const client = await getPGlite();
  const safe = (s: string) => s.replace(/'/g, "''");

  const exists = await client.query(
    `SELECT id FROM clients WHERE id = '${safe(clientId)}' LIMIT 1`
  );
  if (!exists.rows?.length) {
    throw new Error("Client not found");
  }

  const values = valid
    .map(
      (u) =>
        `('${safe(id("ce"))}', '${safe(clientId)}', '${safe(u.equipmentId)}', ${
          u.available ? "TRUE" : "FALSE"
        }, '${safe(locationLabel)}')`
    )
    .join(", ");

  await client.exec(`
    INSERT INTO client_equipment (id, client_id, equipment_id, available, location_label)
    VALUES ${values}
    ON CONFLICT (client_id, equipment_id, location_label)
    DO UPDATE SET available = EXCLUDED.available
  `);
}

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
}

export async function listClientEquipmentAction(
  clientId: string
): Promise<ClientEquipmentListResult> {
  const empty: ClientEquipmentListResult = {
    catalog: [],
    configured: false,
    locationLabel: DEFAULT_CLIENT_EQUIPMENT_LOCATION,
  };
  try {
    const session = await requireSession();
    if (!clientId) return empty;
    await assertClientInOrg(clientId, session.organizationId);

    const locationLabel = DEFAULT_CLIENT_EQUIPMENT_LOCATION;
    const [catalog, rows] = await Promise.all([
      listEquipmentCatalogWithOrg(session.organizationId),
      loadClientRows(clientId, locationLabel),
    ]);

    const byEq = new Map(rows.map((r) => [r.equipmentId, r]));
    return {
      catalog: catalog.map((c) => ({
        ...c,
        clientAvailable: byEq.get(c.id)?.available === true,
      })),
      configured: rows.length > 0,
      locationLabel,
    };
  } catch (e) {
    console.error("[listClientEquipmentAction]", e);
    return empty;
  }
}

export async function setClientEquipmentAvailableAction(
  clientId: string,
  equipmentId: string,
  available: boolean,
  locationLabel?: string
): Promise<MutationResult> {
  try {
    const session = await requireSession();
    if (!clientId || !equipmentId) {
      return fail("Missing client or equipment id");
    }
    await assertClientInOrg(clientId, session.organizationId);

    const pg = await getPGlite();
    const safe = (s: string) => s.replace(/'/g, "''");
    const eq = await pg.query(
      `SELECT id FROM equipment_items WHERE id = '${safe(equipmentId)}' LIMIT 1`
    );
    if (!eq.rows?.length) {
      return fail("Equipment item not found — refresh and try again.");
    }

    await upsertClientEquipment(
      clientId,
      [{ equipmentId, available }],
      loc(locationLabel)
    );
    revalidateClient(clientId);
    return ok();
  } catch (e) {
    console.error("[setClientEquipmentAvailableAction]", e);
    return fail(
      e instanceof Error ? e.message : "Failed to update client equipment"
    );
  }
}

export async function setClientEquipmentBulkAction(
  clientId: string,
  equipmentIds: string[],
  available: boolean
): Promise<MutationResult> {
  try {
    const session = await requireSession();
    if (!clientId) return fail("Missing client id");
    await assertClientInOrg(clientId, session.organizationId);

    const ids = Array.from(new Set((equipmentIds || []).filter(Boolean)));
    if (!ids.length) return ok();

    await upsertClientEquipment(
      clientId,
      ids.map((equipmentId) => ({ equipmentId, available })),
      DEFAULT_CLIENT_EQUIPMENT_LOCATION
    );
    revalidateClient(clientId);
    return ok();
  } catch (e) {
    console.error("[setClientEquipmentBulkAction]", e);
    return fail(
      e instanceof Error ? e.message : "Failed to update client equipment"
    );
  }
}

export async function applyClientEquipmentPresetAction(
  clientId: string,
  presetId: string
): Promise<MutationResult> {
  try {
    const session = await requireSession();
    if (!clientId || !presetId) return fail("Missing client or preset");
    await assertClientInOrg(clientId, session.organizationId);

    const preset = EQUIPMENT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return fail("Unknown equipment preset");

    const catalog = await listEquipmentCatalogWithOrg(session.organizationId);
    const updates = presetAvailability(preset, catalog);
    await upsertClientEquipment(
      clientId,
      updates,
      DEFAULT_CLIENT_EQUIPMENT_LOCATION
    );
    revalidateClient(clientId);
    return ok();
  } catch (e) {
    console.error("[applyClientEquipmentPresetAction]", e);
    return fail(
      e instanceof Error ? e.message : "Failed to apply equipment preset"
    );
  }
}

export async function resolveFacilityEquipmentIdsAction(
  clientId: string,
  mode: FacilityEquipmentMode
): Promise<string[]> {
  try {
    const session = await requireSession();
    if (!clientId) return [];
    await assertClientInOrg(clientId, session.organizationId);

    const [catalog, rows] = await Promise.all([
      listEquipmentCatalogWithOrg(session.organizationId),
      loadClientRows(clientId, DEFAULT_CLIENT_EQUIPMENT_LOCATION),
    ]);

    const orgIds = catalog.filter((c) => c.available).map((c) => c.id);
    const clientIds = rows.filter((r) => r.available).map((r) => r.equipmentId);
    return resolveAvailableEquipmentIds({ mode, orgIds, clientIds });
  } catch (e) {
    console.error("[resolveFacilityEquipmentIdsAction]", e);
    return [];
  }
}
