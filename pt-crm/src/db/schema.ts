import { relations, sql } from "drizzle-orm";
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
  /** solo = individual PT practice · studio = multi-trainer team */
  kind: text("kind").notNull().default("studio"), // solo | studio
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
  (t) => [
    uniqueIndex("memberships_user_org_uidx").on(t.userId, t.organizationId),
    index("memberships_org_idx").on(t.organizationId),
  ]
);

/**
 * Studio invites — owner/admin invites a PT by email; accept via /invite/[token].
 * status: pending | accepted | revoked | expired
 */
export const orgInvites = pgTable(
  "org_invites",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("trainer"), // trainer | admin | front_desk
    token: text("token").notNull().unique(),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("org_invites_org_idx").on(t.organizationId),
    index("org_invites_email_idx").on(t.email),
    uniqueIndex("org_invites_token_uidx").on(t.token),
  ]
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
    avatarUrl: text("avatar_url"),
    notificationPreferences: jsonb("notification_preferences").$type<{
      sessionReminders?: boolean;
      invoiceAlerts?: boolean;
      programUpdates?: boolean;
    } | null>(),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("clients_org_idx").on(t.organizationId),
    index("clients_name_idx").on(t.organizationId, t.firstName, t.lastName),
    index("clients_org_status_idx").on(t.organizationId, t.status),
    // Unique (org, email) when email is non-empty is applied in ensureSchema (partial index).
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
  (t) => [
    index("measurements_client_idx").on(t.clientId),
    index("measurements_client_taken_idx").on(t.clientId, t.takenAt),
  ]
);

export const assessmentTemplates = pgTable(
  "assessment_templates",
  {
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
  },
  (t) => [
    index("assessment_templates_org_idx").on(t.organizationId),
    index("assessment_templates_slug_idx").on(t.slug),
  ]
);

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
  (t) => [
    index("assessments_client_idx").on(t.clientId),
    index("assessments_template_idx").on(t.templateId),
    index("assessments_client_taken_idx").on(t.clientId, t.takenAt),
  ]
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
  (t) => [
    index("notes_client_idx").on(t.clientId),
    index("notes_author_idx").on(t.authorUserId),
    index("notes_conversation_idx").on(t.conversationId),
    index("notes_client_created_idx").on(t.clientId, t.createdAt),
  ]
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
  (t) => [
    index("packages_client_idx").on(t.clientId),
    index("packages_client_status_idx").on(t.clientId, t.status),
  ]
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
    /**
     * Pack that was debited for this appointment (shared debit key with floor).
     * Set when calendar complete or floor complete burns a credit — prevents double burn.
     */
    packageId: text("package_id").references(() => clientPackages.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("appointments_client_idx").on(t.clientId),
    index("appointments_starts_idx").on(t.startsAt),
    index("appointments_session_idx").on(t.sessionId),
    index("appointments_status_idx").on(t.status),
    index("appointments_client_status_idx").on(t.clientId, t.status),
    index("appointments_package_idx").on(t.packageId),
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
    dueAt: timestamp("due_at", { withTimezone: true }),
    paymentUrl: text("payment_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invoices_org_idx").on(t.organizationId),
    index("invoices_client_idx").on(t.clientId),
    index("invoices_status_idx").on(t.status),
    index("invoices_package_idx").on(t.packageId),
    index("invoices_org_status_idx").on(t.organizationId, t.status),
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
  (t) => [
    index("checkins_client_idx").on(t.clientId),
    index("checkins_author_idx").on(t.authorUserId),
    index("checkins_client_created_idx").on(t.clientId, t.createdAt),
  ]
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
    index("tasks_org_status_due_idx").on(t.organizationId, t.status, t.dueAt),
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
  (t) => [
    index("conversations_org_idx").on(t.organizationId),
    index("conversations_user_idx").on(t.userId),
    index("conversations_client_idx").on(t.clientId),
    index("conversations_org_updated_idx").on(t.organizationId, t.updatedAt),
  ]
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
  (t) => [
    index("messages_conversation_idx").on(t.conversationId),
    index("messages_conv_created_idx").on(t.conversationId, t.createdAt),
  ]
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
  (t) => [
    index("playbooks_slug_idx").on(t.slug),
    index("playbooks_org_idx").on(t.organizationId),
  ]
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
    index("org_equipment_equipment_idx").on(t.equipmentId),
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
    /** primary | secondary | corrective | warmup | cooldown | accessory */
    exerciseCategory: text("exercise_category").notNull().default("primary"),
    /** Injury / deficiency slugs that strictly forbid this exercise */
    contraindications: jsonb("contraindications").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("exercises_pattern_idx").on(t.movementPattern),
    index("exercises_org_idx").on(t.organizationId),
  ]
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
    /** Active mesocycle row (no FK — circular with mesocycles.program_id) */
    currentMesocycleId: text("current_mesocycle_id"),
    /** org | client | combined */
    facilityEquipmentMode: text("facility_equipment_mode").notNull().default("org"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("programs_org_idx").on(t.organizationId),
    index("programs_client_idx").on(t.clientId),
    index("programs_created_by_idx").on(t.createdByUserId),
    index("programs_client_status_idx").on(t.clientId, t.status),
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
  (t) => [
    index("program_days_program_idx").on(t.programId),
    index("program_days_program_day_idx").on(t.programId, t.dayIndex),
  ]
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
  (t) => [
    index("program_exercises_day_idx").on(t.programDayId),
    index("program_exercises_exercise_idx").on(t.exerciseId),
    index("program_exercises_day_sort_idx").on(t.programDayId, t.sortOrder),
  ]
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
    /** Pack credit burned on complete (optional; for exact restore) */
    packageId: text("package_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sessions_org_idx").on(t.organizationId),
    index("sessions_client_idx").on(t.clientId),
    index("sessions_program_idx").on(t.programId),
    index("sessions_appointment_idx").on(t.appointmentId),
    index("sessions_program_day_idx").on(t.programDayId),
    index("sessions_created_by_idx").on(t.createdByUserId),
    index("sessions_package_idx").on(t.packageId),
    index("sessions_org_status_idx").on(t.organizationId, t.status),
    index("sessions_client_status_performed_idx").on(t.clientId, t.status, t.performedAt),
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
  (t) => [
    index("session_logs_session_idx").on(t.sessionId),
    index("session_logs_exercise_idx").on(t.exerciseId),
    index("session_logs_program_exercise_idx").on(t.programExerciseId),
    index("session_logs_session_sort_idx").on(t.sessionId, t.sortOrder),
  ]
);

