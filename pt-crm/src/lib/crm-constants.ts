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

/**
 * Short message templates for between-session touch (clipboard / check-in body).
 * Not a send channel — trainer pastes into WhatsApp/SMS themselves.
 */
export const CHECK_IN_TEMPLATES: { id: string; label: string; body: string }[] =
  [
    {
      id: "recover",
      label: "Recovery",
      body: "Checking in after last session — how are you recovering? Any soreness or flags?",
    },
    {
      id: "reminder",
      label: "Session reminder",
      body: "Friendly reminder: we train soon. Reply if you need to reschedule.",
    },
    {
      id: "pack",
      label: "Pack renew",
      body: "Your session pack is low / empty — want to renew so we can keep the streak?",
    },
    {
      id: "goals",
      label: "Goals",
      body: "Quick check on goals this week — what’s feeling good, and what should we adjust next session?",
    },
    {
      id: "no_show",
      label: "Missed session",
      body: "Missed you today — everything ok? Happy to rebook when you’re free.",
    },
  ];
