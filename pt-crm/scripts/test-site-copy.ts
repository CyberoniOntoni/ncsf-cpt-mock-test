import assert from "node:assert/strict";
import {
  AUDIENCE_DOORS,
  DAY_STEPS,
  FEATURE_PILLARS,
  PUBLIC_NAV,
  SITE_COPY,
  SITE_DISCLAIMERS,
  START_STEPS,
  TRAINER_SECTION_NAV,
} from "../src/lib/site/copy";

function hrefs(items: { href: string }[]) {
  return items.map((i) => i.href);
}

assert.equal(SITE_COPY.productName, "FloorScribe");
assert.match(SITE_COPY.tagline, /run the day/i);
assert.match(SITE_COPY.heroBody, /session/i);
assert.doesNotMatch(SITE_COPY.heroBody, /find a trainer first/i);

assert.deepEqual(hrefs(PUBLIC_NAV), [
  "/marketing",
  "/find",
  "/portal/login",
]);
assert.equal(SITE_COPY.primaryCta.href, "/register");
assert.equal(SITE_COPY.soloCta.href, "/register/solo");
assert.equal(SITE_COPY.studioCta.href, "/register/studio");
assert.equal(SITE_COPY.signInCta.href, "/login");

const pillarTitles = FEATURE_PILLARS.map((p) => p.title);
assert.ok(pillarTitles.includes("Session log"));
assert.ok(pillarTitles.includes("Session packs"));
assert.ok(pillarTitles.includes("Bookings"));
assert.ok(pillarTitles.includes("Programs"));
assert.ok(pillarTitles.includes("Client portal"));
assert.ok(pillarTitles.includes("Find a trainer"));
assert.equal(FEATURE_PILLARS.length, 6);

const program = FEATURE_PILLARS.find((p) => p.title === "Programs");
assert.match(program!.body, /auto-design|program/i);
const portal = FEATURE_PILLARS.find((p) => p.title === "Client portal");
assert.match(portal!.body, /one-time code|assigned/i);
const find = FEATURE_PILLARS.find((p) => p.title === "Find a trainer");
assert.match(find!.body, /intro/i);
assert.doesNotMatch(find!.body, /stripe connect/i);

assert.equal(AUDIENCE_DOORS.length, 3);
assert.equal(AUDIENCE_DOORS[0].href, "/register");
assert.equal(AUDIENCE_DOORS[1].href, "/portal/login");
assert.equal(AUDIENCE_DOORS[2].href, "/find");
assert.equal(AUDIENCE_DOORS[0].audience, "trainer");

assert.equal(DAY_STEPS.length, 3);
assert.equal(START_STEPS.length, 4);
assert.ok(START_STEPS[0].toLowerCase().includes("account"));

assert.deepEqual(hrefs(TRAINER_SECTION_NAV), [
  "#how",
  "#included",
  "#doors",
  "#start",
]);

assert.match(SITE_DISCLAIMERS.medical, /does not diagnose/i);
assert.match(SITE_DISCLAIMERS.findIntro, /introduces you/i);
assert.match(SITE_DISCLAIMERS.findIntro, /session payments are between you and the trainer/i);

assert.doesNotMatch(JSON.stringify(SITE_COPY), /franchise erp/i);
assert.doesNotMatch(JSON.stringify(FEATURE_PILLARS), /card payment network/i);

console.log("site-copy ok");
