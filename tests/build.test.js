import test from "node:test";
import assert from "node:assert/strict";
import { buildPersonaText } from "../src/build.js";

test("builds enabled root modules in order", () => {
  const items = [
    { type: "module", content: "A", enabled: true },
    { type: "module", content: "B", enabled: false },
    { type: "module", content: "C", enabled: true },
  ];
  assert.equal(buildPersonaText(items), "A\n\nC");
});

test("a disabled branch gates all children", () => {
  const items = [{
    type: "branch",
    enabled: false,
    children: [{ type: "module", content: "hidden", enabled: true }],
  }];
  assert.equal(buildPersonaText(items), "");
});

test("an enabled branch respects child switches", () => {
  const items = [{
    type: "branch",
    enabled: true,
    children: [
      { type: "module", content: "A", enabled: true },
      { type: "module", content: "B", enabled: false },
      { type: "module", content: "C", enabled: true },
    ],
  }];
  assert.equal(buildPersonaText(items, " | "), "A | C");
});

test("ignores blank and malformed entries without trimming content", () => {
  const items = [
    null,
    { type: "module", content: "   ", enabled: true },
    { type: "module", content: "  kept  ", enabled: true },
  ];
  assert.equal(buildPersonaText(items), "  kept  ");
});
