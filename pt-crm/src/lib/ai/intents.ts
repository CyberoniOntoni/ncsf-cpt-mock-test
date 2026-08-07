import type { ProgramGoal } from "@/lib/program-builder";
import type { CrmAction } from "./schemas";

export type CoachIntent =
  | {
      kind: "create_program";
      goal?: ProgramGoal;
      daysPerWeek?: number;
      sessionMinutes?: number;
    }
  | { kind: "log_session" }
  | { kind: "retest_assessment"; screenHint?: string }
  | { kind: "open_program" }
  | { kind: "open_sessions" }
  | { kind: "open_equipment" }
  | { kind: "client_brief" }
  | { kind: "next_session" }
  | { kind: "progression" }
  | { kind: "insert_correctives" }
  | { kind: "apply_mesocycle"; week?: number }
  | { kind: "advance_mesocycle" }
  | {
      kind: "append_exercise";
      exerciseQuery?: string;
      dayHint?: number; // 1-based day index if parsed
      isWarmup?: boolean;
    }
  | { kind: "general" };

/** Detect high-value CRM intents from natural language. */
export function detectIntent(message: string): CoachIntent {
  const m = message.toLowerCase();

  // Mutate existing program (before generic "create program")
  if (
    /(insert|add|apply).{0,20}corrective/i.test(m) ||
    /corrective(s)?\s+(into|to|on)\s+(the\s+)?program/i.test(m) ||
    /warm-?up correctives/i.test(m)
  ) {
    return { kind: "insert_correctives" };
  }

  // Append single exercise to a program day (after correctives so they win).
  // Require program/day/plan anchor (or quoted exercise + day) so bare
  // "add exercise variety" does not fire.
  if (
    /(add|append|include|put)\b.{0,40}\b(to|on|into)\b.{0,20}\b(program|plan|day|workout)/i.test(
      m
    ) ||
    /\badd\s+[a-z0-9][a-z0-9\s\-]{1,40}\s+to\s+(day|the program|program)/i.test(
      m
    ) ||
    (/\b(add|append)\b/i.test(m) &&
      /["“].+?["”]/.test(m) &&
      /\b(day\s*[1-6a-d]?|program|plan)\b/i.test(m))
  ) {
    const dayM = m.match(/\bday\s*([1-6a-d])\b/i);
    let dayHint: number | undefined;
    if (dayM) {
      const d = dayM[1].toLowerCase();
      if (/^[1-6]$/.test(d)) dayHint = Number(d);
      else dayHint = "abcd".indexOf(d) + 1 || undefined;
    }
    let exerciseQuery: string | undefined;
    const quoted = m.match(/["“](.+?)["”]/);
    if (quoted) exerciseQuery = quoted[1].trim();
    else {
      const stripped = m
        .replace(/\b(add|append|include|put)\b/gi, " ")
        .replace(
          /\b(to|on|into)\b.{0,20}\b(the\s+)?(program|plan|day\s*[1-6a-d]?|workout)\b.*/i,
          " "
        )
        .replace(/\b(exercise|movement|drill|as\s+warmup|warmup)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (stripped.length >= 2) exerciseQuery = stripped;
    }
    const isWarmup = /warm-?up|as\s+warmup/i.test(m);
    return { kind: "append_exercise", exerciseQuery, dayHint, isWarmup };
  }

  if (
    /(advance|next).{0,16}(meso|mesocycle|training week|block week)/i.test(m) ||
    /mesocycle\s+(advance|next)/i.test(m) ||
    /next\s+meso(cycle)?\s*week/i.test(m)
  ) {
    return { kind: "advance_mesocycle" };
  }

  if (
    /deload\s+(this\s+)?(program|week|block|plan)/i.test(m) ||
    /(apply|set).{0,12}(meso|mesocycle|deload)/i.test(m) ||
    /mesocycle\s*(week\s*)?(w?\s*[1-6]|1|2|3|4|5|6)/i.test(m)
  ) {
    const weekMatch = m.match(/\b(?:w|week\s*)([1-6])\b/i) || m.match(/\b([1-6])\s*(?:week)?\b/);
    let week: number | undefined;
    if (/deload/i.test(m) && !weekMatch) week = 4;
    else if (weekMatch) week = Number(weekMatch[1]);
    return { kind: "apply_mesocycle", week };
  }

  // Program design (keep early — overlaps with "plan")
  // Prefer create/design verbs so "what program" still hits open_program.
  const programHints =
    /(create|design|build|write|make|generate|set up|setup).{0,24}(program|plan|routine|split|workout plan)/i.test(
      m
    ) ||
    /(program|training plan|workout plan).{0,20}(for|for this|for the client|for my client)/i.test(
      m
    ) ||
    /\b(3|2|4|5|6)\s*[- ]?\s*day\b.{0,20}(program|plan|split|full body)/i.test(m);

  if (programHints) {
    return {
      kind: "create_program",
      goal: parseGoal(m),
      daysPerWeek: parseDays(m),
      sessionMinutes: parseMinutes(m),
    };
  }

  // Log / start session
  if (
    /(log|start|begin|record|do).{0,16}(session|workout|training)/i.test(m) ||
    /(session|workout).{0,12}(log|today|now)/i.test(m) ||
    /^(train|workout|session)\b/i.test(m.trim()) ||
    /log (today'?s )?session/i.test(m)
  ) {
    return { kind: "log_session" };
  }

  // Re-test assessments
  if (
    /(re-?test|rerun|run|do|log).{0,20}(assessment|screen|back scratch|ohs|overhead squat|posture|ankle)/i.test(
      m
    ) ||
    /(assessment|screen|movement screen).{0,16}(again|re-?test|today)/i.test(m) ||
    /re-?assess/i.test(m)
  ) {
    return { kind: "retest_assessment", screenHint: parseScreenHint(m) };
  }

  // Open / view programs
  if (
    /(open|show|view|list|see).{0,16}(program|programs)/i.test(m) ||
    /what programs|which program|active program/i.test(m)
  ) {
    return { kind: "open_program" };
  }

  // Sessions history
  if (
    /(open|show|view|list).{0,16}(session|sessions|workout log|history of (workouts|sessions))/i.test(
      m
    ) ||
    /session history|past (sessions|workouts)/i.test(m)
  ) {
    return { kind: "open_sessions" };
  }

  // Equipment
  if (
    /(equipment|inventory|what gear|available equipment)/i.test(m) &&
    /(open|show|view|list|manage|toggle|available)/i.test(m)
  ) {
    return { kind: "open_equipment" };
  }

  // Client brief / overview (after CRM open/create actions)
  if (
    /brief me|client brief|summary of (this |the |my )?client|who is this client|what'?s on file|client overview|tell me about (this |the |my )?client/i.test(
      m
    )
  ) {
    return { kind: "client_brief" };
  }

  // Next session / session prep
  if (
    /prep for (today'?s )?session|what should we do today|next workout|session prep|ready for training|what today/i.test(
      m
    )
  ) {
    return { kind: "next_session" };
  }

  // Progression / progressive overload
  if (
    /how to progress|progressive overload|when to add weight|bump load|progress this client/i.test(
      m
    )
  ) {
    return { kind: "progression" };
  }

  return { kind: "general" };
}

function parseScreenHint(m: string): string | undefined {
  if (/back scratch|apley/i.test(m)) return "back-scratch";
  if (/overhead squat|ohs/i.test(m)) return "overhead-squat";
  if (/posture/i.test(m)) return "posture-static";
  if (/ankle/i.test(m)) return "ankle-df-wall";
  if (/hinge/i.test(m)) return "hip-hinge-screen";
  return undefined;
}

export function parseGoal(m: string): ProgramGoal | undefined {
  if (/hypertrophy|muscle\s*gain|build\s*muscle|get\s*big/i.test(m)) return "hypertrophy";
  if (/strength|get\s*strong|1rm|powerlifting/i.test(m)) return "strength";
  if (/fat\s*loss|weight\s*loss|cut|cutting|lean\s*out|lose\s*weight/i.test(m))
    return "fat_loss";
  if (/mobility|corrective|rehab|prehab|movement/i.test(m)) return "mobility";
  if (/general|fitness|health|tone/i.test(m)) return "general";
  return undefined;
}

export function parseDays(m: string): number | undefined {
  const a = m.match(/(\d)\s*[- ]?\s*day/i);
  if (a) {
    const n = Number(a[1]);
    if (n >= 2 && n <= 6) return n;
  }
  const b = m.match(/(\d)\s*x\s*\/?\s*week/i);
  if (b) {
    const n = Number(b[1]);
    if (n >= 2 && n <= 6) return n;
  }
  return undefined;
}

export function parseMinutes(m: string): number | undefined {
  const a = m.match(/(\d{2,3})\s*(min|minutes)/i);
  if (a) {
    const n = Number(a[1]);
    if (n >= 20 && n <= 120) return n;
  }
  return undefined;
}

export function buildProgramWizardHref(params: {
  clientId?: string | null;
  goal?: ProgramGoal;
  daysPerWeek?: number;
  sessionMinutes?: number;
  experienceLevel?: string | null;
  preferMobility?: boolean;
  notes?: string;
}): string {
  const q = new URLSearchParams();
  if (params.clientId) q.set("client", params.clientId);
  if (params.goal) q.set("goal", params.goal);
  if (params.daysPerWeek) q.set("days", String(params.daysPerWeek));
  if (params.sessionMinutes) q.set("minutes", String(params.sessionMinutes));
  if (params.experienceLevel) q.set("experience", params.experienceLevel);
  if (params.preferMobility) q.set("mobility", "1");
  if (params.notes) q.set("notes", params.notes.slice(0, 300));
  const s = q.toString();
  return s ? `/programs/new?${s}` : "/programs/new";
}

export function programActionsForClient(opts: {
  clientId: string;
  clientName: string;
  goal?: ProgramGoal;
  daysPerWeek?: number;
  sessionMinutes?: number;
  experienceLevel?: string | null;
  preferMobility?: boolean;
  injuries?: string | null;
  goalsText?: string | null;
}): CrmAction[] {
  const goal = opts.goal || "general";
  const days = opts.daysPerWeek || 3;
  const minutes = opts.sessionMinutes || 45;
  const preferMobility =
    opts.preferMobility ||
    /shoulder|mobility|scratch|apley/i.test(opts.injuries || "");

  const notes = [
    opts.goalsText ? `Client goals: ${opts.goalsText}` : null,
    opts.injuries ? `Constraints: ${opts.injuries}` : null,
    "Created from coach assistant",
  ]
    .filter(Boolean)
    .join("\n");

  const wizardHref = buildProgramWizardHref({
    clientId: opts.clientId,
    goal,
    daysPerWeek: days,
    sessionMinutes: minutes,
    experienceLevel: opts.experienceLevel,
    preferMobility,
    notes,
  });

  return [
    {
      id: "create_program_now",
      kind: "create_program",
      label: "Create program now",
      description: `${days}×/wk · ${goal.replace("_", " ")} · ${minutes} min — uses available equipment + ${opts.clientName}'s profile`,
      payload: {
        clientId: opts.clientId,
        goal,
        daysPerWeek: days,
        sessionMinutes: minutes,
        experienceLevel: opts.experienceLevel || undefined,
        preferMobility,
        notes,
        activate: true,
        title: undefined,
      },
    },
    {
      id: "open_program_wizard",
      kind: "open_program_wizard",
      label: "Open guided builder",
      description: "Review and tweak before generating",
      href: wizardHref,
      payload: {
        clientId: opts.clientId,
        goal,
        daysPerWeek: days,
        sessionMinutes: minutes,
        experienceLevel: opts.experienceLevel || undefined,
        preferMobility,
      },
    },
    {
      id: "open_client",
      kind: "open_client",
      label: "View client profile",
      href: `/clients/${opts.clientId}`,
    },
  ];
}

export function clientNeedSelectActions(): CrmAction[] {
  return [
    {
      id: "select_client_hint",
      kind: "select_client_hint",
      label: "Select a client first",
      description:
        "Use Select client in Coach (search in the panel)",
    },
  ];
}

/** Quick-nav actions for a client brief / overview. */
export function briefActions(
  clientId: string,
  clientName: string
): CrmAction[] {
  return [
    {
      id: "open_client",
      kind: "open_client",
      label: "View client profile",
      description: clientName,
      href: `/clients/${clientId}`,
      payload: { clientId },
    },
    {
      id: "open_assessments",
      kind: "open_assessments",
      label: "Assessments",
      description: `${clientName} — screens and re-tests`,
      href: `/clients/${clientId}/assessments`,
      payload: { clientId },
    },
    {
      id: "open_programs",
      kind: "open_programs",
      label: "Programs",
      description: `${clientName} — active and draft programs`,
      href: `/programs?client=${clientId}`,
      payload: { clientId },
    },
    {
      id: "open_sessions",
      kind: "open_sessions",
      label: "Sessions",
      description: `${clientName} — session history`,
      href: `/sessions?client=${clientId}`,
      payload: { clientId },
    },
  ];
}

/** Chip prompt strings for next-session prep flows. */
export function nextSessionSuggestions(
  hasInProgress: boolean,
  hasProgram: boolean
): string[] {
  const chips: string[] = [];
  if (hasInProgress) {
    chips.push("Resume the in-progress session");
    chips.push("What did we leave unfinished?");
  }
  if (hasProgram) {
    chips.push("Prep for today's session");
    chips.push("Which program day should we run?");
    chips.push("Log a session now");
  } else {
    chips.push("Create a program for this client");
    chips.push("What should we do today without a program?");
  }
  chips.push("Any red flags before training?");
  return chips;
}

export function sessionActionsForPrograms(
  clientId: string,
  clientName: string,
  programs: {
    id: string;
    title: string;
    status: string;
    days: { id: string; name: string; dayIndex: number }[];
  }[]
): CrmAction[] {
  const actions: CrmAction[] = [];
  const active = programs.filter((p) => p.status === "active");
  const list = active.length ? active : programs;

  for (const p of list.slice(0, 3)) {
    actions.push({
      id: `open_program_${p.id}`,
      kind: "open_program",
      label: `Open: ${p.title}`,
      description: p.status === "active" ? "Active program" : p.status,
      href: `/programs/${p.id}`,
      payload: { programId: p.id, clientId },
    });
    for (const d of p.days.slice(0, 4)) {
      actions.push({
        id: `start_session_${d.id}`,
        kind: "start_session",
        label: `Log: ${d.name}`,
        description: `${p.title} · ${clientName}`,
        payload: {
          clientId,
          programId: p.id,
          programDayId: d.id,
        },
      });
    }
  }

  actions.push({
    id: "open_sessions",
    kind: "open_sessions",
    label: "All sessions",
    href: `/sessions?client=${clientId}`,
  });

  if (!list.length) {
    actions.unshift({
      id: "create_program_for_session",
      kind: "open_program_wizard",
      label: "Create a program first",
      description: "Sessions start from a program day",
      href: `/programs/new?client=${clientId}`,
    });
  }

  return actions;
}

export function retestActions(
  clientId: string,
  clientName: string,
  screenHint?: string
): CrmAction[] {
  return [
    {
      id: "open_assessments",
      kind: "open_assessments",
      label: "Open assessments / re-test",
      description: screenHint
        ? `${clientName} — run ${screenHint.replace(/-/g, " ")}`
        : `${clientName} — run or re-test movement screens`,
      href: `/clients/${clientId}/assessments`,
      payload: { clientId, screenHint },
    },
    {
      id: "open_client_profile",
      kind: "open_client",
      label: "Full client profile",
      href: `/clients/${clientId}`,
    },
  ];
}
