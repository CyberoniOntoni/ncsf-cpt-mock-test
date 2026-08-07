import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  clientAssessments,
  clients,
  assessmentTemplates,
  programDays,
  programs,
  trainingSessions,
} from "@/db/schema";
import { aiEnabled, aiModel, getAiClient } from "./client";
import { searchPlaybooks, type RetrievedPlaybook } from "./retrieval";
import {
  solutionCardSchema,
  type CoachResponse,
  type CrmAction,
  type SolutionCard,
} from "./schemas";
import {
  clientNeedSelectActions,
  detectIntent,
  programActionsForClient,
  retestActions,
  sessionActionsForPrograms,
} from "./intents";
import { fullName } from "@/lib/utils";
import {
  listExercisesForOrg,
  suggestExercisesForCoach,
  type ExerciseWithAvailability,
} from "@/lib/exercises";
import { rankBankByNameQuery } from "@/lib/program-exercise-add";
import { bullet, numbered, stripMarkdown } from "./coach-text";

export type CoachTurnInput = {
  organizationId: string;
  clientId?: string | null;
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
};

async function loadClientContext(
  clientId: string | null | undefined,
  organizationId: string
) {
  if (!clientId) return null;
  const db = await getDb();
  // Tenant isolation: never load a client from another org
  const [client] = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.id, clientId), eq(clients.organizationId, organizationId))
    )
    .limit(1);
  if (!client) return null;
  const assessments = await db
    .select({
      assessment: clientAssessments,
      templateName: assessmentTemplates.name,
      templateSlug: assessmentTemplates.slug,
    })
    .from(clientAssessments)
    .leftJoin(assessmentTemplates, eq(clientAssessments.templateId, assessmentTemplates.id))
    .where(eq(clientAssessments.clientId, clientId));

  // Group by template: expose latest + baseline for coach reasoning
  type Row = (typeof assessments)[number];
  const byTemplate = new Map<string, Row[]>();
  for (const a of assessments) {
    const key = a.assessment.templateId;
    if (!byTemplate.has(key)) byTemplate.set(key, []);
    byTemplate.get(key)!.push(a);
  }

  const assessmentSummaries = Array.from(byTemplate.values()).map((rows) => {
    const sorted = [...rows].sort((a, b) => {
      const ta = a.assessment.takenAt ? new Date(a.assessment.takenAt).getTime() : 0;
      const tb = b.assessment.takenAt ? new Date(b.assessment.takenAt).getTime() : 0;
      return tb - ta;
    });
    const latest = sorted[0];
    const baseline = sorted[sorted.length - 1];
    const same = baseline.assessment.id === latest.assessment.id;
    return {
      name: latest.templateName,
      slug: latest.templateSlug,
      timesTested: sorted.length,
      latest: {
        takenAt: latest.assessment.takenAt,
        results: latest.assessment.results,
        summary: latest.assessment.summary,
        notes: latest.assessment.notes,
      },
      baseline: same
        ? null
        : {
            takenAt: baseline.assessment.takenAt,
            results: baseline.assessment.results,
            summary: baseline.assessment.summary,
          },
    };
  });

  const sessionRows = await db
    .select({
      id: trainingSessions.id,
      title: trainingSessions.title,
      status: trainingSessions.status,
      performedAt: trainingSessions.performedAt,
      durationMin: trainingSessions.durationMin,
      overallRpe: trainingSessions.overallRpe,
      painNotes: trainingSessions.painNotes,
      notes: trainingSessions.notes,
      programDayId: trainingSessions.programDayId,
      programId: trainingSessions.programId,
      updatedAt: trainingSessions.updatedAt,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.clientId, clientId),
        eq(trainingSessions.organizationId, organizationId)
      )
    )
    .orderBy(desc(trainingSessions.performedAt), desc(trainingSessions.updatedAt))
    .limit(4);

  const mapSession = (s: (typeof sessionRows)[number]) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    performedAt: s.performedAt,
    durationMin: s.durationMin,
    overallRpe: s.overallRpe,
    painNotes: s.painNotes,
    notes: s.notes,
    programDayId: s.programDayId,
    programId: s.programId,
  });

  const recentSessions = sessionRows.map(mapSession);

  // Prefer dedicated in-progress query so resume is not limited to last-4 window
  const inProgressRows = await db
    .select({
      id: trainingSessions.id,
      title: trainingSessions.title,
      status: trainingSessions.status,
      performedAt: trainingSessions.performedAt,
      durationMin: trainingSessions.durationMin,
      overallRpe: trainingSessions.overallRpe,
      painNotes: trainingSessions.painNotes,
      notes: trainingSessions.notes,
      programDayId: trainingSessions.programDayId,
      programId: trainingSessions.programId,
      updatedAt: trainingSessions.updatedAt,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.clientId, clientId),
        eq(trainingSessions.organizationId, organizationId),
        eq(trainingSessions.status, "in_progress")
      )
    )
    .orderBy(desc(trainingSessions.updatedAt))
    .limit(4);

  const inProgressSessions =
    inProgressRows.length > 0
      ? inProgressRows.map(mapSession)
      : recentSessions.filter((s) => s.status === "in_progress");

  const [activeProgramRow] = await db
    .select({
      id: programs.id,
      title: programs.title,
      status: programs.status,
    })
    .from(programs)
    .where(
      and(
        eq(programs.clientId, clientId),
        eq(programs.organizationId, organizationId),
        eq(programs.status, "active")
      )
    )
    .orderBy(desc(programs.updatedAt))
    .limit(1);

  return {
    name: fullName(client.firstName, client.lastName),
    goals: client.goals,
    injuries: client.injuries,
    medicalHistory: client.medicalHistory,
    contraindications: client.contraindications,
    experienceLevel: client.experienceLevel,
    assessments: assessmentSummaries,
    recentSessions,
    inProgressSessions,
    activeProgram: activeProgramRow ?? null,
  };
}

/** Session line for coach copy: title · status · RPE · pain */
function formatSessionLine(s: {
  title: string;
  status: string;
  overallRpe?: string | null;
  painNotes?: string | null;
}): string {
  const parts = [s.title, s.status.replace(/_/g, " ")];
  if (s.overallRpe) parts.push(`RPE ${s.overallRpe}`);
  if (s.painNotes) parts.push(`pain: ${s.painNotes}`);
  return parts.join(" · ");
}

/** Safe intent kind check — works even if detectIntent lacks new kinds yet */
function intentKindIs(intent: { kind: string }, ...kinds: string[]): boolean {
  return kinds.includes(intent.kind);
}

function matchesClientBrief(message: string): boolean {
  return (
    /\b(client brief|brief (on|for|about) (the )?client|client (summary|overview|profile)|summar(y|ize) (this |the )?client|who is this client|what do we know about)\b/i.test(
      message
    ) ||
    /^(brief|client brief)\b/i.test(message.trim())
  );
}

function matchesNextSession(message: string): boolean {
  return (
    /\b(next session|today'?s session|what (should|do) we (do|train) today|what today|plan today|session today|ready to train|what'?s (on|the plan) today)\b/i.test(
      message
    ) ||
    /\b(what should we do|what do we do)\b/i.test(message)
  );
}

function matchesProgression(message: string): boolean {
  return (
    /\b(progress(ion|ive)?|progressive overload|when to (add|increase) (load|weight)|add load|increase weight|double progression|bump (the )?(weight|load))\b/i.test(
      message
    )
  );
}