export const gymFacilities = pgTable(
  "gym_facilities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    brand: text("brand"),
    city: text("city").notNull(),
    region: text("region"),
    country: text("country").notNull().default("SG"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("gym_facilities_slug_uidx").on(t.slug),
    index("gym_facilities_city_idx").on(t.city),
  ]
);

export const marketplaceProfiles = pgTable(
  "marketplace_profiles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    headline: text("headline").notNull().default(""),
    bio: text("bio").notNull().default(""),
    credentials: text("credentials").notNull().default(""),
    specialties: text("specialties").notNull().default(""),
    hourlyRateCents: integer("hourly_rate_cents"),
    sessionRateCents: integer("session_rate_cents"),
    currency: text("currency").notNull().default("SGD"),
    preferredArea: text("preferred_area"),
    serviceModes: text("service_modes").notNull().default("studio,at_gym"),
    city: text("city").notNull().default(""),
    region: text("region"),
    country: text("country").notNull().default("SG"),
    lat: real("lat"),
    lng: real("lng"),
    radiusKm: integer("radius_km").notNull().default(15),
    published: boolean("published").notNull().default(false),
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("marketplace_profiles_user_org_uidx").on(t.userId, t.organizationId),
    index("marketplace_profiles_published_idx").on(t.published),
  ]
);

export const marketplaceProfileFacilities = pgTable(
  "marketplace_profile_facilities",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => marketplaceProfiles.id, { onDelete: "cascade" }),
    facilityId: text("facility_id")
      .notNull()
      .references(() => gymFacilities.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("mpf_profile_facility_uidx").on(t.profileId, t.facilityId),
    index("mpf_facility_idx").on(t.facilityId),
  ]
);

export const introRequests = pgTable(
  "intro_requests",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => marketplaceProfiles.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seekerEmail: text("seeker_email").notNull(),
    seekerName: text("seeker_name").notNull(),
    seekerPhone: text("seeker_phone"),
    city: text("city"),
    lat: real("lat"),
    lng: real("lng"),
    facilityId: text("facility_id").references(() => gymFacilities.id, {
      onDelete: "set null",
    }),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    acceptedClientId: text("accepted_client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    index("intro_requests_org_status_idx").on(t.organizationId, t.status),
    index("intro_requests_email_created_idx").on(t.seekerEmail, t.createdAt),
  ]
);

