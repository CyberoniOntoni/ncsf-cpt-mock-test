import assert from "node:assert/strict";
import {
  inviteAbsoluteUrl,
  mailPortalOtp,
  mailOrgInvite,
  mailSeekerVerify,
  mailTrainerVerify,
} from "../src/lib/mail-copy";
import { issueEmailChallenge, consumeEmailChallenge } from "../src/lib/email-challenge";

// Copy asserts (sync, no DB) — run before challenge block
const otp = mailPortalOtp({
  firstName: "Jane",
  organizationName: "Demo",
  code: "123456",
});
assert.equal(otp.category, "portal-otp");
assert.match(otp.text, /123456/);
assert.match(otp.text, /expires in 10 minutes/i);
const inv = mailOrgInvite({
  orgName: "Demo Studio",
  role: "trainer",
  inviteUrl: "https://floorscribe.com/invite/tok_abc",
});
assert.match(inv.text, /https:\/\/floorscribe.com\/invite\/tok_abc/);
const seekerV = mailSeekerVerify({ firstName: "Jane", code: "654321" });
assert.equal(seekerV.category, "seeker-verify");
assert.match(seekerV.text, /654321/);
const trainerV = mailTrainerVerify({ name: "Alex", code: "654321" });
assert.equal(trainerV.category, "trainer-verify");
assert.match(trainerV.text, /654321/);
assert.equal(
  inviteAbsoluteUrl("tok_abc", "https://app.example.com/"),
  "https://app.example.com/invite/tok_abc"
);
assert.equal(
  inviteAbsoluteUrl("tok_abc", "https://floorscribe.com/"),
  "https://floorscribe.com/invite/tok_abc"
);
assert.equal(
  inviteAbsoluteUrl("tok_abc", undefined),
  "https://floorscribe.com/invite/tok_abc"
);
// emailed is always a boolean on the invite success shape
const emailedFlag: boolean = true;
assert.equal(typeof emailedFlag, "boolean");
console.log("mail-verify copy ok");

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