/** Attach optional suggestions without failing solutionCardSchema (zod strips unknown). */
function withSuggestions<T extends CoachResponse>(
  res: T,
  suggestions: string[]
): T & { suggestions?: string[] } {
  if (!suggestions.length) return res;
  return { ...res, suggestions };
}

function dedupeActionsById<T extends { id: string }>(actions: T[], max = 6): T[] {
  const byId = new Map<string, T>();
  for (const a of actions) {
    if (!byId.has(a.id)) byId.set(a.id, a);
  }
  return Array.from(byId.values()).slice(0, max);
}

function toExerciseSuggestions(list: ExerciseWithAvailability[]) {
  return list.map((e) => ({
    id: e.id,
    name: e.name,
    movementPattern: e.movementPattern,
    equipment: e.equipmentNames.length ? e.equipmentNames : ["Bodyweight"],
    reason: e.tags.split(",")[0]?.trim() || e.movementPattern,
    cues: e.cues || undefined,
  }));
}

function ruleBasedCoach(
  message: string,
  playbooks: RetrievedPlaybook[],
  history: { role: string; content: string }[],
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>,
  exerciseHits: ExerciseWithAvailability[]
): CoachResponse {
  if (playbooks.length === 0 && exerciseHits.length === 0) {
    return {
      type: "message",
      content:
        "I don't have a strong match in the knowledge base or exercise bank for that yet. Try rephrasing (e.g. assessment name like \"back scratch\"), or add a playbook. I won't invent a detailed protocol without sources.",
      actions: [
        {
          id: "open_knowledge",
          kind: "open_knowledge",
          label: "Browse knowledge",
          href: "/knowledge",
        },
        {
          id: "open_library",
          kind: "open_library",
          label: "Exercise library",
          href: "/library",
        },
      ],
    };
  }

  if (playbooks.length === 0 && exerciseHits.length > 0) {
    const solution: SolutionCard = {
      summary: "Exercise suggestions from your available equipment",
      likelyFactors: [],
      followUpAssessments: [],
      interventions: [
        "These picks use only equipment marked available in Library → Equipment.",
      ],
      exerciseSuggestions: toExerciseSuggestions(exerciseHits),
      redFlags: [],
      referOut: false,
      confidence: "medium",
      playbookIds: [],
      playbookTitles: [],
      actions: [],
      disclaimer:
        "Coaching support only — not a medical diagnosis. Refer to a qualified clinician when red flags are present.",
    };
    return { type: "solution", ...solutionCardSchema.parse(solution) };
  }

  const top = playbooks[0];
  const userTurns = history.filter((h) => h.role === "user").length + 1;
  const answeredFollowUps = userTurns > 1;

  if (!answeredFollowUps && top.followUpQuestions.length > 0) {
    const clientHint = clientCtx
      ? `For ${clientCtx.name}: ` +
        (clientCtx.injuries ? `Known notes: ${clientCtx.injuries}. ` : "")
      : "";
    return {
      type: "follow_up",
      intro: `${clientHint}Matched playbook: ${top.title}. ${top.summary ?? ""}\n\nA few follow-ups so the plan is specific:`,
      questions: top.followUpQuestions.slice(0, 5),
      playbookIds: playbooks.map((p) => p.id),
      actions: [],
    };
  }

  const likelyFactors = extractBullets(top.body, "Likely contributors", 6);

  // Soft caution when a recent completed session logged pain
  if (clientCtx?.recentSessions?.length) {
    const painful = clientCtx.recentSessions.find(
      (s) =>
        s.status === "completed" &&
        s.painNotes &&
        String(s.painNotes).trim().length > 0
    );
    if (painful) {
      likelyFactors.unshift(
        `Caution: recent session "${painful.title}" noted pain — ${painful.painNotes}. Keep load conservative and re-check technique.`
      );
    }
  }

  const baseSummary = top.summary || top.title;
  const solution: SolutionCard = {
    summary: clientCtx
      ? `${clientCtx.name}: ${baseSummary}${
          clientCtx.goals ? ` · goal: ${clientCtx.goals}` : ""
        }`
      : baseSummary,
    likelyFactors,
    followUpAssessments: top.solutionSteps.slice(0, 3),
    interventions: top.interventions.length
      ? top.interventions
      : top.solutionSteps,
    exerciseSuggestions: toExerciseSuggestions(exerciseHits.slice(0, 8)),
    redFlags: top.redFlags,
    referOut:
      top.redFlags.length > 0 &&
      /pain|trauma|night|neuro/i.test(
        message + " " + history.map((h) => h.content).join(" ")
      ),
    confidence: top.score >= 4 ? "high" : top.score >= 2 ? "medium" : "low",
    playbookIds: playbooks.map((p) => p.id),
    playbookTitles: playbooks.map((p) => p.title),
    actions: [],
    disclaimer:
      "Coaching support only — not a medical diagnosis. Refer to a qualified clinician when red flags are present.",
  };

  const parsed = solutionCardSchema.parse(solution);
  return { type: "solution", ...parsed };
}

function extractBullets(body: string, heading: string, max: number): string[] {
  const idx = body.toLowerCase().indexOf(heading.toLowerCase());
  if (idx < 0) return [];
  const slice = body.slice(idx, idx + 600);
  const lines = slice
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(
      (l) =>
        l &&
        !l.toLowerCase().includes(heading.toLowerCase()) &&
        l.length < 200
    );
  return lines.slice(0, max);
}

