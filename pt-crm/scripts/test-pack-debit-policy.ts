import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const src = readFileSync(
  path.join(process.cwd(), "src/app/actions/crm.ts"),
  "utf8"
);
const fn = src.slice(
  src.indexOf("export async function updateAppointmentStatusAction"),
  src.indexOf("// ── Check-ins")
);
assert.doesNotMatch(fn, /tryConsumePackageSessionAction/);
assert.doesNotMatch(fn, /tryRestorePackageSessionAction/);
console.log("pack-debit-policy ok");
