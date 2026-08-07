/**
 * One-shot: ensure appointment ↔ session columns exist (SCHEMA 12).
 * Run: npx tsx scripts/migrate-appointment-link.ts
 */
import { getPGlite } from "../src/db";

async function main() {
  const c = await getPGlite();
  await c.exec(`
    ALTER TABLE client_appointments ADD COLUMN IF NOT EXISTS session_id TEXT;
    ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS appointment_id TEXT;
    CREATE INDEX IF NOT EXISTS appointments_session_idx ON client_appointments(session_id);
    CREATE INDEX IF NOT EXISTS sessions_appointment_idx ON training_sessions(appointment_id);
  `);
  const r = await c.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'training_sessions' AND column_name = 'appointment_id'`
  );
  console.log("training_sessions.appointment_id:", r.rows);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