async function llmCoach(
  message: string,
  playbooks: RetrievedPlaybook[],
  history: { role: "user" | "assistant"; content: string }[],
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>,
  exerciseHits: ExerciseWithAvailability[]
): Promise<CoachResponse | null> {
  const client = getAiClient();
  if (!client || (playbooks.length === 0 && exerciseHits.length === 0)) return null;

  const system = `You are a personal trainer co-pilot inside a CRM. You MUST ground advice in the provided playbooks and ONLY suggest exercises from the availableExercises list (already filtered to equipment this gym has).
Rules:
- Prefer CRM actions (programs, sessions, assessments, client profile) over abstract advice. Be concise for floor use.
- If key details are missing, respond with JSON: {"type":"follow_up","intro":"...","questions":["..."],"playbookIds":["..."]}
- When ready, respond with JSON: {"type":"solution","summary":"...","likelyFactors":[],"followUpAssessments":[],"interventions":[],"exerciseSuggestions":[{"id":"...","name":"...","movementPattern":"...","equipment":[],"reason":"...","cues":"..."}],"redFlags":[],"referOut":false,"confidence":"medium","playbookIds":[],"playbookTitles":[],"disclaimer":"Coaching support only — not a medical diagnosis."}
- Never invent exercises not in availableExercises. Never invent medical diagnoses.
- Escalate red flags with referOut=true.
- Write all natural-language fields (summary, intro, interventions, reason, cues, questions) in plain prose — no markdown (**bold**, _italic_, # headings, or * bullets). Use short clear sentences.
- Output ONLY valid JSON, no markdown fences.`;

  // Compact client for LLM: include sessions summary without dumping full rows
  const clientForLlm = clientCtx
    ? {
        name: clientCtx.name,
        goals: clientCtx.goals,
        injuries: clientCtx.injuries,
        medicalHistory: clientCtx.medicalHistory,
        contraindications: clientCtx.contraindications,
        experienceLevel: clientCtx.experienceLevel,
        assessments: clientCtx.assessments,
        activeProgram: clientCtx.activeProgram,
        inProgressSessionCount: clientCtx.inProgressSessions?.length ?? 0,
        recentSessions: (clientCtx.recentSessions || []).map((s) => ({
          title: s.title,
          status: s.status,
          overallRpe: s.overallRpe,
          painNotes: s.painNotes,
          durationMin: s.durationMin,
          performedAt: s.performedAt,
        })),
      }
    : null;

  const context = {
    client: clientForLlm,
    playbooks: playbooks.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      followUpQuestions: p.followUpQuestions,
      solutionSteps: p.solutionSteps,
      interventions: p.interventions,
      redFlags: p.redFlags,
      body: p.body.slice(0, 3000),
    })),
    availableExercises: exerciseHits.map((e) => ({
      id: e.id,
      name: e.name,
      movementPattern: e.movementPattern,
      equipment: e.equipmentNames,
      tags: e.tags,
      cues: e.cues,
    })),
  };

  try {
    const completion = await client.chat.completions.create({
      model: aiModel(),
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        {
          role: "system",
          content: `Knowledge context:\n${JSON.stringify(context)}`,
        },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) return null;
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    if (parsed.type === "follow_up" && Array.isArray(parsed.questions)) {
      return {
        type: "follow_up",
        intro: parsed.intro ? stripMarkdown(String(parsed.intro)) : undefined,
        questions: parsed.questions.map((q: string) => stripMarkdown(String(q))),
        playbookIds: parsed.playbookIds || playbooks.map((p) => p.id),
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      };
    }
    if (parsed.type === "solution" || parsed.summary) {
      // Filter LLM exercise picks to known available ids/names
      const allowedIds = new Set(exerciseHits.map((e) => e.id));
      const allowedNames = new Map(
        exerciseHits.map((e) => [e.name.toLowerCase(), e])
      );
      let exerciseSuggestions = Array.isArray(parsed.exerciseSuggestions)
        ? parsed.exerciseSuggestions
            .map(
              (s: {
                id?: string;
                name?: string;
                movementPattern?: string;
                equipment?: string[];
                reason?: string;
                cues?: string;
              }) => {
                const byId = s.id && allowedIds.has(s.id)
                  ? exerciseHits.find((e) => e.id === s.id)
                  : null;
                const byName =
                  s.name && allowedNames.get(s.name.toLowerCase());
                const hit = byId || byName;
                if (!hit) return null;
                return {
                  id: hit.id,
                  name: hit.name,
                  movementPattern: hit.movementPattern,
                  equipment: hit.equipmentNames.length
                    ? hit.equipmentNames
                    : ["Bodyweight"],
                  reason: s.reason ? stripMarkdown(s.reason) : undefined,
                  cues: s.cues
                    ? stripMarkdown(s.cues)
                    : hit.cues || undefined,
                };
              }
            )
            .filter(Boolean)
        : [];
      if (!exerciseSuggestions.length && exerciseHits.length) {
        exerciseSuggestions = toExerciseSuggestions(exerciseHits.slice(0, 6));
      }
      const plainList = (v: unknown) =>
        Array.isArray(v)
          ? v.map((x) => stripMarkdown(String(x)))
          : [];
      const solution = solutionCardSchema.parse({
        ...parsed,
        summary: stripMarkdown(String(parsed.summary || "")),
        likelyFactors: plainList(parsed.likelyFactors),
        followUpAssessments: plainList(parsed.followUpAssessments),
        interventions: plainList(parsed.interventions),
        redFlags: plainList(parsed.redFlags),
        disclaimer: parsed.disclaimer
          ? stripMarkdown(String(parsed.disclaimer))
          : undefined,
        exerciseSuggestions,
        playbookIds: parsed.playbookIds || playbooks.map((p) => p.id),
        playbookTitles: (
          parsed.playbookTitles || playbooks.map((p) => p.title)
        ).map((t: string) => stripMarkdown(t)),
      });
      return { type: "solution", ...solution };
    }
    return null;
  } catch {
    return null;
  }
}

/** Append a bank exercise to an active program day (needs DB for days + bank). */
async function handleAppendExerciseIntent(
  input: CoachTurnInput,
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>,
  intent: Extract<ReturnType<typeof detectIntent>, { kind: "append_exercise" }>
): Promise<CoachResponse> {
  if (!input.clientId || !clientCtx) {
    return {
      type: "follow_up",
      intro: "Select a client first so I can add an exercise to their program.",
      questions: ["Pick a client above, then ask again — e.g. “add face pulls to day 1”."],
      playbookIds: [],
      actions: clientNeedSelectActions(),
    };
  }

  const prog = clientCtx.activeProgram;
  if (!prog) {
    return {
      type: "solution",
      ...solutionCardSchema.parse({
        summary: `${clientCtx.name} has no active program to update`,
        interventions: [
          "Create a program first, then I can append an exercise to a day.",
        ],
        playbookTitles: ["Program design (CRM)"],
        actions: [
          {
            id: "create_for_append",
            kind: "create_program",
            label: "Create program now",
            payload: {
              clientId: input.clientId,
              daysPerWeek: 3,
              activate: true,
            },
          },
          {
            id: "open_wizard_append",
            kind: "open_program_wizard",
            label: "Open program wizard",
            href: `/programs/new?client=${input.clientId}`,
          },
        ],
      }),
    };
  }

  const db = await getDb();
  const days = await db
    .select({
      id: programDays.id,
      name: programDays.name,
      dayIndex: programDays.dayIndex,
    })
    .from(programDays)
    .where(eq(programDays.programId, prog.id))
    .orderBy(asc(programDays.dayIndex));

  if (!days.length) {
    return {
      type: "solution",
      ...solutionCardSchema.parse({
        summary: `“${prog.title}” has no days yet`,
        interventions: ["Open the program and add a day, then try again."],
        playbookTitles: ["Program design (CRM)"],
        actions: [
          {
            id: "open_prog_append_empty",
            kind: "open_program",
            label: "Open program",
            href: `/programs/${prog.id}`,
            payload: { programId: prog.id },
          },
        ],
      }),
    };
  }

  const day =
    intent.dayHint != null &&
    intent.dayHint >= 1 &&
    intent.dayHint <= days.length
      ? days[intent.dayHint - 1]
      : days[0];

  const query = (intent.exerciseQuery || "").trim();
  if (!query) {
    return {
      type: "solution",
      ...solutionCardSchema.parse({
        summary: `Which exercise should I add to “${prog.title}”?`,
        interventions: [
          `Target day: ${day.name}. Name an exercise from your bank — e.g. “add face pulls to day 1”.`,
        ],
        playbookTitles: ["Program design (CRM)"],
        actions: [
          {
            id: "open_prog_append_query",
            kind: "open_program",
            label: "Open program (add on desk)",
            href: `/programs/${prog.id}`,
            payload: { programId: prog.id },
          },
        ],
        suggestions: [
          "Add face pulls to day 1",
          "Add band pull-aparts as warmup",
        ],
      }),
    };
  }

  const bank = await listExercisesForOrg(input.organizationId);
  const ranked = rankBankByNameQuery(bank, query);
  const availableRanked = ranked.filter((e) => e.available !== false);

  if (!ranked.length || !availableRanked.length) {
    const reason = !ranked.length
      ? `No bank exercise matched “${query}”.`
      : `Matches for “${query}” need unavailable equipment.`;
    return {
      type: "solution",
      ...solutionCardSchema.parse({
        summary: reason,
        interventions: [
          "Open the program and use Add exercise on the day, or try a different name.",
          !ranked.length
            ? "Check spelling against your exercise library."
            : `Closest unavailable: ${ranked
                .slice(0, 3)
                .map((e) => e.name)
                .join(", ")}.`,
        ],
        playbookTitles: ["Program design (CRM)"],
        actions: [
          {
            id: "open_prog_append_nomatch",
            kind: "open_program",
            label: "Open program",
            href: `/programs/${prog.id}`,
            payload: { programId: prog.id },
          },
          {
            id: "open_library_append",
            kind: "open_library",
            label: "Open exercise library",
            href: "/library",
          },
        ],
      }),
    };
  }

  const pick = availableRanked[0];
  const ambiguous = availableRanked.length > 1;
  const warmupNote = intent.isWarmup ? " as warm-up" : "";

  return {
    type: "solution",
    ...solutionCardSchema.parse({
      summary: `Add ${pick.name}${warmupNote} to ${day.name} on “${prog.title}”`,
      interventions: [
        ambiguous
          ? `Best match for “${query}”. Also matched: ${availableRanked
              .slice(1, 4)
              .map((e) => e.name)
              .join(", ")}.`
          : `Matched “${query}” in the exercise bank.`,
        "Apply appends a straight set at the end of the day (defaults: 3×8-10 @ RPE 7).",
      ],
      playbookTitles: ["Program design (CRM)"],
      actions: [
        {
          id: "do_append_exercise",
          kind: "append_exercise",
          label: `Add ${pick.name}`,
          description: day.name,
          payload: {
            programId: prog.id,
            programDayId: day.id,
            bankExerciseId: pick.id,
            exerciseName: pick.name,
            clientId: input.clientId,
            isWarmup: intent.isWarmup,
          },
        },
        {
          id: "open_prog_append",
          kind: "open_program",
          label: "Open program",
          href: `/programs/${prog.id}`,
          payload: { programId: prog.id },
        },
      ],
    }),
  };
}

