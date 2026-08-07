import { z } from "zod";

export const exerciseSuggestionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  movementPattern: z.string().optional(),
  equipment: z.array(z.string()).default([]),
  reason: z.string().optional(),
  cues: z.string().optional(),
});

/** Interactive CRM actions rendered as buttons in the coach console */
export const crmActionSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "create_program",
    "open_program_wizard",
    "open_client",
    "open_assessments",
    "open_sessions",
    "open_programs",
    "open_program",
    "open_library",
    "open_equipment",
    "open_knowledge",
    "open_history",
    "start_session",
    "select_client_hint",
    /** Mutate existing program (Lane D) */
    "insert_correctives",
    "apply_mesocycle",
    "advance_mesocycle",
    "append_exercise",
  ]),
  label: z.string(),
  description: z.string().optional(),
  /** Client-side navigation when no server execution needed */
  href: z.string().optional(),
  /** Server-executed create / mutations */
  payload: z
    .object({
      clientId: z.string().optional().nullable(),
      goal: z
        .enum(["general", "strength", "hypertrophy", "fat_loss", "mobility"])
        .optional(),
      daysPerWeek: z.number().optional(),
      sessionMinutes: z.number().optional(),
      experienceLevel: z.string().optional(),
      preferMobility: z.boolean().optional(),
      title: z.string().optional(),
      notes: z.string().optional(),
      activate: z.boolean().optional(),
      programId: z.string().optional(),
      programDayId: z.string().optional(),
      screenHint: z.string().optional(),
      forceNewSession: z.boolean().optional(),
      /** 1–6 mesocycle week for apply_mesocycle */
      mesocycleWeek: z.number().optional(),
      bankExerciseId: z.string().optional(),
      exerciseName: z.string().optional(),
      isWarmup: z.boolean().optional(),
    })
    .optional(),
});

export type CrmAction = z.infer<typeof crmActionSchema>;

export const solutionCardSchema = z.object({
  summary: z.string(),
  likelyFactors: z.array(z.string()).default([]),
  followUpAssessments: z.array(z.string()).default([]),
  interventions: z.array(z.string()).default([]),
  exerciseSuggestions: z.array(exerciseSuggestionSchema).default([]),
  redFlags: z.array(z.string()).default([]),
  referOut: z.boolean().default(false),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  playbookIds: z.array(z.string()).default([]),
  playbookTitles: z.array(z.string()).default([]),
  actions: z.array(crmActionSchema).default([]),
  /** Follow-up chip prompts for the console (optional) */
  suggestions: z.array(z.string()).optional(),
  disclaimer: z
    .string()
    .default(
      "Coaching support only — not a medical diagnosis. Refer to a qualified clinician when red flags are present."
    ),
});

export type SolutionCard = z.infer<typeof solutionCardSchema>;

export const followUpSchema = z.object({
  type: z.literal("follow_up"),
  intro: z.string().optional(),
  questions: z.array(z.string()).min(1),
  playbookIds: z.array(z.string()).default([]),
  actions: z.array(crmActionSchema).default([]),
  suggestions: z.array(z.string()).optional(),
});

export type FollowUpPayload = z.infer<typeof followUpSchema>;

export const coachResponseSchema = z.discriminatedUnion("type", [
  followUpSchema,
  solutionCardSchema.extend({ type: z.literal("solution") }),
  z.object({
    type: z.literal("message"),
    content: z.string(),
    actions: z.array(crmActionSchema).default([]),
    suggestions: z.array(z.string()).optional(),
  }),
]);

export type CoachResponse = z.infer<typeof coachResponseSchema>;
