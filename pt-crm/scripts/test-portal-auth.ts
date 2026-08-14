import assert from "node:assert/strict";
import { safeSeekerNext } from "../src/lib/seeker-profile";
import { isMockEmail, sendEmail } from "../src/lib/email";

assert.equal(safeSeekerNext("https://evil.example"), "/portal");
assert.equal(safeSeekerNext("//evil.example"), "/portal");
assert.equal(safeSeekerNext("/portal/program"), "/portal/program");
assert.equal(safeSeekerNext("/find"), "/portal/find");

async function main() {
  // Default in tsx / non-production: mock mail is on and reports delivered.
  assert.equal(isMockEmail(), true);
  {
    const r = await sendEmail({
      to: "otp-test@example.com",
      subject: "portal-auth smoke",
      text: "body",
    });
    assert.equal(r.delivered, true);
  }

  // No working transport → delivered false (do not install SES SDK).
  {
    const prevMock = process.env.MOCK_EMAIL;
    const prevFrom = process.env.AWS_SES_FROM;
    process.env.MOCK_EMAIL = "false";
    delete process.env.AWS_SES_FROM;
    try {
      assert.equal(isMockEmail(), false);
      const r = await sendEmail({
        to: "otp-test@example.com",
        subject: "no transport",
        text: "body",
      });
      assert.equal(r.delivered, false);
    } finally {
      if (prevMock === undefined) delete process.env.MOCK_EMAIL;
      else process.env.MOCK_EMAIL = prevMock;
      if (prevFrom === undefined) delete process.env.AWS_SES_FROM;
      else process.env.AWS_SES_FROM = prevFrom;
    }
  }

  console.log("test-portal-auth: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