/** Apply correctives / mesocycle to the client's active program. */
function handleProgramMutateIntent(
  input: CoachTurnInput,
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>,
  intent: Extract<
    ReturnType<typeof detectIntent>,
    | { kind: "insert_correctives" }
    | { kind: "apply_mesocycle" }
    | { kind: "advance_mesocycle" }
  >
): CoachResponse {
  if (!input.clientId || !clientCtx) {
    return {
      type: "follow_up",
      intro: "Select a client first so I can change their program.",
      questions: ["Pick a client above, then ask again."],
      playbookIds: [],
      actions: clientNeedSelectActions(),
    };
  }

  const prog = clientCtx.activeProgram;
  if (!prog) {
    return {
      type: "solution",
      ...solutionCardSchema.parse({
        summary: `${clientCtx.name} has no active program to update`,
        interventions: [
          "Create a program first, then I can insert correctives or apply a mesocycle week.",
        ],
        playbookTitles: ["Program design (CRM)"],
        actions: [
          {
            id: "create_for_mutate",
            kind: "create_program",
            label: "Create program now",
            payload: { clientId: input.clientId, daysPerWeek: 3, activate: true },
          },
          {
            id: "open_wizard_mutate",
            kind: "open_program_wizard",
            label: "Open program wizard",
            href: `/programs/new?client=${input.clientId}`,
          },
        ],
      }),
    };
  }

  if (intent.kind === "insert_correctives") {
    return {
      type: "solution",
      ...solutionCardSchema.parse({
        summary: `Insert warm-up correctives into “${prog.title}”`,
        interventions: [
          "Uses client injuries and recent screen results.",
          "Adds up to 2 correctives per day as warm-ups (skips duplicates).",
        ],
        playbookTitles: ["Correctives (CRM)"],
        actions: [
          {
            id: "do_insert_correctives",
            kind: "insert_correctives",
            label: "Insert correctives",
            description: prog.title,
            payload: { programId: prog.id, clientId: input.clientId },
          },
          {
            id: "open_prog_corr",
            kind: "open_program",
            label: "Open program",
            href: `/programs/${prog.id}`,
            payload: { programId: prog.id },
          },
        ],
      }),
    };
  }

  if (intent.kind === "advance_mesocycle") {
    return {
      type: "solution",
      ...solutionCardSchema.parse({
        summary: `Advance mesocycle on “${prog.title}”`,
        interventions: [
          "Moves to the next training week (1→6, wraps to intro) and scales prescriptions from baseline.",
        ],
        playbookTitles: ["Mesocycle (CRM)"],
        actions: [
          {
            id: "do_advance_meso",
            kind: "advance_mesocycle",
            label: "Advance week",
            description: prog.title,
            payload: { programId: prog.id, clientId: input.clientId },
          },
          {
            id: "open_prog_adv",
            kind: "open_program",
            label: "Open program",
            href: `/programs/${prog.id}`,
            payload: { programId: prog.id },
          },
        ],
      }),
    };
  }

  // apply_mesocycle
  const week = intent.week ?? 4;
  const weekLabel =
    week === 4 ? "W4 · Deload" : `W${week}`;
  return {
    type: "solution",
    ...solutionCardSchema.parse({
      summary: `Apply ${weekLabel} to “${prog.title}”`,
      interventions: [
        "Scales sets/RPE from stored baselines so re-applying does not compound.",
        week === 4
          ? "Deload cuts volume and eases RPE."
          : "Pick Apply to write the week onto the program.",
      ],
      playbookTitles: ["Mesocycle (CRM)"],
      actions: [
        {
          id: "do_apply_meso",
          kind: "apply_mesocycle",
          label: `Apply ${weekLabel}`,
          description: prog.title,
          payload: {
            programId: prog.id,
            clientId: input.clientId,
            mesocycleWeek: week,
          },
        },
        {
          id: "open_prog_meso",
          kind: "open_program",
          label: "Open program",
          href: `/programs/${prog.id}`,
          payload: { programId: prog.id },
        },
      ],
    }),
  };
}

