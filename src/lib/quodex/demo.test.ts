import assert from "node:assert/strict";
import test from "node:test";
import { createDemoAccounts, isLandingFreeSample, landingEmail, LANDING_EMAIL_DOMAIN } from "./demo.ts";

test("sample accounts use the quodex.app domain and never include Free Monthly", () => {
  const accounts = createDemoAccounts();
  assert.ok(accounts.length >= 2);
  for (const account of accounts) {
    assert.equal(account.isDemo, true);
    assert.match(account.email, new RegExp(`@${LANDING_EMAIL_DOMAIN}$`));
    assert.notEqual(account.plan.toLowerCase(), "free");
    assert.equal(isLandingFreeSample(account), false);
    assert.ok(!(account.lastSnapshot?.lanes ?? []).some((lane) => lane.name === "Free Monthly"));
  }
});

test("landingEmail always rewrites to quodex.app", () => {
  assert.equal(landingEmail("maya.chen@gmail.com"), "maya.chen@quodex.app");
  assert.equal(landingEmail("sofia@quodex.app"), "sofia@quodex.app");
});
