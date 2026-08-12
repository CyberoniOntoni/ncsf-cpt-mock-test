# Smarter Exercise Program Generator: Master Technical Blueprint & Implementation Plan

---

## 1. Executive Summary & Product Vision

### Overview
The **Smarter Exercise Program Generator** is a deterministic Rule-Based Expert System engineered for the FloorScribe / PT-CRM platform. It transforms exercise programming from basic heuristic templating into an automated, movement-aware clinical generator. By analyzing a client's biomechanical footprint—physical measurements, assessment screens, self-reported health history, functional deficiencies, and available equipment—the engine auto-generates evidence-based, safety-filtered mesocycle programs tailored to individual movement capabilities.

### Core Objectives
1. **Automated Assessment & Measurement Ingestion**:
   - Parse physical measurements (`client_measurements`: height, weight, body fat %, girths, calculated BMI, waist-to-hip ratio) and assessment screens (`client_assessments`: Overhead Squat, Apley Back Scratch, Ankle Dorsiflexion, Static Posture) alongside self-reported medical notes into a unified `ClientEvaluationContext` using safe nullish coalescing (`ctx.assessments ?? []`, `ctx.measurements ?? null`).
2. **Deterministic Movement Deficiency Diagnosis & Goal-Aware Mesocycle 1 Phase Determination**:
   - Map assessment failures and physical measurement indicators to standardized movement syndromes:
     - **Upper Cross Syndrome (UCS)**
     - **Lower Cross Syndrome (LCS)**
     - **Ankle Dorsiflexion Restriction**
     - **Knee Valgus Collapse**
     - **Forward Head Posture / Cervical Extension**
     - **High BMI & Joint Loading Risk**
     - **Abdominal Adiposity & Core Restriction**
   - Automatically select Mesocycle 1 phase based on diagnosed deficiencies: default to `"corrective_prep"` when deficiencies are present, and fall back cleanly to `"general_prep"` (or goal-matched phase) when 0 deficiencies are detected.
3. **Mesocycle 1 Corrective Prescriptions & Primary Block Modifications**:
   - **RAMP Warm-up Primer Injections**: Prepend up to 2 targeted corrective/mobility exercises per workout day into the Warm-up (Prep) block during Mesocycle 1. If detected correctives exceed 2 per day, execute a deterministic prioritization algorithm (severity rank: `severe` > `moderate` > `mild`, plus recency) and day-by-day rotation scheme.
   - **RAMP Warm-up Hard Safety Check**: Run `enforceHardSafetyGates` on corrective exercise candidates *prior* to warm-up block injection to ensure zero contraindication leakage.
   - **Primary Exercise Block Modifications**: Automatically modify compound movement patterns during Mesocycle 1 (e.g. substituting Back Squats with Goblet/Box Squats for ankle/lumbar limitations, or Overhead Presses with Landmine Presses for shoulder/thoracic impingement risks).
4. **Multi-Tiered Equipment Filtering & Reconciled Secondary Pattern Substitution**:
   - Intersect organization inventory (`org_equipment`), client-specific facility/home gym gear (`client_equipment`), and exercise requirements (`exercise_equipment` / `equipment_ids`) to ensure 100% executable program output.
   - Execute a **Secondary Movement Pattern Substitution Matrix** when primary movement candidate pools are exhausted due to equipment or safety constraints.
   - Throw a structured `InsufficientSafeExercisesError` and display an interactive `<InsufficientSafeExercisesModal>` dialog in `ProgramWizard` only when candidate pools for BOTH primary AND secondary movement patterns are completely exhausted.
5. **Hardened Safety Contraindication Gates**:
   - Enforce non-bypassable safety gates (`enforceHardSafetyGates`) that inspect structured `ctx.detectedDeficiencies` alongside free-text fields (`injuriesText`, `contraindicationsText`).
   - Perform normalized string comparisons (converting underscores to spaces, stripping special characters) to eliminate silent slug-matching bypasses.
   - Expand hardcoded forbidden keyword/tag rules to cover high-risk exercises (e.g. `Jefferson Curl`, `Behind-Neck Pulldown`, `Stiff Leg Deadlift`, `French Press`).
   - Enforce hard safety gates inside `<ExerciseBankPicker>` during manual trainer exercise swaps.
6. **Complete Schema & Default Catalog Seeds**:
   - Export Drizzle `relations()` for all 7 new database tables and update reciprocal relations across existing schema.
   - Include SQL `INSERT INTO deficiency_catalog` default seed statements in browser PGlite migration v18.
7. **Trainer Transparency & Override Suite**:
   - Provide full UI visibility via a **Rule Audit Card** in the `ProgramWizard`, showing which rules fired, correctives assigned, and contraindications blocked, while allowing inline exercise swapping, pinning (locking), and rule toggles.

---

## 2. R1. Architecture & Component Impact Blueprint

### 2.1 Component Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  DATA INGESTION LAYER                                  │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │ client_measurements   │  │  client_assessments   │  │  clients (injuries, text)  │  │
│  │ (height, weight, BMI, │  │ (OHS, DF Wall, Apley) │  │  + ctx.detectedDeficiencies│  │
│  │  bodyfat %, WHR)      │  │                       │  │                            │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └─────────────┬──────────────┘  │
│              │                          │                            │                 │
│              │   ┌──────────────────────┴────────────────────┐       │                 │
│              └───►  org_equipment ∩ client_equipment        ├───────┘                 │
│                  └──────────────────────┬────────────────────┘                         │
└─────────────────────────────────────────┼──────────────────────────────────────────────┘
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                            DETERMINISTIC RULE ENGINE CORE                              │
│                    (src/lib/smarter-rule-engine.ts)                                   │
│  1. Evaluate Deficiency & Measurement Matrix (Nullish Safe ctx.assessments ?? [])      │
│  2. Determine Mesocycle 1 Phase (0 deficiencies -> "general_prep", >0 -> "corrective") │
│  3. Prioritize & Rotate Correctives (Severity: severe > moderate > mild, max 2/day)    │
│  4. Run enforceHardSafetyGates on Correctives BEFORE RAMP Warm-up Injection            │
│  5. Filter Primary Candidates (String Normalization: '_' -> ' ', Expanded Keywords)     │
│  6. Execute Secondary Movement Pattern Substitution Matrix if candidate pool = 0       │
│  7. Throw InsufficientSafeExercisesError if both primary & secondary pools = 0          │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                            PROGRAM BUILDER & SERVER ACTIONS                            │
│                    (src/lib/program-builder.ts & src/app/actions/programs.ts)          │
│  1. buildProgramDraft() Extended Pipeline                                             │
│  2. DB Transaction: Write programs, program_days, program_exercises                    │
│  3. Persist client_deficiencies, mesocycles, program_corrective_prescriptions          │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND UI & OVERRIDE SUITE                              │
│                    (src/components/ & src/app/(app)/)                                  │
│  1. <ClientDeficiencySelector> & <ClientEquipmentPicker>                               │
│  2. ProgramWizard Step 1: Rule Audit Card & <InsufficientSafeExercisesModal>           │
│  3. ProgramWizard Step 2: Corrective Badges, Swap with Safety Gating & Pin Locks       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Database Schema Expansion (`src/db/schema.ts` & `src/db/index.ts`)

To support normalized deficiency tracking, equipment profiles, mesocycle lifecycle tracking, prescription output auditing, and relational queries, **7 new tables**, **2 table extensions**, and **complete Drizzle `relations()` exports** are added to `src/db/schema.ts` and mirrored in `src/db/index.ts`.

#### New Tables & Relations in `src/db/schema.ts`