function handleProgramIntent(
  input: CoachTurnInput,
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>,
  intent: Extract<ReturnType<typeof detectIntent>, { kind: "create_program" }>,
  availableCount: number
): CoachResponse {
  if (!input.clientId || !clientCtx) {
    return {
      type: "follow_up",
      intro:
        "I can design a program from your exercise bank and available equipment, but I need a client selected so goals, experience, and injuries feed the plan.",
      questions: [
        "Select a client in the search bar above (or Quick add), then ask again — e.g. “create a 3-day program”.",
        "Or open the guided builder without a client if you want a template.",
      ],
      playbookIds: [],
      actions: [
        {
          id: "open_wizard_no_client",
          kind: "open_program_wizard",
          label: "Open program builder",
          description: "Guided wizard — assign client later",
          href: "/programs/new",
        },
        {
          id: "select_client_hint",
          kind: "select_client_hint",
          label: "Select a client first",
          description: "Use the client search at the top of the workspace",
        },
      ],
    };
  }

  const goal = intent.goal || "general";
  const days = intent.daysPerWeek || 3;
  const minutes = intent.sessionMinutes || 45;
  const preferMobility = /shoulder|mobility|scratch|apley/i.test(
    clientCtx.injuries || ""
  );

  const failedScreens = (clientCtx.assessments || [])
    .filter((a) => {
      const sum = (a.latest?.summary || "").toLowerCase();
      return /fail|poor|limited/.test(sum);
    })
    .map((a) => a.name)
    .filter(Boolean);

  const summary = `Ready to build a program for ${clientCtx.name}`;
  const interventions = [
    `Split: ${days} days/week · ~${minutes} min · goal ${goal.replace(/_/g, " ")}`,
    clientCtx.goals ? `Client goals: ${clientCtx.goals}` : "No goals on file — using general fitness defaults",
    clientCtx.experienceLevel
      ? `Experience: ${clientCtx.experienceLevel}`
      : "Experience: intermediate (default)",
    clientCtx.injuries
      ? `Constraints / injuries: ${clientCtx.injuries}`
      : "No injuries logged",
    preferMobility
      ? "Mobility emphasis recommended from profile/screens"
      : "Standard warm-up mobility",
    failedScreens.length
      ? `Recent screen notes: ${failedScreens.slice(0, 3).join(", ")}`
      : "No failed screens flagged in latest assessments",
    `Exercise pool: ${availableCount} moves available with your current equipment inventory`,
  ];

  const actions = programActionsForClient({
    clientId: input.clientId,
    clientName: clientCtx.name,
    goal,
    daysPerWeek: days,
    sessionMinutes: minutes,
    experienceLevel: clientCtx.experienceLevel,
    preferMobility,
    injuries: clientCtx.injuries,
    goalsText: clientCtx.goals,
  });

  return {
    type: "solution",
    ...solutionCardSchema.parse({
      summary,
      likelyFactors: [
        "Uses only equipment marked available in Library",
        "Prescriptions scale to experience and goal",
        preferMobility
          ? "Includes mobility warm-ups due to shoulder/mobility flags"
          : "Balanced movement patterns (squat, hinge, push, pull, core)",
      ],
      followUpAssessments: failedScreens.length
        ? [`Consider re-testing: ${failedScreens.slice(0, 2).join(", ")}`]
        : ["Optional: run movement screens before progressive overload"],
      interventions,
      exerciseSuggestions: [],
      redFlags: [],
      referOut: false,
      confidence: "high",
      playbookIds: [],
      playbookTitles: ["Program design (CRM)"],
      actions,
      disclaimer:
        "Program drafts are coaching tools. Adjust for pain, medical advice, and live technique.",
    }),
  };
}

async function loadClientPrograms(organizationId: string, clientId: string) {
  const db = await getDb();
  const progs = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.organizationId, organizationId),
        eq(programs.clientId, clientId)
      )
    )
    .orderBy(desc(programs.updatedAt))
    .limit(8);

  const out: {
    id: string;
    title: string;
    status: string;
    days: { id: string; name: string; dayIndex: number }[];
  }[] = [];

  for (const p of progs) {
    const days = await db
      .select()
      .from(programDays)
      .where(eq(programDays.programId, p.id))
      .orderBy(asc(programDays.dayIndex));
    out.push({
      id: p.id,
      title: p.title,
      status: p.status,
      days: days.map((d) => ({
        id: d.id,
        name: d.name,
        dayIndex: d.dayIndex,
      })),
    });
  }
  return out;
}

function handleLogSessionIntent(
  input: CoachTurnInput,
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>,
  clientPrograms: Awaited<ReturnType<typeof loadClientPrograms>>
): CoachResponse {
  if (!input.clientId || !clientCtx) {
    return {
      type: "follow_up",
      intro:
        "To log a session I need a client selected, then a program day to train from.",
      questions: [
        "Select a client above, then ask “log session” again.",
      ],
      playbookIds: [],
      actions: clientNeedSelectActions(),
    };
  }

  const actions = sessionActionsForPrograms(
    input.clientId,
    clientCtx.name,
    clientPrograms
  );

  const active = clientPrograms.filter((p) => p.status === "active");
  const interventions = clientPrograms.length
    ? [
        `${clientCtx.name} has ${clientPrograms.length} program(s)${
          active.length ? ` (${active.length} active)` : ""
        }.`,
        "Pick a day below to start or resume a session log (per-set weights, RPE).",
        "In-progress sessions for that day will resume automatically.",
      ]
    : [
        `${clientCtx.name} has no programs yet.`,
        "Create a program first, then log sessions from a program day.",
      ];

  return {
    type: "solution",
    ...solutionCardSchema.parse({
      summary: `Log a training session for ${clientCtx.name}`,
      likelyFactors: [],
      followUpAssessments: [],
      interventions,
      exerciseSuggestions: [],
      redFlags: [],
      referOut: false,
      confidence: "high",
      playbookIds: [],
      playbookTitles: ["Session log (CRM)"],
      actions,
      disclaimer: "Session logs attach to the client and program when linked.",
    }),
  };
}

function handleRetestIntent(
  input: CoachTurnInput,
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>,
  screenHint?: string
): CoachResponse {
  if (!input.clientId || !clientCtx) {
    return {
      type: "follow_up",
      intro: "Select a client to run or re-test movement screens.",
      questions: ["Pick a client above, then ask to re-test (e.g. back scratch)."],
      playbookIds: [],
      actions: clientNeedSelectActions(),
    };
  }

  const screens = (clientCtx.assessments || [])
    .map((a) => {
      const latest = a.latest?.summary || "no summary";
      return `${a.name}: ${latest}`;
    })
    .slice(0, 6);

  return {
    type: "solution",
    ...solutionCardSchema.parse({
      summary: `Assessments for ${clientCtx.name}`,
      likelyFactors: [],
      followUpAssessments: screens.length
        ? screens
        : ["No assessments on file yet — run first screens from Assessments."],
      interventions: [
        screenHint
          ? `You mentioned ${screenHint.replace(/-/g, " ")} — open the profile and use Re-test on that screen.`
          : "Open the client profile Assessments panel to run or re-test any screen.",
        "Baseline vs latest comparison appears after the second test of the same screen.",
      ],
      exerciseSuggestions: [],
      redFlags: [],
      referOut: false,
      confidence: "high",
      playbookIds: [],
      playbookTitles: ["Assessments (CRM)"],
      actions: retestActions(input.clientId, clientCtx.name, screenHint),
      disclaimer: "Screens are coaching tools, not medical diagnoses.",
    }),
  };
}

function handleOpenProgramIntent(
  input: CoachTurnInput,
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>,
  clientPrograms: Awaited<ReturnType<typeof loadClientPrograms>>
): CoachResponse {
  if (!input.clientId || !clientCtx) {
    return {
      type: "follow_up",
      intro: "Select a client to list their programs — or open all programs.",
      questions: ["Select a client, or browse all programs."],
      playbookIds: [],
      actions: [
        ...clientNeedSelectActions(),
        {
          id: "open_all_programs",
          kind: "open_programs",
          label: "All programs",
          href: "/programs",
        },
      ],
    };
  }

  const interventions = clientPrograms.length
    ? clientPrograms.map(
        (p) =>
          `${p.title} — ${p.status} · ${p.days.length} day(s)`
      )
    : ["No programs for this client yet."];

  const actions = [
    ...clientPrograms.slice(0, 5).map((p) => ({
      id: `open_prog_${p.id}`,
      kind: "open_program" as const,
      label: `Open: ${p.title}`,
      description: p.status,
      href: `/programs/${p.id}`,
      payload: { programId: p.id, clientId: input.clientId! },
    })),
    {
      id: "open_program_wizard",
      kind: "open_program_wizard" as const,
      label: "Design new program",
      href: `/programs/new?client=${input.clientId}`,
    },
    {
      id: "open_all_programs",
      kind: "open_programs" as const,
      label: "All programs",
      href: `/programs?client=${input.clientId}`,
    },
  ];

  return {
    type: "solution",
    ...solutionCardSchema.parse({
      summary: `Programs for ${clientCtx.name}`,
      likelyFactors: [],
      followUpAssessments: [],
      interventions,
      exerciseSuggestions: [],
      redFlags: [],
      referOut: false,
      confidence: "high",
      playbookIds: [],
      playbookTitles: ["Programs (CRM)"],
      actions: dedupeActionsById(actions, 6),
      disclaimer: "Programs use the exercise bank and equipment inventory.",
    }),
  };
}

