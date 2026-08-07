import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  unitSystem: text("unit_system").notNull().default("metric"), // metric | imperial
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /** Optional phone for PT profile */
  phone: text("phone"),
  /** Optional credentials / title line e.g. "NCSF-CPT" */
  title: text("title"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"), // owner | trainer | admin | front_desk
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_user_org_uidx").on(t.userId, t.organizationId)]
);

export const clients = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"), // draft | lead | active | paused | inactive
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    email: text("email"),
    phone: text("phone"),
    dateOfBirth: text("date_of_birth"),
    sex: text("sex"),
    emergencyContact: text("emergency_contact"),
    goals: text("goals"),
    experienceLevel: text("experience_level"),
    occupation: text("occupation"),
    lifestyleNotes: text("lifestyle_notes"),
    medicalHistory: text("medical_history"),
    injuries: text("injuries"),
    medications: text("medications"),
    contraindications: text("contraindications"),
    tags: text("tags"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("clients_org_idx").on(t.organizationId),
    index("clients_name_idx").on(t.organizationId, t.firstName, t.lastName),
  ]
);

export const clientMeasurements = pgTable(
  "client_measurements",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
    heightCm: real("height_cm"),
    weightKg: real("weight_kg"),
    bodyFatPct: real("body_fat_pct"),
    chestCm: real("chest_cm"),
    waistCm: real("waist_cm"),
    hipsCm: real("hips_cm"),
    notes: text("notes"),
    metrics: jsonb("metrics").$type<Record<string, number | string>>(),
  },
  (t) => [index("measurements_client_idx").on(t.clientId)]
);

export const assessmentTemplates = pgTable("assessment_templates", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"), // null = global
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  /** Coach-facing “why this screen” — shown in UI above how-to */
  purpose: text("purpose"),
  instructions: text("instructions"),
  category: text("category").notNull().default("movement"),
  laterality: boolean("laterality").notNull().default(false),
  scoringType: text("scoring_type").notNull().default("pass_fail"), // pass_fail | score | free_text | multi
  fields: jsonb("fields").$type<AssessmentField[]>().notNull().default([]),
  playbookTags: text("playbook_tags"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export type AssessmentField = {
  key: string;
  label: string;
  type: "pass_fail" | "number" | "text" | "select";
  options?: string[];
  side?: "left" | "right" | "both" | "none";
  required?: boolean;
  /** Optional helper under the field in forms */
  help?: string;
};

export const clientAssessments = pgTable(
  "client_assessments",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    templateId: text("template_id")
      .notNull()
      .references(() => assessmentTemplates.id),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
    results: jsonb("results").$type<Record<string, unknown>>().notNull().default({}),
    notes: text("notes"),
    summary: text("summary"),
  },
  (t) => [index("assessments_client_idx").on(t.clientId)]
);

export const clientNotes = pgTable(
  "client_notes",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id),
    conversationId: text("conversation_id"),
    title: text("title"),
    body: text("body").notNull(),
    kind: text("kind").notNull().default("note"), // note | recommendation | ai_solution | check_in
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notes_client_idx").on(t.clientId)]
);

/** Session packages — remaining = totalSessions - usedSessions */
export const clientPackages = pgTable(
  "client_packages",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Session pack"),
    totalSessions: integer("total_sessions").notNull().default(10),
    usedSessions: integer("used_sessions").notNull().default(0),
    /** active | exhausted | cancelled */
    status: text("status").notNull().default("active"),
    purchasedAt: timestamp("purchased_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("packages_client_idx").on(t.clientId)]
);

/** Booked appointments (next session on calendar) */
export const clientAppointments = pgTable(
  "client_appointments",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Training session"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    /** scheduled | completed | cancelled | no_show */
    status: text("status").notNull().default("scheduled"),
    notes: text("notes"),
    location: text("location"),
    /** Linked floor session when started from this booking */
    sessionId: text("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("appointments_client_idx").on(t.clientId),
    index("appointments_starts_idx").on(t.startsAt),
    index("appointments_session_idx").on(t.sessionId),
  ]
);

/**
 * Simple invoices — manual mark paid (no card/tax).
 * status: unpaid | paid | void
 */
export const clientInvoices = pgTable(
  "client_invoices",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Amount in minor units (cents) */
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("SGD"),
    /** unpaid | paid | void */
    status: text("status").notNull().default("unpaid"),
    notes: text("notes"),
    packageId: text("package_id").references(() => clientPackages.id, {
      onDelete: "set null",
    }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invoices_org_idx").on(t.organizationId),
    index("invoices_client_idx").on(t.clientId),
    index("invoices_status_idx").on(t.status),
  ]
);

/** Between-session check-ins / touch log */
export const clientCheckIns = pgTable(
  "client_check_ins",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id),
    /** message | call | in_person | other */
    channel: text("channel").notNull().default("message"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("checkins_client_idx").on(t.clientId)]
);