```typescript
import { relations } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
// Note: Base tables (organizations, clients, exercises, equipmentItems, clientAssessments, clientMeasurements, clientNotes, programs) are defined in src/db/schema.ts

// 1. Deficiency Catalog (Master library of standardized movement syndromes)
export const deficiencyCatalog = pgTable("deficiency_catalog", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(), // e.g., "upper_cross_syndrome"
  name: text("name").notNull(),
  category: text("category").notNull().default("postural"), // postural | mobility | stability | motor_control | joint_stress
  description: text("description"),
  assessmentCriteria: jsonb("assessment_criteria").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 2. Client Deficiencies (Diagnosed or trainer-flagged client movement deficiencies)
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
    source: text("source").notNull().default("assessment"), // assessment | measurement | trainer_override | intake_history
    assessmentId: text("assessment_id").references(() => clientAssessments.id, { onDelete: "set null" }),
    severity: text("severity").notNull().default("moderate"), // mild | moderate | severe
    status: text("status").notNull().default("active"), // active | improving | resolved | archived
    affectedSide: text("affected_side").default("bilateral"), // left | right | bilateral
    notes: text("notes"),
    identifiedAt: timestamp("identified_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("client_deficiencies_org_client_status_idx").on(t.organizationId, t.clientId, t.status),
    index("client_deficiencies_client_slug_idx").on(t.clientId, t.deficiencySlug),
  ]
);

// 3. Client Equipment (Per-client facility/home equipment inventory)
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
    locationLabel: text("location_label").default("home_gym"), // home_gym | travel | studio
  },
  (t) => [
    uniqueIndex("client_equipment_uidx").on(t.clientId, t.equipmentId, t.locationLabel),
    index("client_equipment_client_idx").on(t.clientId),
  ]
);

// 4. Exercise Deficiency Mappings (Relational link mapping exercises to targeted deficiencies)
export const exerciseDeficiencyMappings = pgTable(
  "exercise_deficiency_mappings",
  {
    id: text("id").primaryKey(),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    deficiencySlug: text("deficiency_slug").notNull(),
    role: text("role").notNull().default("corrective"), // corrective | primary_contraindicated | secondary_beneficial
    effectivenessRank: integer("effectiveness_rank").notNull().default(1), // 1 = gold standard
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("ex_def_mapping_uidx").on(t.exerciseId, t.deficiencySlug),
    index("ex_def_mapping_slug_idx").on(t.deficiencySlug),
  ]
);

// 5. Exercise Equipment Junction (Relational normalization for exercise required equipment)
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

// 6. Mesocycles (Explicit program mesocycle blocks)
export const mesocycles = pgTable(
  "mesocycles",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    mesocycleNumber: integer("mesocycle_number").notNull().default(1),
    phase: text("phase").notNull().default("corrective_prep"), // corrective_prep | general_prep | hypertrophy | strength_build | peaking | deload
    name: text("name").notNull(),
    durationWeeks: integer("duration_weeks").notNull().default(4),
    status: text("status").notNull().default("active"), // draft | active | completed | skipped
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

// 7. Program Corrective Prescriptions (Audit log of generated Mesocycle 1 correctives)
export const programCorrectivePrescriptions = pgTable(
  "program_corrective_prescriptions",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    mesocycleId: text("mesocycle_id").references(() => mesocycles.id, { onDelete: "set null" }),
    clientDeficiencyId: text("client_deficiency_id").references(() => clientDeficiencies.id, { onDelete: "set null" }),
    deficiencySlug: text("deficiency_slug").notNull(),
    exerciseId: text("exercise_id").references(() => exercises.id, { onDelete: "set null" }),
    prescribedExerciseName: text("prescribed_exercise_name").notNull(),
    placement: text("placement").notNull().default("warmup"), // warmup | primary_main | cooldown
    prescribedSets: integer("prescribed_sets").notNull().default(2),
    prescribedReps: text("prescribed_reps").notNull().default("10-12"),
    status: text("status").notNull().default("prescribed"), // prescribed | trainer_accepted | trainer_modified | trainer_removed
    rationale: text("rationale"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("prog_corr_program_idx").on(t.programId),
    index("prog_corr_deficiency_idx").on(t.clientDeficiencyId),
  ]
);

// Drizzle Relations Definitions for All 7 New Tables
export const deficiencyCatalogRelations = relations(deficiencyCatalog, ({ many }) => ({
  mappings: many(exerciseDeficiencyMappings),
}));

export const clientDeficienciesRelations = relations(clientDeficiencies, ({ one, many }) => ({
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
}));

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

export const exerciseDeficiencyMappingsRelations = relations(exerciseDeficiencyMappings, ({ one }) => ({
  exercise: one(exercises, {
    fields: [exerciseDeficiencyMappings.exerciseId],
    references: [exercises.id],
  }),
}));

export const exerciseEquipmentRelations = relations(exerciseEquipment, ({ one }) => ({
  exercise: one(exercises, {
    fields: [exerciseEquipment.exerciseId],
    references: [exercises.id],
  }),
  equipment: one(equipmentItems, {
    fields: [exerciseEquipment.equipmentId],
    references: [equipmentItems.id],
  }),
}));

export const mesocyclesRelations = relations(mesocycles, ({ one, many }) => ({
  program: one(programs, {
    fields: [mesocycles.programId],
    references: [programs.id],
  }),
  prescriptions: many(programCorrectivePrescriptions),
}));

export const programCorrectivePrescriptionsRelations = relations(programCorrectivePrescriptions, ({ one }) => ({
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
}));

// Reciprocal Relations Updates for Existing Tables
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
  currentMesocycle: one(mesocycles, {
    fields: [programs.currentMesocycleId],
    references: [mesocycles.id],
  }),
  mesocycles: many(mesocycles),
  correctivePrescriptions: many(programCorrectivePrescriptions),
}));

export const equipmentItemsRelations = relations(equipmentItems, ({ many }) => ({
  clientEquipment: many(clientEquipment),
  exerciseEquipment: many(exerciseEquipment),
}));

export const clientAssessmentsRelations = relations(clientAssessments, ({ one, many }) => ({
  client: one(clients, {
    fields: [clientAssessments.clientId],
    references: [clients.id],
  }),
  deficiencies: many(clientDeficiencies),
}));
```

#### Table Extensions to Existing Schema

1. **`exercises` Table Extensions**:
   - `exerciseCategory`: `text("exercise_category").notNull().default("primary")` (`primary` | `secondary` | `corrective` | `warmup` | `cooldown` | `accessory`).
   - `contraindications`: `jsonb("contraindications").$type<string[]>().notNull().default([])` (array of injury/deficiency keys that strictly forbid this exercise).

2. **`programs` Table Extensions**:
   - `currentMesocycleId`: `text("current_mesocycle_id").references(() => mesocycles.id, { onDelete: "set null" })`.
   - `facilityEquipmentMode`: `text("facility_equipment_mode").notNull().default("org")` (`org` | `client` | `combined`).

#### PGlite Raw DDL Migration Plan & Seeds (`src/db/index.ts`)

In `src/db/index.ts`, `ensureSchema()` executes raw DDL statements for PGlite inside the browser environment. `SCHEMA_VERSION` is incremented from **17** to **18**, appending the following DDL execution and SQL default catalog seed block:

```sql
-- Migration Step v18: Add Smarter Generator Tables, Extensions & Seeds
CREATE TABLE IF NOT EXISTS deficiency_catalog (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'postural',
  description TEXT,
  assessment_criteria JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SQL INSERT INTO deficiency_catalog default seed statements
INSERT INTO deficiency_catalog (id, slug, name, category, description)
VALUES
  ('def_ucs', 'upper_cross_syndrome', 'Upper Cross Syndrome', 'postural', 'Postural distortion involving tight pectorals/upper trapezius and weak deep neck flexors/lower trapezius.'),
  ('def_lcs', 'lower_cross_syndrome', 'Lower Cross Syndrome', 'postural', 'Postural distortion featuring anterior pelvic tilt, tight hip flexors/thoracolumbar extensors, and weak glutes/abdominals.'),
  ('def_ankle_df', 'ankle_mobility_restriction', 'Ankle Dorsiflexion Restriction', 'mobility', 'Restricted talocrural dorsiflexion mobility limiting squat depth and inducing compensation.'),
  ('def_knee_valgus', 'knee_valgus_collapse', 'Knee Valgus Collapse', 'motor_control', 'Medial knee collapse during loaded lower-body movement patterns caused by weak gluteus medius/hip rotators.'),
  ('def_forward_head', 'forward_head_posture', 'Forward Head Posture', 'postural', 'Cervical hyperextension and anterior positioning of head relative to shoulder girdle.'),
  ('def_high_bmi', 'high_bmi_joint_stress', 'High BMI & Joint Loading Risk', 'joint_stress', 'Elevated body mass index requiring joint stress scaling and low-impact compound exercise selection.'),
  ('def_ab_adiposity', 'abdominal_adiposity_core_restriction', 'Abdominal Adiposity & Core Restriction', 'mobility', 'High waist-to-hip ratio necessitating core stability exercises over extreme spinal flexion.')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS client_deficiencies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  deficiency_slug TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'assessment',
  assessment_id TEXT REFERENCES client_assessments(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'moderate',
  status TEXT NOT NULL DEFAULT 'active',
  affected_side TEXT DEFAULT 'bilateral',
  notes TEXT,
  identified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS client_deficiencies_org_client_status_idx ON client_deficiencies(organization_id, client_id, status);
CREATE INDEX IF NOT EXISTS client_deficiencies_client_slug_idx ON client_deficiencies(client_id, deficiency_slug);

CREATE TABLE IF NOT EXISTS client_equipment (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  equipment_id TEXT NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  location_label TEXT DEFAULT 'home_gym'
);
CREATE UNIQUE INDEX IF NOT EXISTS client_equipment_uidx ON client_equipment(client_id, equipment_id, location_label);
CREATE INDEX IF NOT EXISTS client_equipment_client_idx ON client_equipment(client_id);

CREATE TABLE IF NOT EXISTS exercise_deficiency_mappings (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  deficiency_slug TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'corrective',
  effectiveness_rank INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ex_def_mapping_uidx ON exercise_deficiency_mappings(exercise_id, deficiency_slug);
CREATE INDEX IF NOT EXISTS ex_def_mapping_slug_idx ON exercise_deficiency_mappings(deficiency_slug);

CREATE TABLE IF NOT EXISTS exercise_equipment (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  equipment_id TEXT NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX IF NOT EXISTS ex_eq_uidx ON exercise_equipment(exercise_id, equipment_id);
CREATE INDEX IF NOT EXISTS ex_eq_equipment_idx ON exercise_equipment(equipment_id);

CREATE TABLE IF NOT EXISTS mesocycles (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  mesocycle_number INTEGER NOT NULL DEFAULT 1,
  phase TEXT NOT NULL DEFAULT 'corrective_prep',
  name TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'active',
  target_deficiencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS mesocycles_program_number_uidx ON mesocycles(program_id, mesocycle_number);
CREATE INDEX IF NOT EXISTS mesocycles_program_status_idx ON mesocycles(program_id, status);

CREATE TABLE IF NOT EXISTS program_corrective_prescriptions (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  mesocycle_id TEXT REFERENCES mesocycles(id) ON DELETE SET NULL,
  client_deficiency_id TEXT REFERENCES client_deficiencies(id) ON DELETE SET NULL,
  deficiency_slug TEXT NOT NULL,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
  prescribed_exercise_name TEXT NOT NULL,
  placement TEXT NOT NULL DEFAULT 'warmup',
  prescribed_sets INTEGER NOT NULL DEFAULT 2,
  prescribed_reps TEXT NOT NULL DEFAULT '10-12',
  status TEXT NOT NULL DEFAULT 'prescribed',
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS prog_corr_program_idx ON program_corrective_prescriptions(program_id);
CREATE INDEX IF NOT EXISTS prog_corr_deficiency_idx ON program_corrective_prescriptions(client_deficiency_id);

-- Column extensions to existing tables
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_category TEXT NOT NULL DEFAULT 'primary';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS contraindications JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS current_mesocycle_id TEXT REFERENCES mesocycles(id) ON DELETE SET NULL;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS facility_equipment_mode TEXT NOT NULL DEFAULT 'org';
```

---

### 2.3 Server Actions & RSC Error Contracts (`src/app/actions/programs.ts` & `src/lib/errors.ts`)

```typescript
// RSC Serializable Server Action Error Payload Contract
export type ServerActionErrorPayload = {
  code: "INSUFFICIENT_SAFE_EXERCISES" | "VALIDATION_ERROR" | "UNAUTHORIZED" | string;
  message: string;
  details?: {
    movementPattern?: string;
    requiredEquipment?: string[];
    contraindications?: string[];
    candidateCount?: number;
    [key: string]: unknown;
  };
};

export type ServerActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ServerActionErrorPayload };

// Internal Engine Domain Error Class for Candidate Pool Exhaustion
export class InsufficientSafeExercisesError extends Error {
  public readonly movementPattern: string;
  public readonly requiredEquipment: string[];
  public readonly contraindications: string[];
  public readonly candidateCount: number;

  constructor(details: {
    movementPattern: string;
    requiredEquipment?: string[];
    contraindications?: string[];
  }) {
    super(`Insufficient safe exercises available for movement pattern: ${details.movementPattern}. All candidates blocked by equipment or safety gates.`);
    this.name = "InsufficientSafeExercisesError";
    this.movementPattern = details.movementPattern;
    this.requiredEquipment = details.requiredEquipment ?? [];
    this.contraindications = details.contraindications ?? [];
    this.candidateCount = 0;
  }

  public toSerializablePayload(): ServerActionErrorPayload {
    return {
      code: "INSUFFICIENT_SAFE_EXERCISES",
      message: this.message,
      details: {
        movementPattern: this.movementPattern,
        requiredEquipment: this.requiredEquipment,
        contraindications: this.contraindications,
        candidateCount: this.candidateCount,
      },
    };
  }
}

// Input Contract for Smarter Program Generation
export type SmarterGeneratorInput = {
  clientId: string;
  organizationId?: string;
  title?: string;
  goal: "general" | "strength" | "hypertrophy" | "fat_loss" | "mobility";
  daysPerWeek: number; // 2..6
  sessionMinutes: number; // 30, 45, 60, 75
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  mesocycleWeek?: number; // Default 1
  variationSeed?: number;
  notes?: string;
  facilityEquipmentMode?: "org" | "client" | "combined";
  manualDeficiencyOverrides?: string[]; // Array of deficiency slugs to force/ignore
  lockedExerciseIds?: string[]; // Pinned exercises during re-roll
  activate?: boolean;
};

// Comprehensive Output Contract from Rule Engine Evaluation
export type RuleEngineEvaluationResult = {
  clientId: string;
  mesocyclePhase: "corrective_prep" | "general_prep" | "hypertrophy" | "strength_build" | "peaking" | "deload";
  detectedDeficiencies: Array<{
    slug: string;
    name: string;
    category: string;
    severity: "mild" | "moderate" | "severe";
    affectedSide: "left" | "right" | "bilateral";
    source: "assessment" | "measurement" | "history" | "trainer_override";
    triggerDescription: string;
    identifiedAt: Date;
  }>;
  contraindicatedExerciseIds: string[];
  contraindicatedPatterns: string[];
  prescribedCorrectives: Array<{
    deficiencySlug: string;
    placement: "warmup" | "primary_main";
    exerciseId: string;
    exerciseName: string;
    movementPattern: string;
    sets: number;
    reps: string;
    rpe: string;
    restSec: number;
    coachingCues: string;
    rationale: string;
  }>;
  primaryModifications: Array<{
    deficiencySlug: string;
    originalPattern: string;
    substitutedExerciseId: string;
    substitutedExerciseName: string;
    reason: string;
  }>;
  equipmentSummary: {
    mode: "org" | "client" | "combined";
    totalAvailableEquipmentCount: number;
    usableExerciseCount: number;
    excludedExerciseCount: number;
  };
  rulesFired: Array<{
    ruleId: string;
    ruleName: string;
    status: "applied" | "skipped" | "overridden";
    description: string;
  }>;
};

// Server Actions Exposed to Frontend (Returning Serializable Payloads across RSC Boundary)
export async function evaluateClientRulesAction(
  clientId: string,
  opts?: { facilityEquipmentMode?: "org" | "client" | "combined" }
): Promise<ServerActionResult<RuleEngineEvaluationResult>>;

export async function previewSmarterProgramAction(
  input: SmarterGeneratorInput
): Promise<ServerActionResult<{ draft: BuiltProgram; evaluation: RuleEngineEvaluationResult }>>;

export async function createSmarterProgramAction(
  input: SmarterGeneratorInput
): Promise<ServerActionResult<{ programId: string; evaluation: RuleEngineEvaluationResult }>>;

export async function applySmarterCorrectivesAction(
  programId: string,
  opts?: { mesocycleNumber?: number }
): Promise<ServerActionResult<{ insertedCount: number; evaluation: RuleEngineEvaluationResult }>>;
```