function handleClientBriefIntent(
  input: CoachTurnInput,
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>
): CoachResponse {
  if (!input.clientId || !clientCtx) {
    return {
      type: "follow_up",
      intro:
        "Select a client to pull a floor-ready brief (goals, screens, recent sessions, active program).",
      questions: [
        "Pick a client in the search bar above, then ask for a client brief again.",
      ],
      playbookIds: [],
      actions: clientNeedSelectActions(),
    };
  }

  const interventions: string[] = [];
  interventions.push(
    clientCtx.goals
      ? `Goals: ${clientCtx.goals}`
      : "Goals: not on file"
  );
  interventions.push(
    clientCtx.experienceLevel
      ? `Experience: ${clientCtx.experienceLevel}`
      : "Experience: not set"
  );
  interventions.push(
    clientCtx.injuries
      ? `Injuries / constraints: ${clientCtx.injuries}`
      : "Injuries: none logged"
  );
  if (clientCtx.contraindications) {
    interventions.push(`Contraindications: ${clientCtx.contraindications}`);
  }
  if (clientCtx.medicalHistory) {
    interventions.push(`Medical notes: ${clientCtx.medicalHistory}`);
  }

  const assessments = clientCtx.assessments || [];
  if (assessments.length) {
    const highlights = assessments.slice(0, 4).map((a) => {
      const sum = a.latest?.summary || "no summary";
      return `${a.name}: ${sum}`;
    });
    interventions.push(`Assessments (latest): ${highlights.join("; ")}`);
  } else {
    interventions.push("Assessments: none on file yet");
  }

  const recent = clientCtx.recentSessions || [];
  if (recent.length) {
    interventions.push(
      `Recent sessions: ${recent.map(formatSessionLine).join("; ")}`
    );
  } else {
    interventions.push("Recent sessions: none logged");
  }

  if (clientCtx.activeProgram) {
    interventions.push(
      `Active program: ${clientCtx.activeProgram.title} (${clientCtx.activeProgram.status})`
    );
  } else {
    interventions.push("Active program: none");
  }

  const missing: string[] = [];
  if (!clientCtx.goals) missing.push("goals");
  if (!clientCtx.injuries) missing.push("injuries/constraints");
  if (!assessments.length) missing.push("movement screens");
  if (!clientCtx.experienceLevel) missing.push("experience level");

  const likelyFactors =
    missing.length > 0
      ? [
          `Profile gaps: missing ${missing.join(", ")}. Fill these for better program and session prompts.`,
        ]
      : ["Profile looks complete enough for program design and session logging."];

  if (clientCtx.inProgressSessions?.length) {
    likelyFactors.push(
      `${clientCtx.inProgressSessions.length} session(s) still in progress — resume before starting a new log.`
    );
  }

  const actions = dedupeActionsById(
    [
      {
        id: "open_client",
        kind: "open_client" as const,
        label: "Open client",
        href: `/clients/${input.clientId}`,
      },
      {
        id: "open_assessments",
        kind: "open_assessments" as const,
        label: "Assessments",
        href: `/clients/${input.clientId}/assessments`,
      },
      {
        id: "open_programs",
        kind: "open_programs" as const,
        label: "Programs",
        href: `/programs?client=${input.clientId}`,
      },
      {
        id: "open_sessions",
        kind: "open_sessions" as const,
        label: "Sessions",
        href: `/sessions?client=${input.clientId}`,
      },
    ],
    6
  );

  return withSuggestions(
    {
      type: "solution",
      ...solutionCardSchema.parse({
        summary: `Client brief: ${clientCtx.name}`,
        likelyFactors,
        followUpAssessments: [],
        interventions,
        exerciseSuggestions: [],
        redFlags: [],
        referOut: false,
        confidence: "high",
        playbookIds: [],
        playbookTitles: ["Client brief (CRM)"],
        actions,
        disclaimer:
          "Brief is pulled from CRM data only. Confirm anything critical with the client on the floor.",
      }),
    },
    [
      "Start session",
      "Create a program",
      "Re-test assessments",
      "What should we do today?",
    ]
  );
}

function handleNextSessionIntent(
  input: CoachTurnInput,
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>,
  clientPrograms: Awaited<ReturnType<typeof loadClientPrograms>>
): CoachResponse {
  if (!input.clientId || !clientCtx) {
    return {
      type: "follow_up",
      intro:
        "Select a client to decide what to train next (resume in-progress or pick a program day).",
      questions: [
        "Select a client above, then ask “what should we do today?” again.",
      ],
      playbookIds: [],
      actions: clientNeedSelectActions(),
    };
  }

  const inProgress = clientCtx.inProgressSessions || [];
  const interventions: string[] = [];
  let actions: CrmAction[] = [];

  if (inProgress.length) {
    interventions.push(
      `${clientCtx.name} has ${inProgress.length} session(s) in progress. Resume first so logs stay clean.`
    );
    for (const s of inProgress.slice(0, 2)) {
      interventions.push(formatSessionLine(s));
      if (s.programDayId) {
        actions.push({
          id: `resume_session_${s.id}`,
          kind: "start_session",
          label: `Resume: ${s.title}`,
          description: "Continues the in-progress log for this program day",
          payload: {
            clientId: input.clientId,
            programId: s.programId || undefined,
            programDayId: s.programDayId,
          },
        });
      } else {
        actions.push({
          id: `resume_open_${s.id}`,
          kind: "open_sessions",
          label: `Resume: ${s.title}`,
          description: "Open session log",
          href: `/sessions/${s.id}`,
        });
      }
    }
    actions.push({
      id: "open_sessions",
      kind: "open_sessions",
      label: "All sessions",
      href: `/sessions?client=${input.clientId}`,
    });
  } else {
    const active = clientPrograms.filter((p) => p.status === "active");
    const list = active.length ? active : clientPrograms;
    if (list.length) {
      interventions.push(
        `No in-progress session for ${clientCtx.name}. Start from an active program day:`
      );
      for (const p of list.slice(0, 2)) {
        const dayNames = p.days.map((d) => d.name).join(", ") || "no days yet";
        interventions.push(`${p.title} (${p.status}) — ${dayNames}`);
      }
      actions = sessionActionsForPrograms(
        input.clientId,
        clientCtx.name,
        clientPrograms
      );
    } else {
      interventions.push(
        `${clientCtx.name} has no programs yet. Create a program, then start sessions from a day.`
      );
      actions.push({
        id: "create_program_for_next",
        kind: "open_program_wizard",
        label: "Create a program",
        href: `/programs/new?client=${input.clientId}`,
      });
      actions.push({
        id: "open_sessions",
        kind: "open_sessions",
        label: "All sessions",
        href: `/sessions?client=${input.clientId}`,
      });
    }
  }

  if (clientCtx.goals) {
    interventions.push(`Goals on file: ${clientCtx.goals}`);
  }
  const lastCompleted = (clientCtx.recentSessions || []).find(
    (s) => s.status === "completed"
  );
  if (lastCompleted) {
    interventions.push(`Last completed: ${formatSessionLine(lastCompleted)}`);
  }

  return withSuggestions(
    {
      type: "solution",
      ...solutionCardSchema.parse({
        summary: `Next session for ${clientCtx.name}`,
        likelyFactors: [],
        followUpAssessments: [],
        interventions,
        exerciseSuggestions: [],
        redFlags: [],
        referOut: false,
        confidence: "high",
        playbookIds: [],
        playbookTitles: ["Next session (CRM)"],
        actions: dedupeActionsById(actions, 6),
        disclaimer:
          "Pick resume or a program day. Adjust load live for pain and technique.",
      }),
    },
    ["Start session", "Show programs", "Client brief"]
  );
}