/** Trainer follow-ups / admin tasks on a client (Phase B) */
export const clientTasks = pgTable(
  "client_tasks",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    /** open | done */
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("tasks_org_idx").on(t.organizationId),
    index("tasks_client_idx").on(t.clientId),
    index("tasks_due_idx").on(t.dueAt),
  ]
);

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_org_idx").on(t.organizationId)]
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant | system
    content: text("content").notNull(),
    structured: jsonb("structured").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)]
);

export const playbooks = pgTable(
  "playbooks",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id"), // null = global
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull().default("corrective"),
    triggerPhrases: text("trigger_phrases").notNull().default(""),
    tags: text("tags").notNull().default(""),
    summary: text("summary"),
    followUpQuestions: jsonb("follow_up_questions").$type<string[]>().notNull().default([]),
    solutionSteps: jsonb("solution_steps").$type<string[]>().notNull().default([]),
    interventions: jsonb("interventions").$type<string[]>().notNull().default([]),
    redFlags: jsonb("red_flags").$type<string[]>().notNull().default([]),
    contraindications: text("contraindications"),
    sourceNotes: text("source_notes"),
    body: text("body").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("playbooks_slug_idx").on(t.slug)]
);

export const playbookChunks = pgTable(
  "playbook_chunks",
  {
    id: text("id").primaryKey(),
    playbookId: text("playbook_id")
      .notNull()
      .references(() => playbooks.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    embedding: jsonb("embedding").$type<number[]>(),
  },
  (t) => [index("chunks_playbook_idx").on(t.playbookId)]
);

/** Global equipment catalog (dumbbell, cable, etc.) */
export const equipmentItems = pgTable("equipment_items", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"), // free_weights | machines | cardio | accessories | bodyweight
  sortOrder: integer("sort_order").notNull().default(0),
  /** Short coach-facing description */
  description: text("description"),
});

/** Per-tenant availability of catalog equipment */
export const orgEquipment = pgTable(
  "org_equipment",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipmentItems.id, { onDelete: "cascade" }),
    available: boolean("available").notNull().default(true),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("org_equipment_uidx").on(t.organizationId, t.equipmentId),
    index("org_equipment_org_idx").on(t.organizationId),
  ]
);

/** Global (+ optional org-private) exercise bank */
export const exercises = pgTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id"), // null = global catalog
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    movementPattern: text("movement_pattern").notNull().default("other"),
    // squat | hinge | horizontal_push | vertical_push | horizontal_pull | vertical_pull | carry | core | mobility | cardio | other
    primaryMuscles: text("primary_muscles").notNull().default(""),
    secondaryMuscles: text("secondary_muscles").notNull().default(""),
    difficulty: text("difficulty").notNull().default("intermediate"), // beginner | intermediate | advanced
    tags: text("tags").notNull().default(""),
    cues: text("cues"),
    /** JSON array of equipment_items.id — empty/null = bodyweight only */
    equipmentIds: jsonb("equipment_ids").$type<string[]>().notNull().default([]),
    /** true if any ONE of the listed equipment is enough (e.g. DB or KB); false = needs all */
    equipmentAny: boolean("equipment_any").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("exercises_pattern_idx").on(t.movementPattern)]
);

/** Training programs assigned to clients (or unassigned drafts) */
export const programs = pgTable(
  "programs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    goal: text("goal").notNull().default("general"), // strength | hypertrophy | fat_loss | general | mobility
    daysPerWeek: integer("days_per_week").notNull().default(3),
    sessionMinutes: integer("session_minutes").notNull().default(45),
    splitType: text("split_type").notNull().default("full_body"), // full_body | upper_lower | ppl | custom
    experienceLevel: text("experience_level").default("intermediate"),
    status: text("status").notNull().default("draft"), // draft | active | archived
    notes: text("notes"),
    generationMeta: jsonb("generation_meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("programs_org_idx").on(t.organizationId),
    index("programs_client_idx").on(t.clientId),
  ]
);

export const programDays = pgTable(
  "program_days",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull().default(0),
    name: text("name").notNull(),
    focus: text("focus"),
  },
  (t) => [index("program_days_program_idx").on(t.programId)]
);

