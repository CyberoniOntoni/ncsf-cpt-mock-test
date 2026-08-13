import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

/** Bump when adding tables/columns so long-lived dev servers re-run CREATE IF NOT EXISTS. */
const SCHEMA_VERSION = 22; // 22 = marketplace matchmaking

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
      kind TEXT NOT NULL DEFAULT 'studio',
      unit_system TEXT NOT NULL DEFAULT 'metric',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      title TEXT,
      is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, organization_id)
    );

    CREATE TABLE IF NOT EXISTS org_invites (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'trainer',
      token TEXT NOT NULL UNIQUE,
      invited_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS org_invites_org_idx ON org_invites(organization_id);
    CREATE INDEX IF NOT EXISTS org_invites_email_idx ON org_invites(email);

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
      package_id TEXT,
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
    ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS package_id TEXT;
    ALTER TABLE client_appointments ADD COLUMN IF NOT EXISTS package_id TEXT;
    CREATE INDEX IF NOT EXISTS appointments_session_idx ON client_appointments(session_id);
    CREATE INDEX IF NOT EXISTS sessions_appointment_idx ON training_sessions(appointment_id);
    CREATE INDEX IF NOT EXISTS appointments_package_idx ON client_appointments(package_id);
    -- User profile (SCHEMA 14)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    -- Org kind + invites (SCHEMA 15)
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'studio';
    CREATE TABLE IF NOT EXISTS org_invites (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'trainer',
      token TEXT NOT NULL UNIQUE,
      invited_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS org_invites_org_idx ON org_invites(organization_id);
    CREATE INDEX IF NOT EXISTS org_invites_email_idx ON org_invites(email);

    -- Missing query indexes (SCHEMA 17)
    CREATE INDEX IF NOT EXISTS memberships_org_idx ON memberships(organization_id);
    CREATE INDEX IF NOT EXISTS assessment_templates_org_idx ON assessment_templates(organization_id);
    CREATE INDEX IF NOT EXISTS assessment_templates_slug_idx ON assessment_templates(slug);
    CREATE INDEX IF NOT EXISTS assessments_template_idx ON client_assessments(template_id);
    CREATE INDEX IF NOT EXISTS assessments_client_taken_idx ON client_assessments(client_id, taken_at);
    CREATE INDEX IF NOT EXISTS notes_author_idx ON client_notes(author_user_id);
    CREATE INDEX IF NOT EXISTS notes_conversation_idx ON client_notes(conversation_id);
    CREATE INDEX IF NOT EXISTS notes_client_created_idx ON client_notes(client_id, created_at);
    CREATE INDEX IF NOT EXISTS measurements_client_taken_idx ON client_measurements(client_id, taken_at);
    CREATE INDEX IF NOT EXISTS packages_client_status_idx ON client_packages(client_id, status);
    CREATE INDEX IF NOT EXISTS appointments_status_idx ON client_appointments(status);
    CREATE INDEX IF NOT EXISTS appointments_client_status_idx ON client_appointments(client_id, status);
    CREATE INDEX IF NOT EXISTS invoices_package_idx ON client_invoices(package_id);
    CREATE INDEX IF NOT EXISTS invoices_org_status_idx ON client_invoices(organization_id, status);
    CREATE INDEX IF NOT EXISTS checkins_author_idx ON client_check_ins(author_user_id);
    CREATE INDEX IF NOT EXISTS checkins_client_created_idx ON client_check_ins(client_id, created_at);
    CREATE INDEX IF NOT EXISTS tasks_org_status_due_idx ON client_tasks(organization_id, status, due_at);
    CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS conversations_client_idx ON conversations(client_id);
    CREATE INDEX IF NOT EXISTS conversations_org_updated_idx ON conversations(organization_id, updated_at);

    -- Smarter generator (SCHEMA 19)
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_category TEXT NOT NULL DEFAULT 'primary';
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS contraindications JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE programs ADD COLUMN IF NOT EXISTS current_mesocycle_id TEXT;
    ALTER TABLE programs ADD COLUMN IF NOT EXISTS facility_equipment_mode TEXT NOT NULL DEFAULT 'org';

    CREATE TABLE IF NOT EXISTS deficiency_catalog (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'postural',
      description TEXT,
      assessment_criteria JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO deficiency_catalog (id, slug, name, category, description)
    VALUES
      ('def_ucs', 'upper_cross_syndrome', 'Upper Cross Syndrome', 'postural', 'Tight pecs/upper traps with weak deep neck flexors and lower traps.'),
      ('def_lcs', 'lower_cross_syndrome', 'Lower Cross Syndrome', 'postural', 'Anterior pelvic tilt: tight hip flexors/erectors, weak glutes/abdominals.'),
      ('def_ankle_df', 'ankle_mobility_restriction', 'Ankle Dorsiflexion Restriction', 'mobility', 'Limited talocrural DF that limits squat depth and landing.'),
      ('def_knee_valgus', 'knee_valgus_collapse', 'Knee Valgus Collapse', 'motor_control', 'Medial knee collapse under load — hip abductor/rotator control.'),
      ('def_forward_head', 'forward_head_posture', 'Forward Head Posture', 'postural', 'Anterior head carriage / cervical extension bias.'),
      ('def_high_bmi', 'high_bmi_joint_stress', 'High BMI & Joint Loading Risk', 'joint_stress', 'Elevated BMI or WHR — scale axial load and impact.'),
      ('def_ab_adiposity', 'abdominal_adiposity_core_restriction', 'Abdominal Adiposity & Core Restriction', 'mobility', 'High waist/WHR — prefer anti-rotation over deep spinal flexion.')
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
      target_deficiencies JSONB NOT NULL DEFAULT '[]',
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
    CREATE INDEX IF NOT EXISTS messages_conv_created_idx ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS playbooks_org_idx ON playbooks(organization_id);
    CREATE INDEX IF NOT EXISTS org_equipment_equipment_idx ON org_equipment(equipment_id);
    CREATE INDEX IF NOT EXISTS exercises_org_idx ON exercises(organization_id);
    CREATE INDEX IF NOT EXISTS clients_org_status_idx ON clients(organization_id, status);
    CREATE INDEX IF NOT EXISTS programs_created_by_idx ON programs(created_by_user_id);
    CREATE INDEX IF NOT EXISTS programs_client_status_idx ON programs(client_id, status);
    CREATE INDEX IF NOT EXISTS program_days_program_day_idx ON program_days(program_id, day_index);
    CREATE INDEX IF NOT EXISTS program_exercises_exercise_idx ON program_exercises(exercise_id);
    CREATE INDEX IF NOT EXISTS program_exercises_day_sort_idx ON program_exercises(program_day_id, sort_order);
    CREATE INDEX IF NOT EXISTS sessions_program_day_idx ON training_sessions(program_day_id);
    CREATE INDEX IF NOT EXISTS sessions_created_by_idx ON training_sessions(created_by_user_id);
    CREATE INDEX IF NOT EXISTS sessions_package_idx ON training_sessions(package_id);
    CREATE INDEX IF NOT EXISTS sessions_org_status_idx ON training_sessions(organization_id, status);
    CREATE INDEX IF NOT EXISTS sessions_client_status_performed_idx ON training_sessions(client_id, status, performed_at);
    CREATE INDEX IF NOT EXISTS session_logs_exercise_idx ON session_exercise_logs(exercise_id);
    CREATE INDEX IF NOT EXISTS session_logs_program_exercise_idx ON session_exercise_logs(program_exercise_id);
    CREATE INDEX IF NOT EXISTS session_logs_session_sort_idx ON session_exercise_logs(session_id, sort_order);

    -- Client portal (SCHEMA 20)
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS notification_preferences JSONB;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
    DROP INDEX IF EXISTS clients_org_email_uidx;
    CREATE UNIQUE INDEX IF NOT EXISTS clients_org_email_uidx
      ON clients(organization_id, email)
      WHERE email IS NOT NULL AND btrim(email) <> '';
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS payment_url TEXT;

    CREATE TABLE IF NOT EXISTS client_sessions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS client_sessions_org_client_idx ON client_sessions(organization_id, client_id);
    CREATE INDEX IF NOT EXISTS client_sessions_expires_idx ON client_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS client_otps (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS client_otps_email_org_idx ON client_otps(email, organization_id);
    CREATE INDEX IF NOT EXISTS client_otps_client_idx ON client_otps(client_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS notifications_client_read_idx ON notifications(client_id, read_at);
    CREATE INDEX IF NOT EXISTS notifications_org_client_idx ON notifications(organization_id, client_id);

    CREATE TABLE IF NOT EXISTS client_documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      document_version TEXT NOT NULL DEFAULT '1',
      document_hash TEXT,
      signature_data TEXT,
      ip_address TEXT,
      user_agent TEXT,
      signed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS client_documents_client_status_idx ON client_documents(client_id, status);
    CREATE INDEX IF NOT EXISTS client_documents_org_client_idx ON client_documents(organization_id, client_id);

    CREATE TABLE IF NOT EXISTS gym_facilities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      brand TEXT,
      city TEXT NOT NULL,
      region TEXT,
      country TEXT NOT NULL DEFAULT 'SG',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS gym_facilities_city_idx ON gym_facilities(city);

    CREATE TABLE IF NOT EXISTS marketplace_profiles (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      headline TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      specialties TEXT NOT NULL DEFAULT '',
      hourly_rate_cents INTEGER,
      currency TEXT NOT NULL DEFAULT 'USD',
      service_modes TEXT NOT NULL DEFAULT 'studio,at_gym',
      city TEXT NOT NULL DEFAULT '',
      region TEXT,
      country TEXT NOT NULL DEFAULT 'SG',
      lat REAL,
      lng REAL,
      radius_km INTEGER NOT NULL DEFAULT 15,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      featured_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, organization_id)
    );
    CREATE INDEX IF NOT EXISTS marketplace_profiles_published_idx ON marketplace_profiles(published);

    CREATE TABLE IF NOT EXISTS marketplace_profile_facilities (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES marketplace_profiles(id) ON DELETE CASCADE,
      facility_id TEXT NOT NULL REFERENCES gym_facilities(id) ON DELETE CASCADE,
      UNIQUE(profile_id, facility_id)
    );
    CREATE INDEX IF NOT EXISTS mpf_facility_idx ON marketplace_profile_facilities(facility_id);

    CREATE TABLE IF NOT EXISTS intro_requests (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES marketplace_profiles(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seeker_email TEXT NOT NULL,
      seeker_name TEXT NOT NULL,
      seeker_phone TEXT,
      city TEXT,
      lat REAL,
      lng REAL,
      facility_id TEXT REFERENCES gym_facilities(id) ON DELETE SET NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      accepted_client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS intro_requests_org_status_idx ON intro_requests(organization_id, status);
    CREATE INDEX IF NOT EXISTS intro_requests_email_created_idx ON intro_requests(seeker_email, created_at);

    CREATE TABLE IF NOT EXISTS platform_charges (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      intro_request_id TEXT REFERENCES intro_requests(id) ON DELETE SET NULL,
      profile_id TEXT REFERENCES marketplace_profiles(id) ON DELETE SET NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'due',
      stripe_checkout_session_id TEXT,
      payment_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS platform_charges_org_status_idx ON platform_charges(organization_id, status);
    ALTER TABLE platform_charges ADD COLUMN IF NOT EXISTS profile_id TEXT REFERENCES marketplace_profiles(id) ON DELETE SET NULL;
  `);
}

export type Db = Awaited<ReturnType<typeof getDb>>;