#### Transaction Flow & RSC Error Handling

```
[createSmarterProgramAction(input)]
  │
  ├── 1. Auth & Authorization Gate
  │      Verify active trainer session & retrieve tenant organizationId.
  │
  ├── 2. Ingest Context & Run Rule Engine
  │      Call `evaluateClientRules(clientId, opts)` -> returns RuleEngineEvaluationResult.
  │      If 0 deficiencies are detected, mesocyclePhase set to "general_prep".
  │
  ├── 3. Execute buildProgramDraft() Extension
  │      Pass `evaluation` context into `buildProgramDraft()`:
  │      - Filter candidate exercises via equipment & enforceHardSafetyGates.
  │      - Execute Secondary Movement Pattern Substitution Matrix if primary candidate pool = 0.
  │      - Internal `InsufficientSafeExercisesError` thrown if candidate pool = 0 after secondary fallback.
  │      - Inject RAMP warm-up correctives (Block A) post-safety check.
  │
  ├── 4. RSC Error Serialization Guard (try / catch)
  │      Catch internal `InsufficientSafeExercisesError` (or domain error) at Server Action boundary
  │      and return serializable result payload:
  │      `{ success: false, error: { code: "INSUFFICIENT_SAFE_EXERCISES", message: ..., details: ... } }`
  │      Prevents raw Error instances from throwing across Next.js RSC server-client boundary.
  │
  └── 5. Database Transaction (`db.transaction(tx => ...)`):
         ├── tx.insert(programs).values(...) -> Returns programId
         ├── tx.insert(mesocycles).values(...) -> Mesocycle 1 (Phase: evaluation.mesocyclePhase)
         ├── tx.insert(programDays).values(...) -> Training days 1..N
         ├── tx.insert(programExercises).values(...) -> All exercise rows
         ├── tx.insert(clientDeficiencies).values(...) -> Persist detected deficiencies
         └── tx.insert(programCorrectivePrescriptions).values(...) -> Log corrective prescriptions
```

---

### 2.4 UI Components & Error Modal (`src/components/` & `src/app/(app)/`)

#### New & Updated UI Components

1. **`<ClientDeficiencySelector>` (`src/components/client-deficiency-selector.tsx`)**:
   - **Location**: Rendered in `ProgramWizard` (Step 1), `ClientAssessmentsPanel`, and Client Profile (`/clients/[id]`).
   - **Functionality**: Multi-select tag manager for movement deficiencies. Displays auto-detected syndrome chips (`Upper Cross Syndrome`, `Lower Cross Syndrome`, `Ankle Dorsiflexion Restriction`, `Knee Valgus Collapse`, `Forward Head Posture`, `High BMI & Joint Stress`), with severity badge dropdowns (`Mild`, `Moderate`, `Severe`), side toggles (`Left`, `Right`, `Bilateral`), and manual addition search input.
2. **`<ClientEquipmentPicker>` (`src/components/client-equipment-picker.tsx`)**:
   - **Location**: Rendered in `ProgramWizard` (Step 1) and Client Profile.
   - **Functionality**: Facility gear selector toggle (`Organization Floor` vs `Client Home/Facility Gear` vs `Combined`). Includes preset gear chips (`Commercial Gym`, `Home Gym DB + Bands`, `Hotel Gym`, `Bodyweight Only`) and custom equipment category checklists with live exercise bank availability counters (`"134 / 160 exercises usable"`).
3. **`<InsufficientSafeExercisesModal>` (`src/components/insufficient-safe-exercises-modal.tsx`)**:
   - **Location**: Rendered in `ProgramWizard` (triggered on `InsufficientSafeExercisesError`).
   - **Functionality**: Reconciles candidate pool exhaustion by displaying an interactive dialog showing:
     - The blocked movement pattern (e.g., "Overhead Vertical Press").
     - Missing equipment items and active safety contraindications causing the block.
     - Interactive action buttons:
       - **"Expand Equipment Boundary"**: Switches equipment mode to `combined` or `org`.
       - **"Switch Pattern"**: Applies secondary movement pattern override.
       - **"Manual Bank Pick"**: Opens `<ExerciseBankPicker>` for trainer manual pick.

#### Enhancements to Existing Components

1. **`ProgramWizard` (`src/components/program-wizard.tsx`)**:
   - **Step 1 (Constraints & Rules Configuration)**: Integrates `<ClientDeficiencySelector>`, `<ClientEquipmentPicker>`, and handles `InsufficientSafeExercisesError` via `<InsufficientSafeExercisesModal>`.
   - **Step 2 (Generator Preview)**: Renders a comprehensive **Rule Engine Audit Card** ("Why this plan: 2 deficiencies addressed, 3 correctives assigned, 4 contraindications avoided"). Adds `[Corrective: Deficiency Name]` badges and rationale tooltips on warm-up and primary exercise rows.
   - **Inline Swap with Safety Enforcement**: Adds an **Inline Swap Button** on exercise rows opening `<ExerciseBankPicker>`. `<ExerciseBankPicker>` strictly enforces `enforceHardSafetyGates`, rendering contraindicated exercises disabled with a red warning badge (`"Contraindicated for Client"`). Includes a **Lock Toggle (Pin)** button to lock preferred exercises during re-generation.

---

## 3. R2. Technical Logic Gates & Rule Engine Matrix

### 3.1 Data Ingestion Context & Pipeline

The Rule Engine constructs a unified `ClientEvaluationContext` by fetching data across four sources, using safe nullish coalescing for missing optional arrays:

```typescript
export type ClientMeasurementsContext = {
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPct: number | null;
  bmi: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  waistToHipRatio: number | null;
  girthsJson: Record<string, unknown> | null;
};

export type ClientEvaluationContext = {
  client: {
    id: string;
    sex?: "male" | "female";
    injuriesText: string;
    contraindicationsText: string;
    medicalHistoryText: string;
    goalsText: string;
    experienceLevel: string;
  };
  measurements: ClientMeasurementsContext | null;
  assessments: Array<{
    templateSlug: string;
    templateName: string;
    results: Record<string, unknown>;
    takenAt: Date;
  }>; // Ingested via (ctx.assessments ?? [])
  detectedDeficiencies?: Array<{
    slug: string;
    name: string;
    severity: "mild" | "moderate" | "severe";
  }>;
  availableEquipmentIds: string[];
};
```