export const platformCharges = pgTable(
  "platform_charges",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    introRequestId: text("intro_request_id").references(() => introRequests.id, {
      onDelete: "set null",
    }),
    profileId: text("profile_id").references(() => marketplaceProfiles.id, {
      onDelete: "set null",
    }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull().default("due"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    paymentUrl: text("payment_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("platform_charges_org_status_idx").on(t.organizationId, t.status)]
);

export const seekerProfiles = pgTable(
  "seeker_profiles",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    city: text("city"),
    preferredArea: text("preferred_area"),
    lat: real("lat"),
    lng: real("lng"),
    radiusKm: integer("radius_km").notNull().default(15),
    preferredFacilityId: text("preferred_facility_id").references(
      () => gymFacilities.id,
      { onDelete: "set null" }
    ),
    preferredBrand: text("preferred_brand"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("seeker_profiles_email_uidx").on(t.email)]
);

export const seekerMeasurements = pgTable(
  "seeker_measurements",
  {
    id: text("id").primaryKey(),
    seekerId: text("seeker_id")
      .notNull()
      .references(() => seekerProfiles.id, { onDelete: "cascade" }),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
    heightCm: real("height_cm"),
    weightKg: real("weight_kg"),
    waistCm: real("waist_cm"),
    notes: text("notes"),
  },
  (t) => [index("seeker_measurements_seeker_idx").on(t.seekerId, t.takenAt)]
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
  deficiencies: many(clientDeficiencies),
  equipment: many(clientEquipment),
}));

export const clientAssessmentsRelations = relations(
  clientAssessments,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [clientAssessments.clientId],
      references: [clients.id],
    }),
    deficiencies: many(clientDeficiencies),
  })
);

/** Master library of movement syndromes used by the smarter generator */
export const deficiencyCatalog = pgTable("deficiency_catalog", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull().default("postural"),
  description: text("description"),
  assessmentCriteria: jsonb("assessment_criteria").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientDeficiencies = pgTable(
  "client_deficiencies",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    deficiencySlug: text("deficiency_slug").notNull(),
    source: text("source").notNull().default("assessment"),
    assessmentId: text("assessment_id").references(() => clientAssessments.id, {
      onDelete: "set null",
    }),
    severity: text("severity").notNull().default("moderate"),
    status: text("status").notNull().default("active"),
    affectedSide: text("affected_side").default("bilateral"),
    notes: text("notes"),
    identifiedAt: timestamp("identified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("client_deficiencies_org_client_status_idx").on(
      t.organizationId,
      t.clientId,
      t.status
    ),
    index("client_deficiencies_client_slug_idx").on(t.clientId, t.deficiencySlug),
    uniqueIndex("client_deficiencies_client_slug_active_uidx")
      .on(t.clientId, t.deficiencySlug)
      .where(sql`status = 'active'`),
  ]
);

export const clientEquipment = pgTable(
  "client_equipment",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipmentItems.id, { onDelete: "cascade" }),
    available: boolean("available").notNull().default(true),
    locationLabel: text("location_label").default("home_gym"),
  },
  (t) => [
    uniqueIndex("client_equipment_uidx").on(
      t.clientId,
      t.equipmentId,
      t.locationLabel
    ),
    index("client_equipment_client_idx").on(t.clientId),
  ]
);

export const exerciseDeficiencyMappings = pgTable(
  "exercise_deficiency_mappings",
  {
    id: text("id").primaryKey(),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    deficiencySlug: text("deficiency_slug").notNull(),
    role: text("role").notNull().default("corrective"),
    effectivenessRank: integer("effectiveness_rank").notNull().default(1),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("ex_def_mapping_uidx").on(t.exerciseId, t.deficiencySlug),
    index("ex_def_mapping_slug_idx").on(t.deficiencySlug),
  ]
);

export const exerciseEquipment = pgTable(
  "exercise_equipment",
  {
    id: text("id").primaryKey(),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipmentItems.id, { onDelete: "cascade" }),
    isRequired: boolean("is_required").notNull().default(true),
  },
  (t) => [
    uniqueIndex("ex_eq_uidx").on(t.exerciseId, t.equipmentId),
    index("ex_eq_equipment_idx").on(t.equipmentId),
  ]
);

export const mesocycles = pgTable(
  "mesocycles",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    mesocycleNumber: integer("mesocycle_number").notNull().default(1),
    phase: text("phase").notNull().default("corrective_prep"),
    name: text("name").notNull(),
    durationWeeks: integer("duration_weeks").notNull().default(4),
    status: text("status").notNull().default("active"),
    targetDeficiencies: jsonb("target_deficiencies").$type<string[]>().notNull().default([]),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mesocycles_program_number_uidx").on(t.programId, t.mesocycleNumber),
    index("mesocycles_program_status_idx").on(t.programId, t.status),
  ]
);

