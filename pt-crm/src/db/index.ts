import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

/** Bump when adding tables/columns so long-lived dev servers re-run CREATE IF NOT EXISTS. */
const SCHEMA_VERSION = 13; // 13 = client_invoices

const globalForDb = globalThis as unknown as {
  pglite?: PGlite;
  db?: ReturnType<typeof drizzle<typeof schema>>;
  schemaVersionApplied?: number;
  schemaPromise?: Promise<void>;
};

function dataDir() {
  const dir = process.env.PGLITE_DATA_DIR || path.join(process.cwd(), "data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function getPGlite() {
  if (!globalForDb.pglite) {
    globalForDb.pglite = new PGlite(dataDir());
  }
  return globalForDb.pglite;
}

export async function getDb() {
  if (!globalForDb.db) {
    const client = await getPGlite();
    globalForDb.db = drizzle(client, { schema });
  }
  // Re-apply schema when version bumps (hot reload / new migrations)
  if (globalForDb.schemaVersionApplied !== SCHEMA_VERSION) {
    globalForDb.schemaPromise = ensureSchema().then(() => {
      globalForDb.schemaVersionApplied = SCHEMA_VERSION;
    });
    await globalForDb.schemaPromise;
  } else if (globalForDb.schemaPromise) {
    await globalForDb.schemaPromise;
  }
  return globalForDb.db!;
}

/** Apply schema via raw SQL so we don't need drizzle-kit push for PGlite. */
async function ensureSchema() {
  const client = await getPGlite();
  await client.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit_system TEXT NOT NULL DEFAULT 'metric',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, organization_id)
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'draft',
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL DEFAULT '',
      email TEXT,
      phone TEXT,
      date_of_birth TEXT,
      sex TEXT,
      emergency_contact TEXT,
      goals TEXT,
      experience_level TEXT,
      occupation TEXT,
      lifestyle_notes TEXT,
      medical_history TEXT,
      injuries TEXT,
      medications TEXT,
      contraindications TEXT,
      tags TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS clients_org_idx ON clients(organization_id);

    CREATE TABLE IF NOT EXISTS client_measurements (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      height_cm REAL,
      weight_kg REAL,
      body_fat_pct REAL,
      chest_cm REAL,
      waist_cm REAL,
      hips_cm REAL,
      notes TEXT,
      metrics JSONB
    );
    CREATE INDEX IF NOT EXISTS measurements_client_idx ON client_measurements(client_id);

    CREATE TABLE IF NOT EXISTS assessment_templates (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      purpose TEXT,
      instructions TEXT,
      category TEXT NOT NULL DEFAULT 'movement',
      laterality BOOLEAN NOT NULL DEFAULT FALSE,
      scoring_type TEXT NOT NULL DEFAULT 'pass_fail',
      fields JSONB NOT NULL DEFAULT '[]',
      playbook_tags TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE
    );
    ALTER TABLE assessment_templates ADD COLUMN IF NOT EXISTS purpose TEXT;

    CREATE TABLE IF NOT EXISTS client_assessments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      template_id TEXT NOT NULL REFERENCES assessment_templates(id),
      taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      results JSONB NOT NULL DEFAULT '{}',
      notes TEXT,
      summary TEXT
    );
    CREATE INDEX IF NOT EXISTS assessments_client_idx ON client_assessments(client_id);

    CREATE TABLE IF NOT EXISTS client_notes (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      author_user_id TEXT REFERENCES users(id),
      conversation_id TEXT,
      title TEXT,
      body TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'note',
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS notes_client_idx ON client_notes(client_id);

    CREATE TABLE IF NOT EXISTS client_packages (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Session pack',
      total_sessions INTEGER NOT NULL DEFAULT 10,
      used_sessions INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS packages_client_idx ON client_packages(client_id);

    CREATE TABLE IF NOT EXISTS client_appointments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Training session',
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      location TEXT,
      session_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS appointments_client_idx ON client_appointments(client_id);
    CREATE INDEX IF NOT EXISTS appointments_starts_idx ON client_appointments(starts_at);
    CREATE INDEX IF NOT EXISTS appointments_session_idx ON client_appointments(session_id);

    CREATE TABLE IF NOT EXISTS client_check_ins (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      author_user_id TEXT REFERENCES users(id),
      channel TEXT NOT NULL DEFAULT 'message',
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS checkins_client_idx ON client_check_ins(client_id);

    CREATE TABLE IF NOT EXISTS client_tasks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      due_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS tasks_org_idx ON client_tasks(organization_id);
    CREATE INDEX IF NOT EXISTS tasks_client_idx ON client_tasks(client_id);
    CREATE INDEX IF NOT EXISTS tasks_due_idx ON client_tasks(due_at);

    CREATE TABLE IF NOT EXISTS client_invoices (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'SGD',
      status TEXT NOT NULL DEFAULT 'unpaid',
      notes TEXT,
      package_id TEXT REFERENCES client_packages(id) ON DELETE SET NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS invoices_org_idx ON client_invoices(organization_id);
    CREATE INDEX IF NOT EXISTS invoices_client_idx ON client_invoices(client_id);
    CREATE INDEX IF NOT EXISTS invoices_status_idx ON client_invoices(status);

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS conversations_org_idx ON conversations(organization_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      structured JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id);

    CREATE TABLE IF NOT EXISTS playbooks (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'corrective',
      trigger_phrases TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      summary TEXT,
      follow_up_questions JSONB NOT NULL DEFAULT '[]',
      solution_steps JSONB NOT NULL DEFAULT '[]',
      interventions JSONB NOT NULL DEFAULT '[]',
      red_flags JSONB NOT NULL DEFAULT '[]',
      contraindications TEXT,
      source_notes TEXT,
      body TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS playbook_chunks (
      id TEXT PRIMARY KEY,
      playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      embedding JSONB
    );
    CREATE INDEX IF NOT EXISTS chunks_playbook_idx ON playbook_chunks(playbook_id);

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS equipment_items (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      sort_order INTEGER NOT NULL DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS org_equipment (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      equipment_id TEXT NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
      available BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      UNIQUE(organization_id, equipment_id)
    );
    CREATE INDEX IF NOT EXISTS org_equipment_org_idx ON org_equipment(organization_id);

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      movement_pattern TEXT NOT NULL DEFAULT 'other',
      primary_muscles TEXT NOT NULL DEFAULT '',
      secondary_muscles TEXT NOT NULL DEFAULT '',
      difficulty TEXT NOT NULL DEFAULT 'intermediate',
      tags TEXT NOT NULL DEFAULT '',
      cues TEXT,
      equipment_ids JSONB NOT NULL DEFAULT '[]',
      equipment_any BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS exercises_pattern_idx ON exercises(movement_pattern);

    CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      goal TEXT NOT NULL DEFAULT 'general',
      days_per_week INTEGER NOT NULL DEFAULT 3,
      session_minutes INTEGER NOT NULL DEFAULT 45,
      split_type TEXT NOT NULL DEFAULT 'full_body',
      experience_level TEXT DEFAULT 'intermediate',
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      generation_meta JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS programs_org_idx ON programs(organization_id);
    CREATE INDEX IF NOT EXISTS programs_client_idx ON programs(client_id);

    CREATE TABLE IF NOT EXISTS program_days (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      day_index INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      focus TEXT
    );
    CREATE INDEX IF NOT EXISTS program_days_program_idx ON program_days(program_id);

    CREATE TABLE IF NOT EXISTS program_exercises (
      id TEXT PRIMARY KEY,
      program_day_id TEXT NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
      exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
      exercise_name TEXT NOT NULL,
      movement_pattern TEXT,
      sets INTEGER NOT NULL DEFAULT 3,
      reps TEXT NOT NULL DEFAULT '8-10',
      rpe TEXT,
      rest_sec INTEGER,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_warmup BOOLEAN NOT NULL DEFAULT FALSE,
      set_scheme TEXT NOT NULL DEFAULT 'straight',
      set_scheme_meta JSONB,
      group_id TEXT,
      group_kind TEXT,
      group_label TEXT,
      group_order INTEGER,
      rest_after_sec INTEGER,
      rest_between_rounds_sec INTEGER,
      group_role TEXT
    );
    CREATE INDEX IF NOT EXISTS program_exercises_day_idx ON program_exercises(program_day_id);

    CREATE TABLE IF NOT EXISTS training_sessions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      program_id TEXT REFERENCES programs(id) ON DELETE SET NULL,
      program_day_id TEXT REFERENCES program_days(id) ON DELETE SET NULL,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_min INTEGER,
      overall_rpe TEXT,
      pain_notes TEXT,
      notes TEXT,
      appointment_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS sessions_org_idx ON training_sessions(organization_id);
    CREATE INDEX IF NOT EXISTS sessions_client_idx ON training_sessions(client_id);
    CREATE INDEX IF NOT EXISTS sessions_program_idx ON training_sessions(program_id);
    CREATE INDEX IF NOT EXISTS sessions_appointment_idx ON training_sessions(appointment_id);

    CREATE TABLE IF NOT EXISTS session_exercise_logs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
      program_exercise_id TEXT REFERENCES program_exercises(id) ON DELETE SET NULL,
      exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
      exercise_name TEXT NOT NULL,
      movement_pattern TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_warmup BOOLEAN NOT NULL DEFAULT FALSE,
      planned_sets INTEGER,
      planned_reps TEXT,
      actual_sets INTEGER,
      actual_reps TEXT,
      weight_kg REAL,
      rpe TEXT,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      set_logs JSONB NOT NULL DEFAULT '[]',
      set_scheme TEXT DEFAULT 'straight',
      set_scheme_meta JSONB,
      group_id TEXT,
      group_kind TEXT,
      group_label TEXT,
      group_order INTEGER,
      rest_after_sec INTEGER,
      rest_between_rounds_sec INTEGER,
      group_role TEXT
    );
    CREATE INDEX IF NOT EXISTS session_logs_session_idx ON session_exercise_logs(session_id);

    -- Migrations for existing DBs
    ALTER TABLE session_exercise_logs ADD COLUMN IF NOT EXISTS set_logs JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS set_scheme TEXT NOT NULL DEFAULT 'straight';
    ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS set_scheme_meta JSONB;
    ALTER TABLE session_exercise_logs ADD COLUMN IF NOT EXISTS set_scheme TEXT DEFAULT 'straight';
    ALTER TABLE session_exercise_logs ADD COLUMN IF NOT EXISTS set_scheme_meta JSONB;
    ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS group_id TEXT;
    ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS group_kind TEXT;
    ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS group_label TEXT;
    ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS group_order INTEGER;
    ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS rest_after_sec INTEGER;
    ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS rest_between_rounds_sec INTEGER;
    ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS group_role TEXT;
    ALTER TABLE session_exercise_logs ADD COLUMN IF NOT EXISTS group_id TEXT;
    ALTER TABLE session_exercise_logs ADD COLUMN IF NOT EXISTS group_kind TEXT;
    ALTER TABLE session_exercise_logs ADD COLUMN IF NOT EXISTS group_label TEXT;
    ALTER TABLE session_exercise_logs ADD COLUMN IF NOT EXISTS group_order INTEGER;
    ALTER TABLE session_exercise_logs ADD COLUMN IF NOT EXISTS rest_after_sec INTEGER;
    ALTER TABLE session_exercise_logs ADD COLUMN IF NOT EXISTS rest_between_rounds_sec INTEGER;
    ALTER TABLE session_exercise_logs ADD COLUMN IF NOT EXISTS group_role TEXT;
    ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE client_appointments ADD COLUMN IF NOT EXISTS session_id TEXT;
    ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS appointment_id TEXT;
    CREATE INDEX IF NOT EXISTS appointments_session_idx ON client_appointments(session_id);
    CREATE INDEX IF NOT EXISTS sessions_appointment_idx ON training_sessions(appointment_id);
  `);
}

export type Db = Awaited<ReturnType<typeof getDb>>;