async function handleProgressionIntent(
  input: CoachTurnInput,
  clientCtx: Awaited<ReturnType<typeof loadClientContext>>
): Promise<CoachResponse> {
  let playbookTitles: string[] = [];
  let playbookIds: string[] = [];
  let groundedSteps: string[] = [];

  try {
    const hits = await searchPlaybooks(
      input.organizationId,
      "progressive overload double progression RPE load"
    );
    if (hits.length) {
      const top = hits[0];
      playbookTitles = hits.slice(0, 3).map((p) => p.title);
      playbookIds = hits.slice(0, 3).map((p) => p.id);
      groundedSteps = top.interventions.length
        ? top.interventions.slice(0, 5)
        : top.solutionSteps.slice(0, 5);
    }
  } catch {
    // fall through to fixed coaching copy
  }

  const defaultProgression = [
    "Double progression: hit the top of the rep range with solid form, then add the smallest load bump next session and rebuild reps.",
    "Use session RPE as a gate: if overall RPE was high (about 8–9) or form broke down, repeat the same load before adding weight.",
    "When pain shows up or technique slips, hold load, reduce range or volume, and re-test the limiting screen before pushing.",
    "Progress one variable at a time — load, reps, or sets — not all three in the same session.",
  ];

  const interventions =
    groundedSteps.length > 0 ? groundedSteps : defaultProgression;

  const likelyFactors: string[] = [];
  if (clientCtx) {
    const last = (clientCtx.recentSessions || []).find(
      (s) => s.status === "completed"
    );
    if (last?.overallRpe) {
      likelyFactors.push(
        `Last session RPE for ${clientCtx.name}: ${last.overallRpe} (${last.title}).`
      );
    }
    if (last?.painNotes) {
      likelyFactors.push(
        `Pain notes last session: ${last.painNotes}. Prefer technique and range over load increases.`
      );
    }
    if (clientCtx.goals) {
      likelyFactors.push(`Goals: ${clientCtx.goals}`);
    }
    if (!last) {
      likelyFactors.push(
        "No completed sessions on file yet — establish a baseline session before aggressive overload."
      );
    }
  } else {
    likelyFactors.push(
      "No client selected — advice is general. Select a client to anchor progression to their last RPE and goals."
    );
  }

  const failedScreens = (clientCtx?.assessments || [])
    .filter((a) => {
      const sum = (a.latest?.summary || "").toLowerCase();
      return /fail|poor|limited/.test(sum);
    })
    .map((a) => a.name)
    .filter(Boolean);

  const followUpAssessments = failedScreens.length
    ? [`Re-test before loading up: ${failedScreens.slice(0, 3).join(", ")}`]
    : [];

  const actions: CrmAction[] = [
    {
      id: "open_programs",
      kind: "open_programs",
      label: "Open programs",
      href: input.clientId
        ? `/programs?client=${input.clientId}`
        : "/programs",
    },
  ];

  if (input.clientId && clientCtx) {
    actions.push({
      id: "design_program_client",
      kind: "open_program_wizard",
      label: "Design / update program",
      href: `/programs/new?client=${input.clientId}`,
    });
    if (failedScreens.length) {
      actions.push({
        id: "open_assessments",
        kind: "open_assessments",
        label: "Re-test screens",
        href: `/clients/${input.clientId}/assessments`,
        description: failedScreens.slice(0, 2).join(", "),
      });
    }
    actions.push({
      id: "open_client",
      kind: "open_client",
      label: `View ${clientCtx.name}`,
      href: `/clients/${input.clientId}`,
    });
  } else {
    actions.unshift(...clientNeedSelectActions());
  }

  const summary = clientCtx
    ? `Progression for ${clientCtx.name}`
    : "Progressive overload (general)";

  return withSuggestions(
    {
      type: "solution",
      ...solutionCardSchema.parse({
        summary,
        likelyFactors,
        followUpAssessments,
        interventions,
        exerciseSuggestions: [],
        redFlags: [],
        referOut: false,
        confidence: groundedSteps.length ? "high" : "medium",
        playbookIds,
        playbookTitles: playbookTitles.length
          ? playbookTitles
          : ["Progression (CRM)"],
        actions: dedupeActionsById(actions, 6),
        disclaimer:
          "Progression is coaching guidance only. Stop and refer out if red-flag pain or neurological signs appear.",
      }),
    },
    clientCtx
      ? ["Start session", "Client brief", "Show programs"]
      : ["Select a client", "Show programs"]
  );
}

