import assert from "node:assert/strict";
import test from "node:test";
import { SITE } from "./site.ts";

test("Windows landing never points Download at the macOS DMG repo", () => {
  assert.equal(SITE.source, "https://github.com/hxbib/quodex-windows");
  assert.match(SITE.download, /hxbib\/quodex-windows/);
  assert.doesNotMatch(SITE.download, /hxbib\/Quodex\/releases/);
  assert.equal(SITE.macos, "https://quodex.app");
  assert.equal(SITE.macosSource, "https://github.com/hxbib/Quodex");
  assert.equal(SITE.asset, "/Quodex-windows-x64.zip");
});
