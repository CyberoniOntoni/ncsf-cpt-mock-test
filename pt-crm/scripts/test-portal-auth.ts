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

  // No working transport → delivered false (no Mailtrap token).
  {
    const prevMock = process.env.MOCK_EMAIL;
    const prevToken = process.env.MAILTRAP_API_TOKEN;
    process.env.MOCK_EMAIL = "false";
    delete process.env.MAILTRAP_API_TOKEN;
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
      if (prevToken === undefined) delete process.env.MAILTRAP_API_TOKEN;
      else process.env.MAILTRAP_API_TOKEN = prevToken;
    }
  }

  // Production + isMockEmail (MAILTRAP_API_TOKEN unset) must not report delivered.
  {
    const env = process.env as { NODE_ENV?: string };
    const prevNode = env.NODE_ENV;
    const prevMock = process.env.MOCK_EMAIL;
    const prevToken = process.env.MAILTRAP_API_TOKEN;
    env.NODE_ENV = "production";
    delete process.env.MOCK_EMAIL;
    delete process.env.MAILTRAP_API_TOKEN;
    try {
      assert.equal(isMockEmail(), true);
      const r = await sendEmail({
        to: "otp-test@example.com",
        subject: "prod mock is not delivery",
        text: "body",
      });
      assert.equal(r.delivered, false);
    } finally {
      if (prevNode === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = prevNode;
      if (prevMock === undefined) delete process.env.MOCK_EMAIL;
      else process.env.MOCK_EMAIL = prevMock;
      if (prevToken === undefined) delete process.env.MAILTRAP_API_TOKEN;
      else process.env.MAILTRAP_API_TOKEN = prevToken;
    }
  }

  console.log("test-portal-auth: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