---

### 3.2 Deterministic Movement Deficiency & Physical Measurement Matrix

The core evaluation matrix parses assessment inputs, clinical indicators, and physical measurements into standardized movement syndromes and physical loading flags:

| Deficiency Code | Name | Trigger Criteria (Assessments / Metrics) | Prescribed Correctives (Mesocycle 1 Warm-up Block) | Primary Exercise Modifications (Mesocycle 1 Main Block) |
|---|---|---|---|---|
| `upper_cross_syndrome` | Upper Cross Syndrome (UCS) | Apley Back Scratch score = `fail` OR Posture screen `forward_head: true` / `rounded_shoulders: true` OR `shoulder` injury text | Band Face Pulls, Prone Y-T-W Extensions, Scapular Wall Slides, Chin Tucks, Pec Doorway Stretch | Swap Barbell Overhead Press to Landmine Press or High-Incline DB Press; swap Heavy Behind-the-Neck pulldowns to Neutral Grip Lat Pulldowns |
| `lower_cross_syndrome` | Lower Cross Syndrome (LCS) | Overhead Squat `lumbar_arch: true` / `excessive_forward_lean: true` OR Posture screen `anterior_pelvic_tilt: true` | Half-Kneeling Hip Flexor Stretch, Glute Bridge with Pause, Deadbug Core Anti-Extension, RKC Plank | Swap Standing Overhead Press to Half-Kneeling Press; swap Conventional Deadlift to Trap Bar Deadlift or Romanian Deadlift with neutral hip hinge cue |
| `ankle_mobility_restriction` | Ankle Dorsiflexion Restriction | Ankle DF Wall Test `< 8cm` OR Overhead Squat `heels_rise: true` | Ankle Joint Knee-to-Wall Mobilizations, Banded Ankle Distraction, Eccentric Calf Stretches | Swap Deep Back Squats to Heel-Elevated Goblet Squats, Box Squats, or Trap Bar Squats |
| `knee_valgus_collapse` | Knee Valgus Collapse | Overhead Squat `knee_valgus: true` OR Single Leg Squat `valgus_collapse: true` | Banded Clamshells, Mini-Band Lateral Monster Walks, Single-Leg Glute Bridges, Wall Sit with Band Tension | Swap Heavy Barbell Back Squat to Mini-Band Resisted Goblet Squats or Bulgarian Split Squats with valgus control cue |
| `forward_head_posture` | Forward Head Posture / Cervical Extension | Posture screen `forward_head: true` OR Cervical Mobility screen restricted | Deep Neck Flexor Wall Chin Tucks, Thoracic Spine Extension Foam Rolling, Cervical Retraction Resisted Holds | Avoid Heavy Barbell Shrugs or Heavy Farmer Carries that induce cervical strain; emphasize Chest-Supported Rows |
| `high_bmi_joint_stress` | High BMI & Joint Loading Risk | Calculated BMI `≥ 30.0` OR Waist-to-Hip Ratio `> 0.95` (men) / `> 0.85` (women) | Low-Impact Dynamic Mobility, Ankle/Knee Isometrics, Seated Scapular Retractions | Cap initial load intensity ceiling to 65-70% 1RM; swap high-impact plyometrics / heavy axial squats with Belt Squats or Leg Press |
| `abdominal_adiposity_core_restriction` | Abdominal Adiposity & Core Restriction | Waist-to-Hip Ratio `> 0.95` OR Waist Circumference `> 102cm` (men) / `> 88cm` (women) | Pallof Press, Bird-Dog, Standing Band Anti-Rotation, Farmer Carries | Avoid deep spinal flexion crunching/sit-ups; substitute standing anti-extension and anti-rotation core stability movements |

#### Deterministic Rule Evaluator Implementation (`src/lib/smarter-rule-engine.ts`)

```typescript
export function evaluateDeficiencyRules(ctx: ClientEvaluationContext): DetectedDeficiency[] {
  const deficiencies: DetectedDeficiency[] = [];
  
  // Safe nullish coalescing
  const assessments = ctx.assessments ?? [];
  const measurements = ctx.measurements ?? null;
  const textBody = normalizeString(`${ctx.client.injuriesText ?? ""} ${ctx.client.contraindicationsText ?? ""} ${ctx.client.medicalHistoryText ?? ""}`);

  // 1. Upper Cross Syndrome Evaluator
  const backScratch = assessments.find((a) => a.templateSlug === "back-scratch" || a.templateSlug === "apley-back-scratch");
  const posture = assessments.find((a) => a.templateSlug === "posture-static");
  const hasShoulderText = /shoulder|impingement|rotator cuff|thoracic/i.test(textBody);

  if (
    (backScratch && (backScratch.results.left === "fail" || backScratch.results.right === "fail")) ||
    (posture && (posture.results.rounded_shoulders === true || posture.results.forward_head === true)) ||
    hasShoulderText
  ) {
    deficiencies.push({
      slug: "upper_cross_syndrome",
      name: "Upper Cross Syndrome",
      category: "postural",
      severity: hasShoulderText ? "severe" : "moderate",
      affectedSide: "bilateral",
      source: backScratch || posture ? "assessment" : "history",
      triggerDescription: "Failed scapular/shoulder mobility screen or reported shoulder/thoracic tightness.",
      identifiedAt: new Date(),
    });
  }

  // 2. Lower Cross Syndrome Evaluator
  const ohs = assessments.find((a) => a.templateSlug === "overhead-squat");
  const hasLumbarText = /lumbar|lower back|pelvis|hip flexor/i.test(textBody);

  if (
    (ohs && (ohs.results.lumbar_arch === true || ohs.results.excessive_lean === true)) ||
    (posture && posture.results.anterior_pelvic_tilt === true) ||
    hasLumbarText
  ) {
    deficiencies.push({
      slug: "lower_cross_syndrome",
      name: "Lower Cross Syndrome",
      category: "postural",
      severity: hasLumbarText ? "severe" : "moderate",
      affectedSide: "bilateral",
      source: ohs || posture ? "assessment" : "history",
      triggerDescription: "Observed anterior pelvic tilt / lumbar lordosis during squat screen or lumbar history.",
      identifiedAt: new Date(),
    });
  }

  // 3. Ankle Dorsiflexion Restriction Evaluator
  const ankleDf = assessments.find((a) => a.templateSlug === "ankle-df-wall");
  const ankleRes = ankleDf?.results as { left_cm?: number; right_cm?: number } | undefined;
  const leftRestricted = typeof ankleRes?.left_cm === "number" && ankleRes.left_cm < 8;
  const rightRestricted = typeof ankleRes?.right_cm === "number" && ankleRes.right_cm < 8;
  const isAnkleRestricted = leftRestricted || rightRestricted;
  const heelsRise = ohs && ohs.results.heels_rise === true;
  const hasAnkleText = /ankle|achilles|calf|dorsiflexion/i.test(textBody);

  if (isAnkleRestricted || heelsRise || hasAnkleText) {
    const leftSevere = typeof ankleRes?.left_cm === "number" && ankleRes.left_cm < 5;
    const rightSevere = typeof ankleRes?.right_cm === "number" && ankleRes.right_cm < 5;
    const affectedSide: "left" | "right" | "bilateral" =
      leftRestricted && rightRestricted ? "bilateral"
      : leftRestricted ? "left"
      : rightRestricted ? "right"
      : "bilateral";

    deficiencies.push({
      slug: "ankle_mobility_restriction",
      name: "Ankle Dorsiflexion Restriction",
      category: "mobility",
      severity: leftSevere || rightSevere ? "severe" : "moderate",
      affectedSide,
      source: ankleDf || ohs ? "assessment" : "history",
      triggerDescription: "Ankle dorsiflexion wall test < 8cm or heel lift observed during overhead squat.",
      identifiedAt: new Date(),
    });
  }

  // 4. Knee Valgus Collapse Evaluator
  const kneeValgus = (ohs && ohs.results.knee_valgus === true) || /valgus|knee collapse|patellofemoral/i.test(textBody);
  if (kneeValgus) {
    deficiencies.push({
      slug: "knee_valgus_collapse",
      name: "Knee Valgus Collapse",
      category: "motor_control",
      severity: "moderate",
      affectedSide: "bilateral",
      source: ohs ? "assessment" : "history",
      triggerDescription: "Medial knee deviation (valgus) detected during overhead squat screen.",
      identifiedAt: new Date(),
    });
  }

  // 5. Forward Head Posture Evaluator
  const forwardHead = posture && posture.results.forward_head === true;
  if (forwardHead && !deficiencies.some((d) => d.slug === "upper_cross_syndrome")) {
    deficiencies.push({
      slug: "forward_head_posture",
      name: "Forward Head Posture",
      category: "postural",
      severity: "mild",
      affectedSide: "bilateral",
      source: "assessment",
      triggerDescription: "Forward cervical projection noted during static posture assessment.",
      identifiedAt: new Date(),
    });
  }

  // 6. Physical Measurement Evaluator: High BMI & Joint Stress Risk
  if (measurements && measurements.heightCm && measurements.weightKg) {
    const heightM = measurements.heightCm / 100;
    const bmi = measurements.bmi ?? (measurements.weightKg / (heightM * heightM));
    const whr = measurements.waistToHipRatio ?? (measurements.waistCm && measurements.hipsCm ? measurements.waistCm / measurements.hipsCm : null);
    const whrThreshold = ctx.client.sex === "female" ? 0.85 : 0.95;

    if (bmi >= 30 || (whr && whr >= whrThreshold)) {
      deficiencies.push({
        slug: "high_bmi_joint_stress",
        name: "High BMI & Joint Loading Risk",
        category: "joint_stress",
        severity: bmi >= 35 ? "severe" : "moderate",
        affectedSide: "bilateral",
        source: "measurement",
        triggerDescription: `Calculated BMI (${bmi.toFixed(1)}) or waist-to-hip ratio (${whr?.toFixed(2) ?? 'N/A'} >= ${whrThreshold}) indicates joint loading risk. Joint stress modifiers applied.`,
        identifiedAt: new Date(),
      });
    }

    // 7. Physical Measurement Evaluator: Abdominal Adiposity & Core Restriction
    if (whr && whr >= whrThreshold) {
      deficiencies.push({
        slug: "abdominal_adiposity_core_restriction",
        name: "Abdominal Adiposity & Core Restriction",
        category: "mobility",
        severity: "moderate",
        affectedSide: "bilateral",
        source: "measurement",
        triggerDescription: `Elevated waist-to-hip ratio (${whr.toFixed(2)} >= ${whrThreshold}) triggers core anti-extension/rotation over spinal compression.`,
        identifiedAt: new Date(),
      });
    }
  }

  return deficiencies;
}
```

