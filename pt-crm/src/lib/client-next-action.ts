import {
  CLIENT_STAGE_LABELS,
  type ClientStage,
} from "@/lib/crm-constants";

export type ClientNextActionKind =
  | "resume_session"
  | "start_session"
  | "open_program"
  | "design_program"
  | "none";

export type ClientNextAction = {
  kind: ClientNextActionKind;
  /** Button / primary label */
  label: string;
  href: string;
  urgency: "high" | "medium" | "low";
  /** Short title for On deck */
  title: string;
  /** Set when kind is start_session — use with StartSessionButton */
  programDayId?: string;
};

/**
 * Resolve ONE primary next action for a client record.
 * Order: live session → start session (if programDayId) → open program → design → none
 */
export function resolveClientNextAction(input: {
  clientId: string;
  liveSession?: { id: string; title: string } | null;
  /** First program day id when we can deep-start */
  programDayId?: string | null;
  programId?: string | null;
  programTitle?: string | null;
}): ClientNextAction {
  const { clientId, liveSession, programDayId, programId, programTitle } =
    input;

  if (liveSession?.id) {
    return {
      kind: "resume_session",
      label: "Resume session",
      href: `/sessions/${liveSession.id}`,
      urgency: "high",
      title: liveSession.title || "In progress",
    };
  }

  if (programId && programDayId) {
    return {
      kind: "start_session",
      label: "Start session",
      href: `/programs/${programId}`,
      urgency: "medium",
      title: programTitle || "Start session",
      programDayId,
    };
  }

  if (programId) {
    return {
      kind: "open_program",
      label: "Open program",
      href: `/programs/${programId}`,
      urgency: "medium",
      title: programTitle || "Open program",
    };
  }

  return {
    kind: "design_program",
    label: "Design program",
    href: `/programs/new?client=${encodeURIComponent(clientId)}`,
    urgency: "low",
    title: "Design program",
  };
}

/** Stage display from clients.status (case-insensitive; labels from CLIENT_STAGE_LABELS). */
export function clientStageLabel(status: string): string {
  const s = (status || "").trim().toLowerCase();
  if (!s) return "Unknown";
  if (s in CLIENT_STAGE_LABELS) {
    return CLIENT_STAGE_LABELS[s as ClientStage];
  }
  return s.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Badge tone for stage — inactive always muted (default). */
export function clientStageTone(
  status: string
): "green" | "amber" | "default" {
  const s = (status || "").trim().toLowerCase();
  if (s === "active") return "green";
  if (s === "lead" || s === "paused") return "amber";
  // inactive / draft / unknown — muted
  return "default";
}
