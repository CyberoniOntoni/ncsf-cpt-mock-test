/**
 * Resolve which catalog equipment IDs are in play for program / coach filters.
 * Client home lists are independent of org floor gear.
 */

export type FacilityEquipmentMode = "org" | "client" | "combined";

export const DEFAULT_CLIENT_EQUIPMENT_LOCATION = "home_gym";

export const FACILITY_EQUIPMENT_MODE_LABELS: Record<
  FacilityEquipmentMode,
  string
> = {
  org: "Floor",
  client: "Home",
  combined: "Combined",
};

export const FACILITY_EQUIPMENT_MODES: {
  id: FacilityEquipmentMode;
  label: string;
  description: string;
}[] = [
  {
    id: "org",
    label: FACILITY_EQUIPMENT_MODE_LABELS.org,
    description: "Studio floor gear from Library",
  },
  {
    id: "client",
    label: FACILITY_EQUIPMENT_MODE_LABELS.client,
    description: "This client's home / travel gear",
  },
  {
    id: "combined",
    label: FACILITY_EQUIPMENT_MODE_LABELS.combined,
    description: "Only gear on both the floor and this home list",
  },
];

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

/**
 * org — floor catalog only.
 * client — home list; empty list falls back to org so an unset home gym
 *   does not wipe the exercise pool.
 * combined — intersection; empty home list treated as org (not configured yet).
 */
export function resolveAvailableEquipmentIds(opts: {
  mode: FacilityEquipmentMode;
  orgIds: string[];
  clientIds: string[];
}): string[] {
  const orgIds = uniqueIds(opts.orgIds);
  const clientIds = uniqueIds(opts.clientIds);

  if (opts.mode === "client") {
    return clientIds.length ? clientIds : orgIds;
  }

  if (opts.mode === "combined") {
    if (!clientIds.length) return orgIds;
    const clientSet = new Set(clientIds);
    return orgIds.filter((id) => clientSet.has(id));
  }

  return orgIds;
}