---

### 3.3 Equipment Filtering Algorithm

Exercise candidates must satisfy equipment availability bounds. The algorithm computes available equipment IDs by intersecting tenant inventory and client facility profiles.

**Equipment Inventory Sync & Backward Compatibility**:
To ensure 100% complete backward compatibility across all exercise records in FloorScribe, `filterExercisesByEquipment` checks BOTH:
1. The normalized relational `exercise_equipment` junction table (ingested via Drizzle `requiredEquipment` relations).
2. The legacy `exercises.equipment_ids` JSONB array (`ex.equipmentIds`).

```typescript
export function resolveAvailableEquipmentIds(
  mode: "org" | "client" | "combined",
  orgEquipmentIds: string[],
  clientEquipmentIds: string[]
): Set<string> {
  if (mode === "client") {
    return new Set(clientEquipmentIds);
  }
  if (mode === "combined") {
    return new Set([...orgEquipmentIds, ...clientEquipmentIds]);
  }
  // Default 'org'
  return new Set(orgEquipmentIds);
}

/**
 * Equipment filtering checks both relational exercise_equipment junction table
 * and legacy exercises.equipment_ids JSONB array for complete backward compatibility.
 */
export function filterExercisesByEquipment(
  exercises: Array<Exercise & { requiredEquipment?: Array<{ equipmentId: string; isRequired: boolean }> }>,
  availableEquipmentIds: Set<string>
): Array<Exercise & { requiredEquipment?: Array<{ equipmentId: string; isRequired: boolean }> }> {
  return exercises.filter((ex) => {
    // 1. Ingest equipment IDs from relational exercise_equipment junction table
    const relationalReqs = ex.requiredEquipment
      ? ex.requiredEquipment.filter((re) => re.isRequired).map((re) => re.equipmentId)
      : [];

    // 2. Ingest legacy equipment IDs from exercises.equipment_ids JSONB array
    const legacyReqs = ex.equipmentIds ?? [];

    // Combine relational junction table requirements and legacy JSONB array requirements
    const combinedEquipmentIds = Array.from(new Set([...relationalReqs, ...legacyReqs]));

    // If exercise requires no equipment (bodyweight), it is always available
    if (combinedEquipmentIds.length === 0) return true;

    // If equipmentAny is true, at least ONE required equipment ID must be in available set
    if (ex.equipmentAny) {
      return combinedEquipmentIds.some((id) => availableEquipmentIds.has(id));
    }

    // Default: ALL required equipment IDs must be available in available set
    return combinedEquipmentIds.every((id) => availableEquipmentIds.has(id));
  });
}
```

---

### 3.4 Mesocycle 1 Phase Fallback, Corrective Prioritization & RAMP Safety Check

#### 1. Zero Assessments & Deficiency Fallback Behavior
When 0 deficiencies are detected (`detectedDeficiencies.length === 0`), the generator must **not** default Mesocycle 1 phase to `"corrective_prep"`. Instead, it evaluates the client's overall training goal:

```typescript
export function determineMesocyclePhase(
  detectedDeficiencies: DetectedDeficiency[],
  goal: string
): "corrective_prep" | "general_prep" | "hypertrophy" | "strength_build" {
  if (detectedDeficiencies.length > 0) {
    return "corrective_prep"; // Default for client with active movement deficiencies
  }

  // Fallback behavior when 0 deficiencies are detected:
  switch (goal) {
    case "hypertrophy":
      return "hypertrophy";
    case "strength":
      return "strength_build";
    default:
      return "general_prep"; // Baseline foundation phase
  }
}
```

#### 2. Deterministic Prioritization Algorithm & Day-by-Day Rotation Scheme
When detected deficiencies trigger more than 2 corrective exercises across a program, the engine applies a **Deterministic Prioritization & Rotation Scheme** enforcing a strict cap of **2 correctives per workout day**:

- **Prioritization Rank**:
  1. **Severity**: `severe` (rank 3) > `moderate` (rank 2) > `mild` (rank 1).
  2. **Recency**: Newer identified timestamp (`identifiedAt`) takes priority.
  3. **Body Region Balance**: Alternate upper postural correctives on upper body / push days, and lower mobility correctives on lower body / pull days.
- **Rotation Scheme**:
  - Distribute active correctives sequentially across workout days (e.g. Day 1: UCS + LCS; Day 2: Ankle DF + Knee Valgus). Daily warm-up primer volume remains capped at 2 exercises (max 10–12 min total prep time).

#### 3. RAMP Warm-up Hard Safety Check
Prior to injecting any candidate corrective exercise into the RAMP warm-up block, the generator **MUST** pass the candidate through `enforceHardSafetyGates(candidateCorrectives, ctx)`:

