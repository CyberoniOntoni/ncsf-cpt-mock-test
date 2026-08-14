import assert from "node:assert/strict";
import { issueEmailChallenge, consumeEmailChallenge } from "../src/lib/email-challenge";

async function main() {
  const email = `verify-${Date.now()}@example.com`;
  const issued = await issueEmailChallenge({ purpose: "seeker_verify", email });
  assert.equal(issued.ok, true);
  if (!issued.ok) return;
  assert.match(issued.code, /^\d{6}$/);
  const bad = await consumeEmailChallenge({
    purpose: "seeker_verify",
    email,
    code: "000000",
  });
  assert.equal(bad.ok, false);
  const good = await consumeEmailChallenge({
    purpose: "seeker_verify",
    email,
    code: issued.code,
  });
  assert.equal(good.ok, true);
  const reuse = await consumeEmailChallenge({
    purpose: "seeker_verify",
    email,
    code: issued.code,
  });
  assert.equal(reuse.ok, false);
  console.log("mail-verify challenge ok");
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