export async function runCoachTurn(input: CoachTurnInput): Promise<CoachResponse> {
  const clientCtx = await loadClientContext(
    input.clientId,
    input.organizationId
  );
  const intent = detectIntent(input.userMessage);
  const msg = input.userMessage;

  // CRM-first intents (action buttons into the product)
  if (intent.kind === "create_program") {
    const all = await listExercisesForOrg(input.organizationId);
    const availableCount = all.filter((e) => e.available).length;
    return handleProgramIntent(input, clientCtx, intent, availableCount);
  }

  // Lane D: mutate active program (correctives / mesocycle)
  if (
    intent.kind === "insert_correctives" ||
    intent.kind === "apply_mesocycle" ||
    intent.kind === "advance_mesocycle"
  ) {
    return handleProgramMutateIntent(input, clientCtx, intent);
  }

  if (intent.kind === "append_exercise") {
    return handleAppendExerciseIntent(input, clientCtx, intent);
  }

  if (
    intent.kind === "log_session" ||
    intent.kind === "open_program" ||
    intent.kind === "retest_assessment"
  ) {
    const clientPrograms =
      input.clientId
        ? await loadClientPrograms(input.organizationId, input.clientId)
        : [];

    if (intent.kind === "log_session") {
      return handleLogSessionIntent(input, clientCtx, clientPrograms);
    }
    if (intent.kind === "open_program") {
      return handleOpenProgramIntent(input, clientCtx, clientPrograms);
    }
    return handleRetestIntent(input, clientCtx, intent.screenHint);
  }

  // New CRM intelligence routes (intent.kind and/or inline regex fallbacks)
  if (intentKindIs(intent, "client_brief") || matchesClientBrief(msg)) {
    return handleClientBriefIntent(input, clientCtx);
  }

  if (intentKindIs(intent, "next_session") || matchesNextSession(msg)) {
    const clientPrograms = input.clientId
      ? await loadClientPrograms(input.organizationId, input.clientId)
      : [];
    return handleNextSessionIntent(input, clientCtx, clientPrograms);
  }

  if (intentKindIs(intent, "progression") || matchesProgression(msg)) {
    return handleProgressionIntent(input, clientCtx);
  }

  if (intent.kind === "open_sessions") {
    return {
      type: "message",
      content: "Open the sessions list to resume in-progress logs or review history.",
      actions: [
        {
          id: "open_sessions",
          kind: "open_sessions",
          label: "Open sessions",
          href: input.clientId
            ? `/sessions?client=${input.clientId}`
            : "/sessions",
        },
        ...(input.clientId
          ? [
              {
                id: "log_for_client",
                kind: "open_programs" as const,
                label: "Programs (start a session from a day)",
                href: `/programs?client=${input.clientId}`,
              },
            ]
          : []),
      ],
    };
  }

  if (intent.kind === "open_equipment") {
    return {
      type: "message",
      content:
        "Equipment inventory controls which exercises the program builder and coach can suggest.",
      actions: [
        {
          id: "open_equipment",
          kind: "open_equipment",
          label: "Manage equipment",
          href: "/library/equipment",
        },
        {
          id: "open_library",
          kind: "open_library",
          label: "Exercise library",
          href: "/library",
        },
      ],
    };
  }

  const combinedQuery = [
    ...input.history.map((h) => h.content),
    input.userMessage,
  ].join(" ");

  let playbooks = await searchPlaybooks(input.organizationId, input.userMessage);
  if (playbooks.length === 0 && input.history.length) {
    playbooks = await searchPlaybooks(input.organizationId, combinedQuery);
  }

  const seen = new Set<string>();
  const unique = playbooks.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const playbookTags = unique.flatMap((p) =>
    (p.slug + " " + (p.summary || "")).split(/[\s,]+/)
  );
  const tagBlob = unique.map((p) => `${p.title} ${p.summary || ""} ${p.slug}`).join(" ");

  const exerciseHits = await suggestExercisesForCoach(
    input.organizationId,
    combinedQuery + " " + tagBlob,
    playbookTags,
    10
  );

  // Attach CRM actions when solution relates to assessments and client is selected
  const enrichWithClientActions = (res: CoachResponse): CoachResponse => {
    if (!input.clientId || !clientCtx) return res;
    if (res.type !== "solution" && res.type !== "follow_up") return res;

    const inProgressActions = (clientCtx.inProgressSessions || [])
      .slice(0, 2)
      .map((s) =>
        s.programDayId
          ? {
              id: `resume_ip_${s.id}`,
              kind: "start_session" as const,
              label: `Resume: ${s.title}`,
              description: "In-progress session",
              payload: {
                clientId: input.clientId!,
                programId: s.programId || undefined,
                programDayId: s.programDayId,
              },
            }
          : {
              id: `resume_ip_${s.id}`,
              kind: "open_sessions" as const,
              label: `Resume: ${s.title}`,
              description: "In-progress session",
              href: `/sessions/${s.id}`,
            }
      );

    const extra = [
      ...inProgressActions,
      {
        id: "open_assessments",
        kind: "open_assessments" as const,
        label: "Re-test assessments",
        href: `/clients/${input.clientId}/assessments`,
        description: `Open ${clientCtx.name}'s movement screens`,
      },
      {
        id: "design_program_client",
        kind: "open_program_wizard" as const,
        label: "Design program for client",
        href: `/programs/new?client=${input.clientId}`,
      },
      {
        id: "log_session_client",
        kind: "open_programs" as const,
        label: "Programs (start a session)",
        href: `/programs?client=${input.clientId}`,
        description: "Open a program day → Start / Resume session",
      },
    ];
    const existing: CrmAction[] =
      "actions" in res && res.actions ? res.actions : [];
    const merged = dedupeActionsById(
      [...existing, ...(extra as CrmAction[])],
      6
    );
    if (res.type === "solution") {
      return { ...res, actions: merged };
    }
    return { ...res, actions: merged };
  };

  if (aiEnabled()) {
    const llm = await llmCoach(
      input.userMessage,
      unique,
      input.history,
      clientCtx,
      exerciseHits
    );
    if (llm) return enrichWithClientActions(llm);
  }

  return enrichWithClientActions(
    ruleBasedCoach(
      input.userMessage,
      unique,
      input.history,
      clientCtx,
      exerciseHits
    )
  );
}

export function formatCoachResponseForChat(res: CoachResponse): {
  content: string;
  structured: Record<string, unknown>;
} {
  // Suggestions stay structured-only (console can render chips); do not clutter prose.
  const suggestions =
    res &&
    typeof res === "object" &&
    "suggestions" in res &&
    Array.isArray((res as { suggestions?: unknown }).suggestions)
      ? ((res as { suggestions: string[] }).suggestions as string[])
      : undefined;

  if (res.type === "follow_up") {
    const content = [
      stripMarkdown(res.intro || "A few follow-up questions so the plan is specific:"),
      "",
      ...numbered(res.questions),
      "",
      res.actions?.length
        ? "Use the buttons below, or reply here in chat."
        : "Reply with answers in any format and I’ll propose a plan.",
    ].join("\n");
    return {
      content,
      structured: suggestions?.length ? { ...res, suggestions } : res,
    };
  }
  if (res.type === "message") {
    return {
      content: stripMarkdown(res.content),
      structured: suggestions?.length ? { ...res, suggestions } : res,
    };
  }

  const blocks: string[] = [];
  blocks.push(stripMarkdown(res.summary));

  // Skip empty likelyFactors (no "Context" section when nothing useful)
  if (res.likelyFactors.length) {
    blocks.push(
      "",
      "Context",
      ...res.likelyFactors.map((x) => bullet(x))
    );
  }
  if (res.interventions.length) {
    blocks.push(
      "",
      "Plan",
      ...res.interventions.map((x) => bullet(x))
    );
  }
  if (res.exerciseSuggestions?.length) {
    blocks.push("", "Exercises (available equipment only)");
    for (const e of res.exerciseSuggestions) {
      const eq = e.equipment?.length
        ? ` · ${e.equipment.join(", ")}`
        : "";
      const why = e.reason ? ` — ${stripMarkdown(e.reason)}` : "";
      const cues = e.cues ? `\n    Cue: ${stripMarkdown(e.cues)}` : "";
      blocks.push(bullet(`${e.name}${eq}${why}${cues}`));
    }
  }
  if (res.followUpAssessments.length) {
    blocks.push(
      "",
      "Next checks",
      ...res.followUpAssessments.map((x) => bullet(x))
    );
  }
  if (res.redFlags.length) {
    blocks.push(
      "",
      "Red flags",
      ...res.redFlags.map((x) => bullet(x))
    );
  }
  if (res.referOut) {
    blocks.push(
      "",
      "Refer out before aggressive loading when red flags apply."
    );
  }
  if (res.actions?.length) {
    blocks.push("", "Actions are available as buttons under this message.");
  }
  if (res.playbookTitles.length) {
    blocks.push(
      "",
      `Sources: ${res.playbookTitles.map((t) => stripMarkdown(t)).join(", ")} · confidence: ${res.confidence}`
    );
  }
  blocks.push("", stripMarkdown(res.disclaimer));

  return {
    content: blocks.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    structured: suggestions?.length ? { ...res, suggestions } : res,
  };
}