```typescript
export function prioritizeAndRotateCorrectives(
  deficiencies: DetectedDeficiency[],
  daysPerWeek: number,
  ctx: ClientEvaluationContext,
  allCandidates: Exercise[]
): Map<number, PrescribedCorrective[]> {
  const severityScore = { severe: 3, moderate: 2, mild: 1 };

  const sorted = [...deficiencies].sort((a, b) => {
    if (severityScore[b.severity] !== severityScore[a.severity]) {
      return severityScore[b.severity] - severityScore[a.severity];
    }
    return (b.identifiedAt?.getTime() ?? 0) - (a.identifiedAt?.getTime() ?? 0);
  });

  const dailySchedule = new Map<number, PrescribedCorrective[]>();

  // Defensive zero-length guard: avoid modulo by zero (% sorted.length) if sorted is empty
  if (sorted.length === 0) return dailySchedule;
  
  for (let day = 1; day <= daysPerWeek; day++) {
    const dayCorrectives: PrescribedCorrective[] = [];
    const startIndex = ((day - 1) * 2) % sorted.length;
    const targetDefs = [
      sorted[startIndex % sorted.length],
      sorted[(startIndex + 1) % sorted.length],
    ].filter(Boolean);

    const uniqueDefs = Array.from(new Set(targetDefs.map((d) => d.slug))).map((s) => targetDefs.find((d) => d.slug === s)!);

    for (const def of uniqueDefs) {
      const rawCandidates = getCorrectiveCandidatesForSlug(def.slug, allCandidates);
      
      // CRITICAL SAFETY GATE CHECK ON RAMP WARM-UP CORRECTIVES
      const safeCandidates = enforceHardSafetyGates(rawCandidates, ctx);
      
      if (safeCandidates.length > 0) {
        const selected = safeCandidates[0];
        dayCorrectives.push({
          deficiencySlug: def.slug,
          placement: "warmup",
          exerciseId: selected.id,
          exerciseName: selected.name,
          movementPattern: selected.movementPattern,
          sets: 2,
          reps: "10-12",
          rpe: "5-6",
          restSec: 45,
          coachingCues: selected.coachingCues ?? "Maintain controlled tempo.",
          rationale: `Prescribed for ${def.name} (${def.severity} severity). Passed hard safety gates.`,
        });
      }
    }

    dailySchedule.set(day, dayCorrectives.slice(0, 2)); // Hard cap of 2 per day
  }

  return dailySchedule;
}
```

---

### 3.5 Reconciled Equipment Fallback & Hardened Safety Contraindication Gates

#### 1. Reconciled Fallback Workflow
To reconcile Section 3.5 and Section 4.3:
- When building a workout block, candidate exercises are filtered by equipment AND `enforceHardSafetyGates`.
- **Step 1**: If primary movement pattern candidate pool size = 0, attempt **Secondary Movement Pattern Substitution Matrix**.
- **Step 2**: If BOTH primary AND secondary movement patterns yield 0 valid candidates, **THEN** throw `InsufficientSafeExercisesError` to trigger `<InsufficientSafeExercisesModal>` in the UI.

#### 2. Secondary Movement Pattern Substitution Matrix

| Primary Pattern | Secondary Substitute Pattern 1 | Secondary Substitute Pattern 2 | Clinical Rationale & Safety Safeguard |
|---|---|---|---|
| `Heavy Axially-Loaded Hinge` (e.g. Barbell Deadlift) | `Hip Thrust` / `Glute Bridge` | `Single-Leg RDL` / `Cable Pull-Through` | Eliminates spinal axial load while preserving posterior chain hip extension stimulus. |
| `Overhead Vertical Press` (e.g. Standing Barbell OHP) | `Landmine Press` | `High-Incline DB Press` / `Half-Kneeling Bottoms-Up KB Press` | Modifies shoulder elevation vector to ~60° scapular plane, bypassing subacromial impingement. |
| `Heavy Spine-Loaded Squat` (e.g. Barbell Back Squat) | `Belt Squat` / `Leg Press` | `Elevated Goblet Squat` / `Bulgarian Split Squat` | Removes axial compressive loading on lumbar spine and reduces required ankle DF angle. |
| `Overhead Vertical Pull` (e.g. Behind-Neck Pulldown / Pull-up) | `Neutral Grip Lat Pulldown` | `Chest-Supported Cable Row` / `Inverted Row` | Prevents shoulder anterior capsule stretch and cervical hyperextension under load. |
| `Heavy Horizontal Press` (e.g. Barbell Bench Press) | `Neutral Grip DB Bench Press` | `Floor Press` / `Push-Up with Scapular Protraction` | Limits shoulder hyperextension at bottom position and allows unconstrained scapular movement. |

#### 3. Hardened Safety Contraindication Gates (`enforceHardSafetyGates`)

To eliminate safety bypasses, string normalization is introduced (`normalizeString`), structured deficiencies are ingested (`ctx.detectedDeficiencies`), high-risk forbidden keywords are expanded, and safety gates are enforced inside `<ExerciseBankPicker>` during manual swaps:

```typescript
export function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/[-]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function enforceHardSafetyGates(
  candidates: Exercise[],
  ctx: ClientEvaluationContext
): Exercise[] {
  const forbiddenKeywords = new Set<string>();
  const forbiddenSlugs = new Set<string>();

  // Ingest free-text medical/injury notes with string normalization
  const textBody = normalizeString(`${ctx.client.injuriesText ?? ""} ${ctx.client.contraindicationsText ?? ""} ${ctx.client.medicalHistoryText ?? ""}`);

  // Ingest structured detected deficiencies
  const detectedSlugs = (ctx.detectedDeficiencies ?? []).map((d) => normalizeString(d.slug));
  detectedSlugs.forEach((slug) => forbiddenSlugs.add(slug));

  // Expanded Hardcoded Forbidden Keyword Rules
  if (textBody.includes("shoulder") || textBody.includes("rotator cuff") || textBody.includes("impingement") || forbiddenSlugs.has("upper cross syndrome")) {
    forbiddenKeywords.add("behind the neck");
    forbiddenKeywords.add("behind neck");
    forbiddenKeywords.add("upright row");
    forbiddenKeywords.add("french press");
    forbiddenKeywords.add("behind neck pulldown");
  }
  if (textBody.includes("lumbar") || textBody.includes("herniated disc") || textBody.includes("spondylolisthesis") || forbiddenSlugs.has("lower cross syndrome")) {
    forbiddenKeywords.add("good morning");
    forbiddenKeywords.add("hyperextension");
    forbiddenKeywords.add("jefferson curl");
    forbiddenKeywords.add("stiff leg deadlift");
    forbiddenKeywords.add("stiff leg");
    forbiddenKeywords.add("straight leg deadlift");
  }
  if (textBody.includes("knee") || textBody.includes("acl") || textBody.includes("meniscus") || forbiddenSlugs.has("knee valgus collapse")) {
    forbiddenKeywords.add("sissy squat");
    forbiddenKeywords.add("deep leg extension");
    forbiddenKeywords.add("seated leg extension");
  }
  if (textBody.includes("cervical") || textBody.includes("neck") || forbiddenSlugs.has("forward head posture")) {
    forbiddenKeywords.add("behind neck press");
    forbiddenKeywords.add("heavy barbell shrug");
  }

  return candidates.filter((ex) => {
    const normExName = normalizeString(ex.name);

    // 1. Check normalized exercise contraindication array against normalized client text & deficiencies
    if (ex.contraindications && Array.isArray(ex.contraindications)) {
      for (const rawKey of ex.contraindications) {
        const normKey = normalizeString(rawKey);
        if (textBody.includes(normKey) || forbiddenSlugs.has(normKey)) {
          return false; // Strictly forbidden
        }
      }
    }

    // 2. Check normalized forbidden keyword list against normalized exercise name
    for (const kw of forbiddenKeywords) {
      if (normExName.includes(kw)) {
        return false; // Strictly forbidden
      }
    }

    return true;
  });
}
```

