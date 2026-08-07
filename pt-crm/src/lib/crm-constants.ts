/** Client pipeline stages (clients.status) — shared by CRM actions + UI */
export const CLIENT_STAGES = [
  "lead",
  "active",
  "paused",
  "inactive",
  "draft",
] as const;
export type ClientStage = (typeof CLIENT_STAGES)[number];

/** Display labels for pipeline stages */
export const CLIENT_STAGE_LABELS: Record<ClientStage, string> = {
  lead: "Lead",
  active: "Active",
  paused: "Paused",
  inactive: "Inactive",
  draft: "Draft",
};

/** Stages on the clients list / roster (excludes in-progress intake drafts) */
export const CLIENT_LIST_STAGES = CLIENT_STAGES.filter(
  (s): s is Exclude<ClientStage, "draft"> => s !== "draft"
);

/** Check-in channels for between-session touch log */
export const CHECK_IN_CHANNELS = [
  "message",
  "call",
  "in_person",
  "other",
] as const;
export type CheckInChannel = (typeof CHECK_IN_CHANNELS)[number];
