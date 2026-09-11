import assert from "node:assert/strict";
import test from "node:test";
import { refuseWebOpenAI, WEB_AUTH_DISABLED } from "./web-guard.ts";

test("website OpenAI paths refuse instead of proxying tokens", () => {
  assert.throws(refuseWebOpenAI, { message: WEB_AUTH_DISABLED });
  assert.match(WEB_AUTH_DISABLED, /Download Quodex for Windows/);
});