---

## 4. R3. Step-by-Step Implementation Milestones & Risks

### 4.1 Sequential Atomic Milestones

```
┌────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 1: DB, SCHEMA FOUNDATION & DEFAULT SEEDS                      │
│ Scope: Add 7 Drizzle tables, 2 extensions, complete relations exports &│
│        SQL catalog seeds in src/db/schema.ts & src/db/index.ts (v18).  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 2: RULE ENGINE CORE, MATRIX & SAFETY HARDENING               │
│ Scope: Implement src/lib/smarter-rule-engine.ts, Nullish Coalescing,   │
│        Measurement Ingestion, 0-Deficiency Fallback, Prioritization,  │
│        RAMP Warm-up Safety Gate & Reconciled Pattern Substitution Matrix│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 3: BACKEND API, SERVER ACTIONS & ERROR CONTRACT              │
│ Scope: Add evaluateClientRulesAction, createSmarterProgramAction,      │
│        InsufficientSafeExercisesError class & transaction logic.       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 4: UI/UX COMPONENTS, MODAL & BANK PICKER SAFETY GATING       │
│ Scope: <ClientDeficiencySelector>, <ClientEquipmentPicker>,            │
│        <InsufficientSafeExercisesModal>, ProgramWizard Audit Cards &  │
│        <ExerciseBankPicker> Safety Gate Enforcement during swaps.      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 5: VERIFICATION & QUALITY GUARDRAILS                         │
│ Scope: Run programming smoke tests, verify PGlite execution & seeds,   │
│        full typecheck clean, forensic audit verification.              │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Definitions of Done (DoD) per Milestone

#### Milestone 1: DB, Schema Foundation & Default Seeds
- [ ] 7 new tables (`deficiency_catalog`, `client_deficiencies`, `client_equipment`, `exercise_deficiency_mappings`, `exercise_equipment`, `mesocycles`, `program_corrective_prescriptions`) added to `src/db/schema.ts`.
- [ ] Drizzle `relations()` exports added for all 7 new tables, and reciprocal relations updated for `clients`, `exercises`, `programs`, `equipmentItems`, `clientAssessments`.
- [ ] Columns `exerciseCategory` and `contraindications` added to `exercises`; columns `currentMesocycleId` and `facilityEquipmentMode` added to `programs`.
- [ ] Raw SQL DDL statements, `INSERT INTO deficiency_catalog` default seed statements, and `SCHEMA_VERSION = 18` added to `ensureSchema()` in `src/db/index.ts`.
- [ ] `npm run typecheck` passes with 0 errors.

#### Milestone 2: Rule Engine Core, Matrix & Safety Hardening
- [ ] Core evaluator file `src/lib/smarter-rule-engine.ts` created with interfaces `ClientEvaluationContext` and `RuleEngineEvaluationResult`.
- [ ] Nullish coalescing (`ctx.assessments ?? []`) and physical measurement ingestion (`ctx.measurements`: height, weight, BMI, WHR) integrated into evaluation rules.
- [ ] Explicit fallback behavior implemented for 0-deficiency clients transitioning Mesocycle 1 phase to `"general_prep"`.
- [ ] Prioritization algorithm (severity rank: `severe` > `moderate` > `mild`, recency) and day-by-day rotation scheme implemented for correctives exceeding 2/day.
- [ ] `enforceHardSafetyGates` executed on corrective exercise candidates prior to RAMP warm-up block injection.
- [ ] Reconciled Secondary Movement Pattern Substitution Matrix implemented for primary pattern candidate exhaustion.
- [ ] Hard Safety Exclusion Gates (`enforceHardSafetyGates`) updated with string normalization (`replace(/_/g, " ")`), structured deficiency ingestion (`ctx.detectedDeficiencies`), and expanded forbidden keywords (`Jefferson Curl`, `Behind-Neck Pulldown`, `Stiff Leg Deadlift`, `French Press`).

#### Milestone 3: Backend API, Server Actions & Error Contract
- [ ] Class `InsufficientSafeExercisesError` exported in `src/lib/smarter-rule-engine.ts`.
- [ ] Server actions `evaluateClientRulesAction`, `createSmarterProgramAction`, `previewSmarterProgramAction`, and `applySmarterCorrectivesAction` added to `src/app/actions/programs.ts`.
- [ ] `buildProgramDraft()` in `src/lib/program-builder.ts` integrated with `evaluateClientRules()`.
- [ ] Atomic DB transactions verified for `createSmarterProgramAction`, correctly populating `programs`, `mesocycles`, `program_days`, `program_exercises`, `client_deficiencies`, and `program_corrective_prescriptions`.

#### Milestone 4: UI/UX Components, Modal & Bank Picker Safety Gating
- [ ] Component `<ClientDeficiencySelector>` created and integrated into intake wizard, assessment panel, and wizard.
- [ ] Component `<ClientEquipmentPicker>` created with org gear, client gear, and combined preset modes.
- [ ] Component `<InsufficientSafeExercisesModal>` created to catch `InsufficientSafeExercisesError` and guide trainers.
- [ ] Step 1 of `ProgramWizard` updated with Client Deficiencies & Corrective Rules Audit card.
- [ ] Step 2 of `ProgramWizard` updated with Rule Engine Audit Card ("Why this plan"), `[Corrective: Deficiency]` badges, inline swap via `<ExerciseBankPicker>` with safety gate enforcement, and exercise lock toggles (pinning).

#### Milestone 5: Verification & Quality Guardrails
- [ ] `npm run smoke:programming` passes without failures.
- [ ] Full build (`npm run build`) and typecheck clean.
- [ ] Forensic audit clean with zero hardcoded test outputs or facade implementations.

---

### 4.3 Risk Analysis & Guardrails

| Risk Category | Technical Debt / Risk Factor | Mitigation Guardrail Strategy |
|---|---|---|
| **PGlite Query Limits** | High memory or query overhead from multi-table joins during program generation in browser PGlite. | Batch query fetching: load client context in 3 parallel reads (`client`, `measurements`, `assessments`) and index all foreign key columns. |
| **Safety Bypass via Slug Mismatch** | Contraindications failing to match due to underscores vs spaces (e.g. `shoulder_impingement` vs `shoulder impingement`). | Centralize string comparison inside `normalizeString()`, converting all underscores to spaces and stripping special characters before matching. |
| **Warm-up Block Safety Bypass** | Corrective exercises bypassing safety gates and leaking into RAMP warm-up block. | Execute `enforceHardSafetyGates` directly on corrective exercise candidates before warm-up injection. |
| **Candidate Pool Exhaustion** | System crashing or falling back to unsafe exercises when candidates are exhausted. | Reconciled 2-step fallback: first attempt Secondary Movement Pattern Substitution Matrix; if candidates remain 0, throw structured `InsufficientSafeExercisesError` and render interactive `<InsufficientSafeExercisesModal>`. |
| **Unnormalized Legacy Data** | Clients with historical free-text injuries but no structured assessment records. | Ingest structured `ctx.detectedDeficiencies` alongside normalized free-text fields in `enforceHardSafetyGates`. |
| **Trainer Manual Override Safety Bypass** | Trainer selecting unsafe exercise during manual inline exercise swap. | Enforce `enforceHardSafetyGates` inside `<ExerciseBankPicker>`, disabling contraindicated exercises with a red warning badge. |

---

## 5. Summary & Sign-off

This master technical blueprint provides a complete, production-ready specification for implementing the **Smarter Exercise Program Generator**. By grounding the implementation in deterministic rules, strict schema normalization, complete Drizzle relations, PGlite SQL seed compatibility, equipment fallback reconciliation, and hardened safety gates, FloorScribe / PT-CRM achieves an intelligent, audit-compliant exercise generator for modern personal training.
