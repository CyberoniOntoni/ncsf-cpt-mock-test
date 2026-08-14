import assert from "node:assert/strict";
import { safeSeekerNext } from "../src/lib/seeker-profile";

assert.equal(safeSeekerNext("https://evil.example"), "/portal");
assert.equal(safeSeekerNext("//evil.example"), "/portal");
assert.equal(safeSeekerNext("/portal/program"), "/portal/program");
assert.equal(safeSeekerNext("/find"), "/portal/find");