export const programCorrectivePrescriptions = pgTable(
  "program_corrective_prescriptions",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    mesocycleId: text("mesocycle_id").references(() => mesocycles.id, {
      onDelete: "set null",
    }),
    clientDeficiencyId: text("client_deficiency_id").references(
      () => clientDeficiencies.id,
      { onDelete: "set null" }
    ),
    deficiencySlug: text("deficiency_slug").notNull(),
    exerciseId: text("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    prescribedExerciseName: text("prescribed_exercise_name").notNull(),
    placement: text("placement").notNull().default("warmup"),
    prescribedSets: integer("prescribed_sets").notNull().default(2),
    prescribedReps: text("prescribed_reps").notNull().default("10-12"),
    status: text("status").notNull().default("prescribed"),
    rationale: text("rationale"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("prog_corr_program_idx").on(t.programId),
    index("prog_corr_deficiency_idx").on(t.clientDeficiencyId),
  ]
);

export const deficiencyCatalogRelations = relations(
  deficiencyCatalog,
  ({ many }) => ({
    mappings: many(exerciseDeficiencyMappings),
  })
);

export const clientDeficienciesRelations = relations(
  clientDeficiencies,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [clientDeficiencies.organizationId],
      references: [organizations.id],
    }),
    client: one(clients, {
      fields: [clientDeficiencies.clientId],
      references: [clients.id],
    }),
    assessment: one(clientAssessments, {
      fields: [clientDeficiencies.assessmentId],
      references: [clientAssessments.id],
    }),
    prescriptions: many(programCorrectivePrescriptions),
  })
);

export const clientEquipmentRelations = relations(clientEquipment, ({ one }) => ({
  client: one(clients, {
    fields: [clientEquipment.clientId],
    references: [clients.id],
  }),
  equipment: one(equipmentItems, {
    fields: [clientEquipment.equipmentId],
    references: [equipmentItems.id],
  }),
}));

export const exerciseDeficiencyMappingsRelations = relations(
  exerciseDeficiencyMappings,
  ({ one }) => ({
    exercise: one(exercises, {
      fields: [exerciseDeficiencyMappings.exerciseId],
      references: [exercises.id],
    }),
  })
);

export const exerciseEquipmentRelations = relations(
  exerciseEquipment,
  ({ one }) => ({
    exercise: one(exercises, {
      fields: [exerciseEquipment.exerciseId],
      references: [exercises.id],
    }),
    equipment: one(equipmentItems, {
      fields: [exerciseEquipment.equipmentId],
      references: [equipmentItems.id],
    }),
  })
);

export const mesocyclesRelations = relations(mesocycles, ({ one, many }) => ({
  program: one(programs, {
    fields: [mesocycles.programId],
    references: [programs.id],
  }),
  prescriptions: many(programCorrectivePrescriptions),
}));

export const programCorrectivePrescriptionsRelations = relations(
  programCorrectivePrescriptions,
  ({ one }) => ({
    program: one(programs, {
      fields: [programCorrectivePrescriptions.programId],
      references: [programs.id],
    }),
    mesocycle: one(mesocycles, {
      fields: [programCorrectivePrescriptions.mesocycleId],
      references: [mesocycles.id],
    }),
    clientDeficiency: one(clientDeficiencies, {
      fields: [programCorrectivePrescriptions.clientDeficiencyId],
      references: [clientDeficiencies.id],
    }),
    exercise: one(exercises, {
      fields: [programCorrectivePrescriptions.exerciseId],
      references: [exercises.id],
    }),
  })
);

export const exercisesRelations = relations(exercises, ({ many }) => ({
  deficiencyMappings: many(exerciseDeficiencyMappings),
  requiredEquipment: many(exerciseEquipment),
  prescriptions: many(programCorrectivePrescriptions),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [programs.organizationId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [programs.clientId],
    references: [clients.id],
  }),
  mesocycles: many(mesocycles),
  correctivePrescriptions: many(programCorrectivePrescriptions),
}));

export const equipmentItemsRelations = relations(equipmentItems, ({ many }) => ({
  clientEquipment: many(clientEquipment),
  exerciseEquipment: many(exerciseEquipment),
}));

/** Isolated client-portal sessions (never reuse trainer JWT). */
export const clientSessions = pgTable(
  "client_sessions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("client_sessions_token_uidx").on(t.token),
    index("client_sessions_org_client_idx").on(t.organizationId, t.clientId),
    index("client_sessions_expires_idx").on(t.expiresAt),
  ]
);

export const clientOtps = pgTable(
  "client_otps",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("client_otps_email_org_idx").on(t.email, t.organizationId),
    index("client_otps_client_idx").on(t.clientId),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_client_read_idx").on(t.clientId, t.readAt),
    index("notifications_org_client_idx").on(t.organizationId, t.clientId),
  ]
);

export const clientDocuments = pgTable(
  "client_documents",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("pending"),
    documentVersion: text("document_version").notNull().default("1"),
    documentHash: text("document_hash"),
    signatureData: text("signature_data"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("client_documents_client_status_idx").on(t.clientId, t.status),
    index("client_documents_org_client_idx").on(t.organizationId, t.clientId),
  ]
);