export type SetSchemeMetaJson = {
  summary?: string;
  howTo?: string;
  plannedSets?: Array<{
    reps: string;
    rpe?: string;
    role?: string;
    tempo?: string;
    restSec?: number;
    note?: string;
  }>;
  tempo?: string;
  drops?: number;
  clusterReps?: string;
  clusterIntraRestSec?: number;
  clusters?: number;
  contrastPairs?: number;
  complexMovements?: string[];
  partnerHint?: string;
  emomMinutes?: number;
  /** Multi-exercise group programming */
  group?: {
    kind: string;
    label: string;
    rounds: number;
    restBetweenExercisesSec: number;
    restBetweenRoundsSec: number;
  };
};

export const programExercises = pgTable(
  "program_exercises",
  {
    id: text("id").primaryKey(),
    programDayId: text("program_day_id")
      .notNull()
      .references(() => programDays.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    exerciseName: text("exercise_name").notNull(),
    movementPattern: text("movement_pattern"),
    sets: integer("sets").notNull().default(3),
    reps: text("reps").notNull().default("8-10"),
    rpe: text("rpe"),
    restSec: integer("rest_sec"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    isWarmup: boolean("is_warmup").notNull().default(false),
    /** straight | pyramid | reverse_pyramid | drop | contrast | … */
    setScheme: text("set_scheme").notNull().default("straight"),
    setSchemeMeta: jsonb("set_scheme_meta").$type<SetSchemeMetaJson | null>(),
    /** Shared id for multi-exercise schemes (contrast, complex, superset) */
    groupId: text("group_id"),
    groupKind: text("group_kind"),
    groupLabel: text("group_label"),
    /** Order within the group (0 = first movement) */
    groupOrder: integer("group_order"),
    /** Rest after this exercise before the next in the same round */
    restAfterSec: integer("rest_after_sec"),
    /** Rest after completing a full round (usually set on last member) */
    restBetweenRoundsSec: integer("rest_between_rounds_sec"),
    /** Role inside group: heavy, explosive, A, B, complex-1… */
    groupRole: text("group_role"),
  },
  (t) => [index("program_exercises_day_idx").on(t.programDayId)]
);

/** Logged training sessions (from a program day or ad-hoc later) */
export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    programId: text("program_id").references(() => programs.id, { onDelete: "set null" }),
    programDayId: text("program_day_id").references(() => programDays.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: text("status").notNull().default("in_progress"), // in_progress | completed | cancelled
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
    durationMin: integer("duration_min"),
    overallRpe: text("overall_rpe"),
    painNotes: text("pain_notes"),
    notes: text("notes"),
    /** Booking this floor log was started from (optional) */
    appointmentId: text("appointment_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sessions_org_idx").on(t.organizationId),
    index("sessions_client_idx").on(t.clientId),
    index("sessions_program_idx").on(t.programId),
    index("sessions_appointment_idx").on(t.appointmentId),
  ]
);

export type SessionSetLog = {
  setIndex: number;
  reps: string;
  weightKg: number | null;
  rpe: string | null;
  completed: boolean;
  /** Set role within scheme: top, drop-1, explosive, eccentric… */
  role?: string | null;
  tempo?: string | null;
  restSec?: number | null;
  note?: string | null;
  /** Floor pain flag for this set */
  pain?: boolean | null;
};

export const sessionExerciseLogs = pgTable(
  "session_exercise_logs",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    programExerciseId: text("program_exercise_id").references(() => programExercises.id, {
      onDelete: "set null",
    }),
    exerciseId: text("exercise_id").references(() => exercises.id, { onDelete: "set null" }),
    exerciseName: text("exercise_name").notNull(),
    movementPattern: text("movement_pattern"),
    sortOrder: integer("sort_order").notNull().default(0),
    isWarmup: boolean("is_warmup").notNull().default(false),
    plannedSets: integer("planned_sets"),
    plannedReps: text("planned_reps"),
    actualSets: integer("actual_sets"),
    actualReps: text("actual_reps"),
    weightKg: real("weight_kg"),
    rpe: text("rpe"),
    completed: boolean("completed").notNull().default(false),
    notes: text("notes"),
    /** Per-set log: [{ setIndex, reps, weightKg, rpe, completed, role? }] */
    setLogs: jsonb("set_logs").$type<SessionSetLog[]>().notNull().default([]),
    setScheme: text("set_scheme").default("straight"),
    setSchemeMeta: jsonb("set_scheme_meta").$type<SetSchemeMetaJson | null>(),
    groupId: text("group_id"),
    groupKind: text("group_kind"),
    groupLabel: text("group_label"),
    groupOrder: integer("group_order"),
    restAfterSec: integer("rest_after_sec"),
    restBetweenRoundsSec: integer("rest_between_rounds_sec"),
    groupRole: text("group_role"),
  },
  (t) => [index("session_logs_session_idx").on(t.sessionId)]
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  clients: many(clients),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  measurements: many(clientMeasurements),
  assessments: many(clientAssessments),
  notes: many(clientNotes),
}));
